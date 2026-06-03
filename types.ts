export enum UserRole {
  CLIENT = 'CLIENT',
  RESTAURANT = 'RESTAURANT',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  RETURNING = 'RETURNING',
  RETURNED = 'RETURNED',
}

export type PaymentMethod = 'CREDIT_CARD' | 'PIX';

export interface UserAddress {
  id: string;
  label: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode?: string;
  complement?: string;
  reference?: string;
  coords: { lat: number; lng: number };
}

export interface SavedCard {
  id: string;
  token: string;
  last4: string;
  brand: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  businessName?: string;
  role: UserRole;
  cpf?: string;
  cnpj?: string;
  birthDate?: string;
  vehicleType?: string;
  licensePlate?: string;
  pixKey?: string;
  description?: string;
  workingHours?: string;
  asaasAccountId?: string;
  asaasCustomerId?: string;
  pushToken?: string;
  status: 'PENDING' | 'APPROVED' | 'BLOCKED';
  phoneNumber?: string;
  savedAddresses: UserAddress[];
  currentLocation?: { lat: number; lng: number };
  createdAt: number;
  lastOrderTimestamp?: number;
  averageRating?: number;
  ratingsCount?: number;
  commissionBalance?: number;
  avatarUrl?: string;
  customFeePct?: number;
  savedCards?: SavedCard[];
  favoriteRestaurantIds?: string[];
  driverTutorialSeen?: boolean;
}

// Horário estruturado por dia da semana
// day: 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sab
export interface DaySchedule {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string;   // "08:00"
  close: string;  // "22:00"
  closed: boolean;
}

// Variações de produto (ex: tamanho, adicionais)
export interface VariantOption {
  id: string;
  label: string;
  priceAdd: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  required: boolean;
  options: VariantOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  ownerPrice?: number;
  image: string;
  category?: string;
  available?: boolean;
  variants?: ProductVariant[];
}

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  rating: number;
  ratingsCount?: number;
  image: string;
  phoneNumber?: string;
  address?: string;
  coords: { lat: number; lng: number };
  menu: Product[];
  asaasAccountId?: string;
  deliveryFee?: number;
  minOrder?: number;
  isOpen?: boolean;
  openingHours?: DaySchedule[];
  promotions?: Promotion[];
}

export interface OrderItem {
  product: Product;
  quantity: number;
  selectedVariants?: Record<string, string>; // variantId -> optionId
  variantPriceAdd?: number;
}

export interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  driverNetEarnings: number;
  restaurantNetEarnings?: number;
  total: number;
  paymentMethod: PaymentMethod;
  changeFor?: number;
  paymentId?: string;
  asaasPaymentId?: string;
  pixQrCode?: string;
  pixQrCodeImage?: string;
  status: OrderStatus;
  customerAddress: string;
  customerName: string;
  customerId?: string;
  coords?: { lat: number; lng: number };
  timestamp: number;
  cancelledAt?: number;
  driverId?: string;
  pickupCode?: string;
  deliveryCode?: string;
  deliveryPhotoUrl?: string;
  rating?: OrderRating;
  feedback?: string;
  driverName?: string;
  customerPhone?: string;
  customerAvatarUrl?: string;
  failureReason?: string;
}

export interface OrderRating {
  storeStars: number;
  driverStars?: number;
  productOk: boolean;
  packagingOk: boolean;
  comment?: string;
}

export interface Promotion {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minOrderValue?: number;
  description?: string;
  validFrom: number;
  validUntil: number;
  isActive: boolean;
  usageCount?: number;
  maxUsage?: number;
  type?: 'PRODUCT_SPECIFIC' | 'MULTIPLE_PRODUCTS' | 'COUPON' | 'FREE_DELIVERY';
  productIds?: string[];
}

export interface PlatformSettings {
  platformFeePct: number;
  driverFeePct: number;
  restaurantFeePct: number;
  minDeliveryFee: number;
  minOrderValue: number;
}

// Retorna se um restaurante está aberto agora com base nos horários estruturados
export function isRestaurantOpenNow(restaurant: Restaurant): boolean {
  if (restaurant.openingHours && restaurant.openingHours.length > 0) {
    const now = new Date();
    const dayOfWeek = now.getDay() as DaySchedule['day'];
    const schedule = restaurant.openingHours.find(s => s.day === dayOfWeek);
    if (!schedule || schedule.closed) return false;
    const [openH, openM] = schedule.open.split(':').map(Number);
    const [closeH, closeM] = schedule.close.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;
    return nowMins >= openMins && nowMins < closeMins;
  }
  // Fallback para toggle manual
  return restaurant.isOpen !== false;
}
