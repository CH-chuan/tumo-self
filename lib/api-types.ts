import { ProviderKey } from "./provider-config";

export interface GenerateImageRequest {
  prompt: string;
  provider: ProviderKey;
  modelId: string;
  userId?: string; // Optional user ID for tracking who generated the image
}

export interface GenerateImageResponse {
  image?: string; // Base64 image data
  imagePath?: string; // Path to the stored image
  imageUrl?: string; // URL to access the stored image
  generationId?: string; // Database ID of the generation record
  error?: string;
}
