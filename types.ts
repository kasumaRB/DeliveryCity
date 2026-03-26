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

export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'CASH';

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
