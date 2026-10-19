export interface Category { id: string; name: string; slug: string; description: string }
export interface Product { id: string; slug: string; name: string; shortDescription: string; description: string; brand: string; sku: string; price: string; salePrice: string | null; stock: number; status: string; featured: boolean; thumbnail: string; sizes: string[]; colors: string[]; shippingInfo: string; returnPolicy: string; categories: Category[]; images: { id: string; url: string; alt: string }[]; averageRating?: number | string; ratingCount?: number; reviewCount?: number }

export type User = { id: string; name: string; email: string; phone: string | null; role: string; emailVerified?: boolean };

export interface ReviewImageItem { id: string; url: string }
export interface ReviewReplyItem { id: string; text: string; createdAt: string }

export interface Review {
  id: string;
  productId?: string;
  customerId?: string;
  customerName?: string;
  rating: number;
  title: string;
  comment: string;
  isVerified: boolean;
  isVerifiedPurchase?: boolean;
  purchasedSize?: string;
  purchasedColor?: string;
  sizePurchased?: string;
  colorPurchased?: string;
  fit?: string;
  fabricQuality?: string;
  comfort?: string;
  fitFeedback?: string;
  fabricFeedback?: string;
  comfortFeedback?: string;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulVotes?: number;
  notHelpfulVotes?: number;
  createdAt: string;
  updatedAt?: string;
  author: string;
  isOwnReview: boolean;
  userVote: "HELPFUL" | "NOT_HELPFUL" | null;
  images: ReviewImageItem[];
  replies?: ReviewReplyItem[];
  status?: string;
}

export interface RatingSummary {
  averageRating: number;
  totalRatings: number;
  verifiedBuyerRatings: number;
  ratingLabel: string;
  stars: { 1: number; 2: number; 3: number; 4: number; 5: number };
  starPercentages: { 1: number; 2: number; 3: number; 4: number; 5: number };
  totalReviewsWithText: number;
  totalReviewsWithPhotos: number;
  attributes: {
    fit: { label: string; count: number; percentage: number }[];
    fabricQuality: { label: string; count: number; percentage: number }[];
    comfort: { label: string; count: number; percentage: number }[];
  };
}

export interface ReviewEligibility {
  canReview?: boolean;
  isDeliveredBuyer?: boolean;
  hasExistingReview?: boolean;
  isEligible?: boolean;
  hasPurchased?: boolean;
  isDelivered?: boolean;
  orderNumber?: string | null;
  existingReview?: {
    id: string;
    rating: number;
    title?: string;
    comment?: string;
    fit?: string;
    fabricQuality?: string;
    comfort?: string;
    purchasedSize?: string;
    purchasedColor?: string;
    images?: ReviewImageItem[];
    createdAt?: string;
  } | null;
  purchasedSize?: string;
  purchasedColor?: string;
  orderId?: string | null;
  orderItemId?: string | null;
}

export interface CustomerPhotoItem {
  id: string;
  url: string;
  reviewId: string;
  rating: number;
  title?: string;
  reviewTitle?: string;
  comment?: string;
  author: string;
  customerName?: string;
  createdAt: string;
}

export interface MyReviewItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productThumbnail: string;
  productPrice: number | string;
  rating: number;
  title: string;
  comment: string;
  status: string;
  isVerified: boolean;
  purchasedSize?: string | null;
  purchasedColor?: string | null;
  fit?: string | null;
  fabricQuality?: string | null;
  comfort?: string | null;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt?: string;
  images: { id: string; url: string }[];
  replies?: { id: string; text: string; createdAt: string }[];
  orderNumber?: string | null;
  deliveredAt?: string | null;
}

export interface EligibleReviewItem {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  deliveredAt: string;
  productId: string;
  productName: string;
  productSlug: string;
  productThumbnail: string;
  productPrice: number | string;
  selectedSize?: string;
  selectedColor?: string;
  hasReview: boolean;
  review?: {
    id: string;
    rating: number;
    title: string;
    comment: string;
    status: string;
    createdAt: string;
    images: { id: string; url: string }[];
  } | null;
}
export interface CartItem { id: string; quantity: number; selectedSize: string; selectedColor: string; unitPrice: number; lineTotal: number; product: Product }
export interface Cart { id: string; items: CartItem[]; appliedOfferCode?: string | null; appliedOffer?: any; totals: { subtotal: number; discount: number; offerDiscount: number; shipping: number; tax: number; grandTotal: number }; shipping?: { baseShippingFee?: number; freeShippingThreshold?: number; freeShippingEligible?: boolean; effectiveBaseShipping?: number; shippingStatus?: "NOT_SELECTED" | "CONFIRMED"; selectedOptionBreakdown?: any; [key: string]: any }; currency: string; deliveryOptionId?: string | null; deliveryOptions?: any[]; deliveryAddressId?: string | null }

export interface Address { id?: string; fullName: string; phone: string; line1: string; line2: string; landmark: string; town: string; city: string; district: string; state: string; pinCode: string; country: string; latitude: number | null; longitude: number | null; formattedAddress: string | null; isDefault: boolean }
export interface OrderItem { id: string; productId: string; productNameSnapshot: string; productImageSnapshot: string; selectedSize: string; selectedColor: string; quantity: number; unitPriceSnapshot: string; deliveredAt?: string | null; itemStatus?: string | null; }
export interface Order { id: string; orderNumber: string; createdAt: string; updatedAt: string; subtotal: string; discount: string; shippingCharge: string; tax: string; grandTotal: string; shippingAddressSnapshot: Address; deliverySnapshot?: any; paymentMethod: string; paymentStatus: string; orderStatus: string; trackingNumber: string | null; courierName: string | null; deliveredAt?: string | null; items: OrderItem[]; cancellation?: { status: string; reason: string; adminResponse?: string }; returns?: { id: string; returnNumber: string; status: string; reason: string; adminResponse?: string; history?: { status: string; createdAt: string; note?: string }[] }[]; offerRedemptions?: { offerCode: string; offerName: string; discountType: string; discountValue: number; actualDiscountAmount: number }[] }
export interface StoreData { store: { email: string; phone: string; whatsapp: string; whatsappMessage: string; whatsappEnabled: boolean; currency: string; returnPolicy: string; cancellationPolicy: string; privacyPolicy: string; terms: string; isOpen: boolean; returnsEnabled: boolean; requireReturnReason: boolean; allowReturnComment: boolean; requirePhotoForDamage: boolean; allowPartialReturns: boolean; allowedReturnResolutions: string; returnExpiredMessage: string; returnWindowMinutes: number; socialProfiles: string }; branding: { storeName: string; logo: string; headerLogo: string; footerLogo: string; favicon: string; tagline: string; storeDescription: string; heroHeading: string; heroSubheading: string; heroImage: string; heroButtonText: string; heroButtonLink: string; promotionalBanner: string; newsletterHeading: string; newsletterText: string }; location: { branchName: string; line1: string; line2: string; landmark: string; city: string; district: string; state: string; country: string; pinCode: string; latitude: number | null; longitude: number | null; mapsUrl: string; placeId?: string } }
