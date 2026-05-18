export enum UserRole {
  CLIENT = 'CLIENT',
  RESTAURANT = 'RESTAURANT',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';

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

// Cartão tokenizado salvo — NUNCA armazena número real, apenas token do PagSeguro
export interface SavedCard {
  id: string;           // UUID local para identificar o card salvo
  token: string;        // Token do PagSeguro (usado para cobrar sem redigitar)
  last4: string;        // Últimos 4 dígitos (ex: "1234") — só para exibição
  brand: string;        // Bandeira (ex: "VISA", "MASTER") — só para exibição
  holderName: string;   // Nome do titular — só para exibição
  expiryMonth: string;  // Mês de validade — só para exibição
  expiryYear: string;   // Ano de validade — só para exibição
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
  pagseguroRecipientId?: string;
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
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  ownerPrice?: number;
  image: string;
  category?: string;
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
  pagseguroRecipientId?: string;
  deliveryFee?: number;
  minOrder?: number;
  isOpen?: boolean;
  promotions?: Promotion[];
}

export interface OrderItem {
  product: Product;
  quantity: number;
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
  status: OrderStatus;
  customerAddress: string;
  customerName: string;
  customerId?: string;
  coords?: { lat: number; lng: number };
  timestamp: number;
  driverId?: string;
  pickupCode?: string;
  deliveryCode?: string;
  rating?: OrderRating;
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
