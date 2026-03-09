export interface OnboardingStaffUserRequest {
  fullName: string;
  email: string;
  password: string;
  role: string;
}

export interface OnboardingProductRequest {
  name: string;
  description?: string | null;
  price: number;
  isActive: boolean;
  isAvailable: boolean;
  sort: number;
  imageUrl?: string | null;
}

export interface OnboardingCategoryRequest {
  name: string;
  sort: number;
  products: OnboardingProductRequest[];
}

export interface CreateRestaurantOnboardingRequest {
  name: string;
  slug: string;
  countryCode: string;
  currency: string;
  timeZone: string;
  taxRate: number;
  enableDineIn: boolean;
  enableDelivery: boolean;
  enableDeliveryCash: boolean;
  enableDeliveryCard: boolean;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  initialTablesCount: number;
  staffUsers: OnboardingStaffUserRequest[];
  categories: OnboardingCategoryRequest[];
}

export interface CreateRestaurantOnboardingResponse {
  restaurantId: string;
  name: string;
  slug: string;
  adminEmail: string;
  tablesCreated: number;
  categoriesCreated: number;
  productsCreated: number;
  staffUsersCreated: number;
}
