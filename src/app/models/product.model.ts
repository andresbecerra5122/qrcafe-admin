export interface OpsProduct {
  id: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  categoryPrepStation: string;
  prepStation: string;
  price: number;
  isAvailable: boolean;
  isActive: boolean;
  imageUrl: string | null;
  sort: number;
}
