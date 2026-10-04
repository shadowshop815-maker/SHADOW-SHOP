import { Router } from "express";
import { randomUUID } from "node:crypto";
import { addressSchema, checkoutSchema } from "@shadow/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { OfferEngine, CartContext } from "../services/OfferEngine.js";
import { ShippingPricingService } from "../services/ShippingPricingService.js";
import { enqueueEmailJob } from "../services/email/dispatcher.js";

export const commerceRouter = Router();

const cartInclude = { items: { include: { product: { include: { categories: true, images: { orderBy: { position: "asc" as const } } } } }, orderBy: { id: "asc" as const } } };
const cartKey = (req: any) => String(req.headers["x-cart-key"] || "").trim();

async function getCart(req: any, create = true) {
  if (req.auth) {
    const found = await prisma.cart.findFirst({ where: { userId: req.auth.id }, include: cartInclude });
    if (found || !create) return found;
    return prisma.cart.create({ data: { userId: req.auth.id }, include: cartInclude });
  }
  const key = cartKey(req); if (!key) throw new AppError(400, "A cart key is required.", "CART_KEY_REQUIRED");
  const found = await prisma.cart.findUnique({ where: { guestKey: key }, include: cartInclude });
  if (found || !create) return found;
  return prisma.cart.create({ data: { guestKey: key }, include: cartInclude });
}

async function cartView(req: any, cart: NonNullable<Awaited<ReturnType<typeof getCart>>>) {
  let settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  let subtotal = 0; let baseDiscount = 0; let totalTax = 0; let exclusiveTaxToAdd = 0;
  const taxRate = settings.taxRate / 100;
  
  const items = cart.items.map((item: any) => { 
    const price = Number(item.product.price); 
    const effectivePrice = item.product.salePrice == null ? price : Number(item.product.salePrice); 
    const lineTotal = effectivePrice * item.quantity;
    subtotal += lineTotal; 
    baseDiscount += (price - effectivePrice) * item.quantity; 
    
    let itemTax = 0;
    if (item.product.taxMode === "EXCLUSIVE") {
      itemTax = lineTotal * taxRate;
      exclusiveTaxToAdd += itemTax;
    } else {
      itemTax = lineTotal - (lineTotal / (1 + taxRate));
    }
    totalTax += itemTax;

    return { ...item, unitPrice: effectivePrice, lineTotal }; 
  });
  
  let afterBaseDiscount = subtotal;
  let offerDiscount = 0;
  let offerApplied = null;
  
  if (cart.appliedOfferCode) {
    let resolvedAddressId = cart.deliveryAddressId || undefined;
    if (!resolvedAddressId && req.auth?.id) {
      let defaultAddr = await prisma.address.findFirst({ where: { userId: req.auth.id, isDefault: true } });
      if (!defaultAddr) defaultAddr = await prisma.address.findFirst({ where: { userId: req.auth.id } });
      if (defaultAddr) resolvedAddressId = defaultAddr.id;
    }

    const context: CartContext = {
      userId: cart.userId || undefined,
      addressId: resolvedAddressId,
      items: items.map((i:any) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, product: i.product })),
      subtotal: afterBaseDiscount
    };
    
    const eligibility = await OfferEngine.evaluateOffer(cart.appliedOfferCode, context);
    if (eligibility.eligible) {
      offerDiscount = eligibility.discountAmount || 0;
      offerApplied = eligibility;
    } else {
      await prisma.cart.update({ where: { id: cart.id }, data: { appliedOfferCode: null } });
      cart.appliedOfferCode = null;
      offerApplied = eligibility;
    }
  }


  // ----- SHIPPING CALCULATION (via central ShippingPricingService) -----
  const finalMerchandiseSubtotal = Math.max(0, afterBaseDiscount - offerDiscount);
  const shippingCtx = {
    subtotalBeforeDiscount: subtotal,
    subtotalAfterDiscount: finalMerchandiseSubtotal,
    addressId: cart.deliveryAddressId || undefined
  };

  // Fetch delivery options and base shipping info in one parallel batch
  const { options: deliveryOptionsResult, base: baseShippingInfo } = await ShippingPricingService.calculateAll(shippingCtx);

  let shippingFee = 0;
  let selectedOption: any = null;
  let shippingBreakdown: any = null;
  // "NOT_SELECTED" = no address or no method chosen yet (do not charge)
  // "CONFIRMED"    = customer explicitly selected a method after providing address
  let shippingStatus: "NOT_SELECTED" | "CONFIRMED" = "NOT_SELECTED";

  // Only resolve a shipping fee if the customer has an explicitly selected delivery option.
  // We do not strictly require deliveryAddressId here because guest users or users entering 
  // a manual address won't have an addressId saved to the cart until final checkout.
  if (cart.deliveryOptionId) {
    selectedOption = deliveryOptionsResult.find((o: any) => o.id === cart.deliveryOptionId && o.available);
    if (!selectedOption) {
      // The previously selected option is no longer available (e.g. address changed, option disabled)
      // Invalidate it silently — do NOT fall back to another option automatically
      await prisma.cart.update({ where: { id: cart.id }, data: { deliveryOptionId: null } });
      cart.deliveryOptionId = null;
      shippingStatus = "NOT_SELECTED";
    } else {
      shippingStatus = "CONFIRMED";
    }
  }
  // NOTE: We deliberately do NOT auto-select a default option here.
  // The customer must explicitly choose a shipping method after entering their address.
  // Auto-selecting creates the bug: cart shows ₹90 before the customer even sees the checkout.

  if (selectedOption && shippingStatus === "CONFIRMED") {
    shippingFee = selectedOption.finalShippingFee;
    shippingBreakdown = selectedOption.breakdown;
    // Override with FREE_DELIVERY promo
    if (offerApplied?.eligible && (offerApplied as any).discountType === "FREE_DELIVERY") {
      shippingFee = 0;
      if (shippingBreakdown) shippingBreakdown.finalShippingFee = 0;
    }
  }
  // shippingFee stays 0 when status is NOT_SELECTED — shipping is not yet charged

  const settings2 = settings;
  const discountProportion = subtotal > 0 ? (finalMerchandiseSubtotal / subtotal) : 1;
  const tax = totalTax * discountProportion;
  const finalExclusiveTaxToAdd = exclusiveTaxToAdd * discountProportion;
  const grandTotal = finalMerchandiseSubtotal + finalExclusiveTaxToAdd + shippingFee;

  return {
    id: cart.id,
    items,
    totals: { subtotal, discount: 0, offerDiscount, shipping: shippingFee, tax, grandTotal },
    shipping: {
      ...baseShippingInfo,
      shippingStatus,
      freeShippingEligible: shippingBreakdown ? shippingBreakdown.freeShippingEligible : baseShippingInfo.freeShippingEligible,
      selectedOptionBreakdown: shippingBreakdown
    },
    currency: settings2.currency,
    appliedOffer: cart.appliedOfferCode ? offerApplied : null,
    appliedOfferCode: cart.appliedOfferCode,
    deliveryAddressId: cart.deliveryAddressId,
    deliveryOptionId: cart.deliveryOptionId,
    deliveryOptions: deliveryOptionsResult
  };
}


commerceRouter.get("/cart", optionalAuth, asyncHandler(async (req, res) => success(res, "Cart loaded.", await cartView(req, (await getCart(req))!))));
commerceRouter.post("/cart/items", optionalAuth, asyncHandler(async (req, res) => {
  const productId = String(req.body.productId || ""); const quantity = Math.max(1, Number(req.body.quantity) || 1); const selectedSize = String(req.body.selectedSize || ""); const selectedColor = String(req.body.selectedColor || "");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "ACTIVE") throw new AppError(404, "This product is not available.", "PRODUCT_UNAVAILABLE");
  if (quantity > product.stock) throw new AppError(409, `Only ${product.stock} item(s) are available.`, "INSUFFICIENT_STOCK");
  if (product.sizes.length && !product.sizes.includes(selectedSize)) throw new AppError(400, "Select an available size.", "SIZE_REQUIRED");
  if (product.colors.length && !product.colors.includes(selectedColor)) throw new AppError(400, "Select an available color.", "COLOR_REQUIRED");
  const cart = (await getCart(req))!; const existing = await prisma.cartItem.findUnique({ where: { cartId_productId_selectedSize_selectedColor: { cartId: cart.id, productId, selectedSize, selectedColor } } });
  const nextQuantity = (existing?.quantity || 0) + quantity; if (nextQuantity > product.stock) throw new AppError(409, `Only ${product.stock} item(s) are available.`, "INSUFFICIENT_STOCK");
  if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } }); else await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity, selectedSize, selectedColor } });
  return success(res, "Added to cart.", await cartView(req, (await getCart(req))!), 201);
}));
commerceRouter.patch("/cart/items/:id", optionalAuth, asyncHandler(async (req, res) => {
  const cart = (await getCart(req))!; const item = cart.items.find((entry: any) => entry.id === req.params.id); if (!item) throw new AppError(404, "Cart item not found.", "NOT_FOUND");
  const quantity = Number(req.body.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.product.stock) throw new AppError(400, `Quantity must be between 1 and ${item.product.stock}.`, "INVALID_QUANTITY");
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } }); return success(res, "Cart updated.", await cartView(req, (await getCart(req))!));
}));
commerceRouter.delete("/cart/items/:id", optionalAuth, asyncHandler(async (req, res) => { const cart = (await getCart(req))!; if (!cart.items.some((item: any) => item.id === req.params.id)) throw new AppError(404, "Cart item not found.", "NOT_FOUND"); await prisma.cartItem.delete({ where: { id: req.params.id } }); return success(res, "Item removed.", await cartView(req, (await getCart(req))!)); }));
commerceRouter.delete("/cart", optionalAuth, asyncHandler(async (req, res) => { const cart = (await getCart(req))!; await prisma.cartItem.deleteMany({ where: { cartId: cart.id } }); return success(res, "Cart cleared.", await cartView(req, (await getCart(req))!)); }));

commerceRouter.post("/cart/apply-offer", optionalAuth, asyncHandler(async (req, res) => {
  const code = String(req.body.code || "").trim();
  if (!code) throw new AppError(400, "Offer code is required.", "OFFER_CODE_REQUIRED");
  const cart = (await getCart(req))!;
  let subtotal = 0; let baseDiscount = 0;
  const items = cart.items.map((item: any) => { const price = Number(item.product.price); const effectivePrice = item.product.salePrice == null ? price : Number(item.product.salePrice); subtotal += price * item.quantity; baseDiscount += (price - effectivePrice) * item.quantity; return { ...item, unitPrice: effectivePrice, product: item.product }; });
  
  // Resolve address: use explicit addressId, cart's delivery address, or fallback to user's default address
  let resolvedAddressId = req.body.addressId || cart.deliveryAddressId || undefined;
  const lat = req.body.lat ? Number(req.body.lat) : undefined;
  const lng = req.body.lng ? Number(req.body.lng) : undefined;
  
  if (!resolvedAddressId && req.auth?.id && lat == null) {
    let defaultAddr = await prisma.address.findFirst({ where: { userId: req.auth.id, isDefault: true } });
    if (!defaultAddr) defaultAddr = await prisma.address.findFirst({ where: { userId: req.auth.id } });
    if (defaultAddr) resolvedAddressId = defaultAddr.id;
  }
  
  const context: CartContext = { userId: cart.userId || undefined, addressId: resolvedAddressId, latitude: lat, longitude: lng, items, subtotal: subtotal - baseDiscount };
  const eligibility = await OfferEngine.evaluateOffer(code, context);
  if (!eligibility.eligible) throw new AppError(400, eligibility.message || "Not eligible", eligibility.code || "NOT_ELIGIBLE");
  await prisma.cart.update({ where: { id: cart.id }, data: { appliedOfferCode: eligibility.offerCode } });
  return success(res, "Offer applied.", await cartView(req, (await getCart(req))!));
}));

// Accept both DELETE and POST for remove-offer (frontend sends POST, original was DELETE)
async function removeOffer(req: any, res: any) {
  const cart = (await getCart(req))!;
  await prisma.cart.update({ where: { id: cart.id }, data: { appliedOfferCode: null } });
  return success(res, "Offer removed.", await cartView(req, (await getCart(req))!));
}
commerceRouter.delete("/cart/remove-offer", optionalAuth, asyncHandler(removeOffer));
commerceRouter.post("/cart/remove-offer", optionalAuth, asyncHandler(removeOffer));

commerceRouter.post("/cart/address", optionalAuth, asyncHandler(async (req, res) => {
  const addressId = req.body.addressId;
  const cart = (await getCart(req))!;
  // Clear the delivery option when address changes — customer must re-select
  // to ensure the chosen method is valid for the new address
  const addressChanged = cart.deliveryAddressId !== (addressId || null);
  await prisma.cart.update({
    where: { id: cart.id },
    data: {
      deliveryAddressId: addressId || null,
      // Reset delivery option only if address actually changed
      ...(addressChanged ? { deliveryOptionId: null } : {})
    }
  });
  return success(res, "Address applied to cart.", await cartView(req, (await getCart(req))!));
}));

commerceRouter.post("/cart/delivery-method", optionalAuth, asyncHandler(async (req, res) => {
  const methodId = String(req.body.method || "");
  const cart = (await getCart(req))!;
  await prisma.cart.update({ where: { id: cart.id }, data: { deliveryOptionId: methodId } });
  return success(res, "Delivery method updated.", await cartView(req, (await getCart(req))!));
}));

commerceRouter.get("/offers/available", optionalAuth, asyncHandler(async (req, res) => {
  const cart = (await getCart(req))!;
  let subtotal = 0; let baseDiscount = 0;
  const items = cart.items.map((item: any) => { const price = Number(item.product.price); const effectivePrice = item.product.salePrice == null ? price : Number(item.product.salePrice); subtotal += price * item.quantity; baseDiscount += (price - effectivePrice) * item.quantity; return { ...item, unitPrice: effectivePrice, product: item.product }; });
  
  // Resolve address: explicit query addressId, cart's delivery address OR user's default address
  let resolvedAddressId = (req.query.addressId as string) || cart.deliveryAddressId || undefined;
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;
  
  if (!resolvedAddressId && req.auth?.id && lat == null) {
    let defaultAddr = await prisma.address.findFirst({ where: { userId: req.auth.id, isDefault: true } });
    if (!defaultAddr) defaultAddr = await prisma.address.findFirst({ where: { userId: req.auth.id } });
    if (defaultAddr) resolvedAddressId = defaultAddr.id;
  }
  
  const context: CartContext = { userId: cart.userId || undefined, addressId: resolvedAddressId, latitude: lat, longitude: lng, items, subtotal: subtotal - baseDiscount };
  const offers = await OfferEngine.findAvailableOffers(context);
  return success(res, "Offers loaded.", offers);
}));

commerceRouter.get("/addresses", requireAuth, asyncHandler(async (req, res) => success(res, "Addresses loaded.", await prisma.address.findMany({ where: { userId: req.auth!.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }))));
commerceRouter.post("/addresses", requireAuth, asyncHandler(async (req, res) => {
  const input = addressSchema.parse(req.body);
  const address = await prisma.$transaction(async (tx: any) => { if (input.isDefault) await tx.address.updateMany({ where: { userId: req.auth!.id }, data: { isDefault: false } }); return tx.address.create({ data: { ...input, userId: req.auth!.id } }); });
  return success(res, "Address saved.", address, 201);
}));
commerceRouter.patch("/addresses/:id", requireAuth, asyncHandler(async (req, res) => {
  const input = addressSchema.parse(req.body); const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.auth!.id } }); if (!existing) throw new AppError(404, "Address not found.", "NOT_FOUND");
  const address = await prisma.$transaction(async (tx: any) => { if (input.isDefault) await tx.address.updateMany({ where: { userId: req.auth!.id }, data: { isDefault: false } }); return tx.address.update({ where: { id: existing.id }, data: input }); });
  return success(res, "Address updated.", address);
}));
commerceRouter.delete("/addresses/:id", requireAuth, asyncHandler(async (req, res) => { const result = await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.auth!.id } }); if (!result.count) throw new AppError(404, "Address not found.", "NOT_FOUND"); return success(res, "Address deleted.", {}); }));

commerceRouter.post("/checkout", optionalAuth, asyncHandler(async (req, res) => {
  const input = checkoutSchema.parse(req.body);
  if (!req.auth && !input.guest) throw new AppError(400, "Guest contact details are required.", "GUEST_DETAILS_REQUIRED");
  const prior = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } }); if (prior) return success(res, "Order already placed.", prior);
  // FIXED: Include categories so OfferEngine can evaluate category-based product rules
  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) } }, include: { images: { orderBy: { position: "asc" } }, categories: true } });
  if (products.length !== new Set(input.items.map((item) => item.productId)).size) throw new AppError(400, "One or more products no longer exist.", "PRODUCT_UNAVAILABLE");
  let settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }); 
  const taxRate = settings.taxRate / 100;
  let subtotal = 0; let discount = 0; let totalTax = 0; let exclusiveTaxToAdd = 0;
  const orderItems = input.items.map((item: any) => { 
    const product = products.find((entry: any) => entry.id === item.productId)!; 
    if (product.status !== "ACTIVE" || product.stock < item.quantity) throw new AppError(409, `${product.name} does not have enough stock.`, "INSUFFICIENT_STOCK"); 
    if (product.sizes.length && !product.sizes.includes(item.selectedSize || "")) throw new AppError(400, `Select a valid size for ${product.name}.`, "INVALID_VARIANT"); 
    if (product.colors.length && !product.colors.includes(item.selectedColor || "")) throw new AppError(400, `Select a valid color for ${product.name}.`, "INVALID_VARIANT"); 
    const regular = Number(product.price); 
    const unit = product.salePrice == null ? regular : Number(product.salePrice); 
    const lineTotal = unit * item.quantity;
    subtotal += lineTotal; 
    discount += (regular - unit) * item.quantity; 
    
    let itemTax = 0;
    if (product.taxMode === "EXCLUSIVE") {
      itemTax = lineTotal * taxRate;
      exclusiveTaxToAdd += itemTax;
    } else {
      itemTax = lineTotal - (lineTotal / (1 + taxRate));
    }
    totalTax += itemTax;

    return { productId: product.id, productNameSnapshot: product.name, productImageSnapshot: product.thumbnail || product.images[0]?.url || "", selectedSize: item.selectedSize || "", selectedColor: item.selectedColor || "", quantity: item.quantity, unitPriceSnapshot: unit, discountSnapshot: regular - unit }; 
  });
  let addressId: string | undefined; let address: Record<string, unknown>;
  // FIXED: Capture resolved address coordinates for server-side location validation
  let resolvedLat: number | undefined;
  let resolvedLng: number | undefined;
  if (input.addressId) { if (!req.auth) throw new AppError(400, "Sign in to use a saved address.", "AUTH_REQUIRED"); const saved = await prisma.address.findFirst({ where: { id: input.addressId, userId: req.auth.id } }); if (!saved) throw new AppError(404, "Delivery address not found.", "NOT_FOUND"); addressId = saved.id; address = saved as unknown as Record<string, unknown>; if (saved.latitude != null) resolvedLat = saved.latitude; if (saved.longitude != null) resolvedLng = saved.longitude; }
  else { address = input.shippingAddress!; resolvedLat = (input.shippingAddress as any)?.latitude ?? undefined; resolvedLng = (input.shippingAddress as any)?.longitude ?? undefined; }
  const afterBaseDiscount = subtotal;

  // ----- SHIPPING via Central ShippingPricingService -----
  const shippingCtx = {
    subtotalBeforeDiscount: subtotal,
    subtotalAfterDiscount: afterBaseDiscount,
    addressId: addressId,
    lat: resolvedLat,
    lng: resolvedLng
  };

  const deliveryOptionsResult = await ShippingPricingService.calculateOptions(shippingCtx);

  let selectedOption: any = null;
  const requestedDeliveryOptionId = (input as any).deliveryOptionId;

  if (!requestedDeliveryOptionId) {
    // Security: customer MUST explicitly select a shipping method before placing an order.
    // We do NOT auto-select a default — that would allow customers to bypass the delivery step.
    throw new AppError(400, "Please select a delivery method to continue.", "SHIPPING_METHOD_REQUIRED");
  }

  selectedOption = deliveryOptionsResult.find((o: any) => o.id === requestedDeliveryOptionId && o.available);
  if (!selectedOption) throw new AppError(400, "The selected delivery method is not available for this address.", "SHIPPING_OPTION_NOT_AVAILABLE");

  if (!selectedOption) throw new AppError(400, "No available delivery options for this address.", "NO_SHIPPING_OPTION_AVAILABLE");

  // Evaluate offer
  let offerDiscount = 0;
  let offerRedemptionData: any = null;
  let deliveryPromoDiscount = 0;

  if ((input as any).offerCode) {
    // FIXED: Pass full product objects and resolved address coordinates.
    // product: null would cause product/category rules to silently pass.
    // resolvedLat/resolvedLng ensure location validation fires even for guest checkout.
    const context: CartContext = {
      userId: req.auth?.id,
      addressId: addressId,
      latitude: resolvedLat,
      longitude: resolvedLng,
      items: orderItems.map((oi: any) => ({
        productId: oi.productId,
        quantity: oi.quantity,
        unitPrice: oi.unitPriceSnapshot,
        product: products.find((p: any) => p.id === oi.productId) || null
      })),
      subtotal: afterBaseDiscount
    };
    const eligibility = await OfferEngine.evaluateOffer((input as any).offerCode, context);
    if (!eligibility.eligible) throw new AppError(400, eligibility.message || "Offer not eligible", eligibility.code || "OFFER_NOT_ELIGIBLE");
    offerDiscount = eligibility.discountAmount || 0;
    if (eligibility.discountType === "FREE_DELIVERY") deliveryPromoDiscount = selectedOption.speedSurcharge + selectedOption.breakdown.effectiveBaseShipping;
    offerRedemptionData = {
      offerId: eligibility.offerId!,
      userId: req.auth?.id,
      offerCode: eligibility.offerCode!,
      offerName: eligibility.offerName!,
      discountType: eligibility.discountType || "FIXED",
      discountValue: eligibility.discountValue || 0,
      actualDiscountAmount: offerDiscount,
      maximumDistanceKm: eligibility.maximumDistanceKm,
      actualDistanceKm: eligibility.distanceKm,
      storeId: eligibility.storeId,
      deliveryAddressId: addressId,
      eligibilityResult: JSON.stringify(eligibility)
    };
  }

  // Recalculate shipping with offer discount applied (re-evaluate free shipping basis AFTER_DISCOUNT)
  const shippingSettings = await ShippingPricingService.getSettings();
  const finalMerchandiseSubtotal = Math.max(0, afterBaseDiscount - offerDiscount);
  const finalShippingCtx = {
    subtotalBeforeDiscount: subtotal,
    subtotalAfterDiscount: finalMerchandiseSubtotal,
    addressId: addressId
  };
  const shippingBreakdown = ShippingPricingService.calculateBreakdown(
    shippingSettings,
    finalShippingCtx,
    selectedOption.speedSurcharge,
    selectedOption.isDefault,
    deliveryPromoDiscount
  );
  const shippingCharge = shippingBreakdown.finalShippingFee;
  
  const discountProportion = subtotal > 0 ? (finalMerchandiseSubtotal / subtotal) : 1;
  const tax = totalTax * discountProportion;
  const finalExclusiveTaxToAdd = exclusiveTaxToAdd * discountProportion;
  const grandTotal = finalMerchandiseSubtotal + finalExclusiveTaxToAdd + shippingCharge;
  
  const created = await prisma.$transaction(async (tx: any) => {
    for (const item of input.items) { const product = products.find((entry: any) => entry.id === item.productId)!; const updated = await tx.product.updateMany({ where: { id: product.id, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } }); if (!updated.count) throw new AppError(409, `${product.name} stock changed during checkout.`, "INSUFFICIENT_STOCK"); const after = product.stock - item.quantity; await tx.inventoryMovement.create({ data: { productId: product.id, type: "ORDER", quantity: -item.quantity, before: product.stock, after, reason: "Customer order" } }); if (after === 0) await tx.product.update({ where: { id: product.id }, data: { status: "OUT_OF_STOCK" } }); }
    const orderNumber = `SS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const orderData: any = {
      orderNumber, customerId: req.auth?.id, addressId,
      guestName: input.guest?.name, guestEmail: input.guest?.email, guestPhone: input.guest?.phone,
      idempotencyKey: input.idempotencyKey,
      subtotal, discount: offerDiscount, shippingCharge, tax, grandTotal,
      // Shipping breakdown snapshot (immutable historical record)
      baseShippingFeeSnapshot: shippingBreakdown.baseShippingFee,
      freeShippingDiscountSnapshot: shippingBreakdown.freeShippingDiscount,
      speedSurchargeSnapshot: shippingBreakdown.speedSurcharge,
      finalShippingFeeSnapshot: shippingBreakdown.finalShippingFee,
      freeShippingThresholdSnapshot: shippingBreakdown.freeShippingThreshold,
      shippingAddressSnapshot: JSON.stringify(address),
      paymentMethod: input.paymentMethod,
      deliverySnapshot: JSON.stringify({
        ...selectedOption,
        shippingBreakdown
      }),
      customerNote: input.customerNote,
      items: { create: orderItems }
    };
    if (offerRedemptionData) orderData.offerRedemptions = { create: [offerRedemptionData] };
    const createdOrder = await tx.order.create({ data: orderData, include: { items: true, offerRedemptions: true } });
    
    // Enqueue order placement emails (Transactional Outbox)
    const settings = await tx.storeSettings.findUnique({ where: { id: 1 } });
    const customerEmail = input.guest?.email || req.auth?.email; // Need to ensure auth email is accessible or fetched. Assuming req.auth.email exists or we fetch it.
    
    let toEmail = input.guest?.email;
    if (!toEmail && req.auth?.id) {
      const user = await tx.user.findUnique({ where: { id: req.auth.id } });
      toEmail = user?.email;
    }

    if (toEmail) {
      await enqueueEmailJob(tx, "ORDER_PLACED", toEmail, "order_placed", createdOrder);
    }

    if (settings?.adminAlertsEnabled && settings?.adminNotificationEmails) {
      const adminEmails = settings.adminNotificationEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
      for (const adminEmail of adminEmails) {
        await enqueueEmailJob(tx, "ORDER_PLACED_ADMIN", adminEmail, "admin_new_order_alert", createdOrder);
      }
    }

    return createdOrder;
  }, { maxWait: 15000, timeout: 15000 });
  const cart = await getCart(req, false); if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return success(res, "Order placed successfully.", created, 201);
}));

commerceRouter.get("/orders", requireAuth, asyncHandler(async (req, res) => success(res, "Orders loaded.", await prisma.order.findMany({ where: { customerId: req.auth!.id }, include: { items: true, offerRedemptions: true, cancellation: true, returns: { include: { items: true, history: { orderBy: { createdAt: "asc" } } } }, refunds: true }, orderBy: { createdAt: "desc" } }))));
commerceRouter.get("/orders/:id", requireAuth, asyncHandler(async (req, res) => { const order = await prisma.order.findFirst({ where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }], customerId: req.auth!.id }, include: { items: true, offerRedemptions: true, cancellation: true, returns: { include: { items: true, history: { orderBy: { createdAt: "asc" } } } }, refunds: true } }); if (!order) throw new AppError(404, "Order not found.", "NOT_FOUND"); return success(res, "Order loaded.", order); }));
commerceRouter.post("/orders/:id/cancellation", requireAuth, asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || "").trim(); if (reason.length < 3) throw new AppError(400, "Please provide a cancellation reason.", "VALIDATION_ERROR");
  const order = await prisma.order.findFirst({ where: { id: req.params.id, customerId: req.auth!.id } }); if (!order) throw new AppError(404, "Order not found.", "NOT_FOUND"); if (!(["PENDING", "CONFIRMED", "PROCESSING", "PACKED"] as string[]).includes(order.orderStatus)) throw new AppError(409, "This order can no longer be cancelled.", "CANCELLATION_NOT_ALLOWED");
  const request = await prisma.$transaction(async (tx: any) => { const cancellation = await tx.cancellationRequest.create({ data: { orderId: order.id, reason } }); await tx.order.update({ where: { id: order.id }, data: { orderStatus: "CANCEL_REQUESTED" } }); return cancellation; }); return success(res, "Cancellation requested.", request, 201);
}));
commerceRouter.post("/orders/:id/returns", requireAuth, asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || "").trim(); const description = String(req.body.description || "").trim(); const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
  const order = await prisma.order.findFirst({ where: { id: req.params.id, customerId: req.auth!.id }, include: { items: true } }); if (!order) throw new AppError(404, "Order not found.", "NOT_FOUND"); if (order.orderStatus !== "DELIVERED") throw new AppError(409, "Returns are available only after delivery.", "RETURN_NOT_ALLOWED");
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } }); 
  if (settings && settings.returnsEnabled === false) throw new AppError(409, "Returns are currently disabled for this store.", "RETURNS_DISABLED");
  const windowMins = settings?.returnWindowMinutes || 10080; if (Date.now() - order.updatedAt.getTime() > windowMins * 60000) throw new AppError(409, "The return period has ended.", "RETURN_PERIOD_ENDED"); if (reason.length < 3 || description.length < 5 || !requestedItems.length) throw new AppError(400, "Select items and provide return details.", "VALIDATION_ERROR");
  const items = requestedItems.map((entry: any) => { const item = order.items.find((value: any) => value.id === entry.orderItemId); const quantity = Number(entry.quantity); if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) throw new AppError(400, "Invalid return item quantity.", "VALIDATION_ERROR"); return { orderItemId: item.id, quantity }; });
  const request = await prisma.$transaction(async (tx: any) => {
    const created = await tx.returnRequest.create({
      data: {
        returnNumber: `RET-${randomUUID().slice(0, 10).toUpperCase()}`,
        orderId: order.id,
        reason,
        description,
        evidence: JSON.stringify(Array.isArray(req.body.evidence) ? req.body.evidence.map(String) : []),
        items: { create: items }
      },
      include: { items: true }
    });
    
    await tx.returnStatusHistory.create({
      data: {
        returnRequestId: created.id,
        status: "RETURN_REQUESTED",
        actorType: "CUSTOMER",
        actorId: req.auth!.id
      }
    });
    
    await tx.order.update({ where: { id: order.id }, data: { orderStatus: "RETURN_REQUESTED" } });
    
    if (settings?.adminAlertsEnabled && settings?.adminNotificationEmails) {
      const adminEmails = settings.adminNotificationEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
      for (const adminEmail of adminEmails) {
        await enqueueEmailJob(tx, "RETURN_REQUESTED_ADMIN", adminEmail, "admin_new_return_alert", {
          ...created,
          customerName: order.guestName || "Customer"
        });
      }
    }

    return created;
  });
  return success(res, "Return requested.", request, 201);
}));
