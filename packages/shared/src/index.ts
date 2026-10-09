import { z } from "zod";

export const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(8).max(72).regex(/[A-Z]/, "Include an uppercase letter").regex(/[a-z]/, "Include a lowercase letter").regex(/\d/, "Include a number");
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80), email: emailSchema,
  phone: z.string().trim().transform(v => v === "" ? undefined : v).pipe(z.string().min(7).max(20).optional()),
  password: passwordSchema
});

export const otpRequestSchema = z.object({ destination: z.string().trim().min(5).max(160), purpose: z.enum(["REGISTRATION", "PASSWORD_RESET", "EMAIL_VERIFICATION", "PHONE_VERIFICATION"]) });
export const otpVerifySchema = otpRequestSchema.extend({ code: z.string().regex(/^\d{6}$/) });
export const productSchema = z.object({
  name: z.string().trim().min(2).max(180), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), shortDescription: z.string().max(280).default(""),
  description: z.string().min(1), categories: z.array(z.string()).min(1, "Enter at least one category"), brand: z.string().default("SHADOW SHOP"), sku: z.string().trim().min(1).max(80),
  price: z.coerce.number().nonnegative(), salePrice: z.coerce.number().nonnegative().nullable().optional(), costPrice: z.coerce.number().nonnegative().nullable().optional(),
  stock: z.coerce.number().int().nonnegative(), lowStockThreshold: z.coerce.number().int().nonnegative().default(5), status: z.enum(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"]),
  featured: z.boolean().default(false), thumbnail: z.string().default(""), images: z.array(z.object({ url: z.string(), color: z.string().nullable().optional() })).default([]), sizes: z.array(z.string()).default([]), colors: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]), weight: z.coerce.number().nonnegative().nullable().optional(), shippingInfo: z.string().default(""), returnPolicy: z.string().default(""),
  hsnCode: z.string().nullable().optional(), taxProfileId: z.string().uuid().nullable().optional(), taxMode: z.enum(["INCLUSIVE", "EXCLUSIVE"]).default("INCLUSIVE")
}).refine((v) => v.salePrice == null || v.salePrice <= v.price, { message: "Sale price cannot exceed regular price", path: ["salePrice"] });
export const addressSchema = z.object({
  fullName: z.string().min(2), phone: z.string().min(7), line1: z.string().min(3), line2: z.string().default(""), landmark: z.string().default(""), town: z.string().min(2), city: z.string().min(2), district: z.string().min(2), state: z.string().min(2), pinCode: z.string().min(3), country: z.string().min(2),
  latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), formattedAddress: z.string().nullable().optional(), isDefault: z.boolean().default(false)
});
export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive(), selectedSize: z.string().optional(), selectedColor: z.string().optional() })).min(1),
  addressId: z.string().uuid().optional(), guest: z.object({ name: z.string().min(2), email: emailSchema, phone: z.string().min(7) }).optional(), shippingAddress: addressSchema.optional(),
  paymentMethod: z.enum(["COD"]), deliveryOptionId: z.string().uuid().optional(), customerNote: z.string().max(500).optional(), idempotencyKey: z.string().uuid(),
  offerCode: z.string().optional()
}).refine((v) => Boolean(v.addressId || v.shippingAddress), { message: "A delivery address is required" });
export const enquirySchema = z.object({ name: z.string().min(2), email: emailSchema, phone: z.string().optional(), subject: z.string().min(2), message: z.string().min(10).max(3000) });

export type ProductInput = z.infer<typeof productSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ApiResponse<T> = { success: boolean; message: string; data?: T; error?: { code: string; fields?: unknown } };

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCEL_REQUESTED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCEL_REQUESTED", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCEL_REQUESTED", "CANCELLED"], PACKED: ["SHIPPED", "CANCEL_REQUESTED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"], OUT_FOR_DELIVERY: ["DELIVERED"], DELIVERED: ["RETURN_REQUESTED"], CANCEL_REQUESTED: ["CANCELLED", "CONFIRMED"],
  RETURN_REQUESTED: ["RETURN_APPROVED", "RETURN_REJECTED"], RETURN_APPROVED: ["RETURN_PICKUP_PENDING"], RETURN_PICKUP_PENDING: ["RETURN_PICKED_UP"],
  RETURN_PICKED_UP: ["RETURN_RECEIVED"], RETURN_RECEIVED: ["REFUND_PENDING"], REFUND_PENDING: ["REFUNDED"],
  CANCELLED: [], RETURN_REJECTED: [], REFUNDED: []
};
