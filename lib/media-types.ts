import { ProviderKey } from "./provider-config";
import { MediaType } from "./media-storage";

export interface GeneratedMedia {
  provider: ProviderKey;
  content: string | null; // Base64 data of the media content
  modelId?: string;
  mediaPath?: string; // Path where media is stored
  mediaUrl?: string; // URL to access the stored media
  mediaType: MediaType; // Type of media (image, audio, video)
}

// Instead of empty interface, use type alias
export type MediaResult = GeneratedMedia;

export interface MediaError {
  provider: ProviderKey;
  message: string;
}

export interface ProviderTiming {
  startTime: number;
  completionTime?: number;
  elapsed?: number;
}

// For backward compatibility - define image-specific interfaces
export interface GeneratedImage extends GeneratedMedia {
  image: string | null; // Alias for content
  imagePath?: string; // Alias for mediaPath
  imageUrl?: string; // Alias for mediaUrl
}

// For backward compatibility - use type alias instead of empty interface extension
export type ImageResult = GeneratedImage;

// For backward compatibility - use type alias
export type ImageError = MediaError;

// Re-export MediaType for convenience
export { MediaType };
