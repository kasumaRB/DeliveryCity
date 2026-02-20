
export enum UserRole {
  CLIENT = 'CLIENT',
  RESTAURANT = 'RESTAURANT',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
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
  vehicleType?: string;
  licensePlate?: string;
  birthDate?: string; 
  pixKey?: string; 
  pagseguroRecipientId?: string; // Added this line
  status: 'PENDING' | 'APPROVED' | 'BLOCKED'; 
  phoneNumber?: string;
  savedAddresses: UserAddress[]; 
  currentLocation?: { lat: number; lng: number }; 
  createdAt: number;
  lastOrderTimestamp?: number;
  averageRating?: number;
  ratingsCount?: number;
  commissionBalance?: number;
  commissionRate?: number;
  deliveryRate?: number;
  passwordPlain?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; 
  ownerPrice?: number; 
  image: string;
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
  pagseguroRecipientId?: string; // Added this line
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface OrderRating {
  storeStars: number;
  driverStars: number;
  productOk: boolean;
  packagingOk: boolean;
  comment?: string;
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
  status: OrderStatus;
  customerAddress: string; 
  customerName: string;
  customerId?: string;
  timestamp: number;
  driverId?: string; 
  offeredToDriverId?: string; 
  rejectedByDrivers: string[]; 
  pickupCode?: string; 
  deliveryCode?: string; 
  rating?: OrderRating;
}
