export interface AuthUser {
  id: string;
  restaurantId: string;
  fullName: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthUser;
}
