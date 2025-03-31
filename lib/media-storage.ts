// This file has been renamed to media-storage.ts
// Contains types and browser-safe code

export enum MediaType {
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  MODEL = "model",
  OTHER = "other",
}

export interface MediaStorageOptions {
  userId?: string;
  provider: string;
  modelId?: string;
  prompt?: string;
  mediaType?: MediaType;
  fileExtension?: string;
}

/**
 * A browser-safe media storage service that only provides client-side functionality
 */
export class MediaStorageService {
  protected storageType: string;
  protected storagePath: string;

  constructor() {
    this.storageType = "local";
    this.storagePath = "./public/generated-media";
  }

  /**
   * Get the appropriate file extension for a media type
   */
  getFileExtension(mediaType: MediaType, customExtension?: string): string {
    if (customExtension) {
      return customExtension.startsWith(".") ? customExtension : `.${customExtension}`;
    }

    switch (mediaType) {
      case MediaType.IMAGE:
        return ".png";
      case MediaType.AUDIO:
        return ".mp3";
      case MediaType.VIDEO:
        return ".mp4";
      case MediaType.MODEL:
        return ".glb";
      default:
        return ".bin";
    }
  }

  /**
   * Get the full URL for a saved media file
   * @param mediaPath Path to the media file
   * @returns Full URL to access the media
   */
  getMediaUrl(mediaPath: string): string {
    if (this.storageType === "local") {
      // For local storage, we assume the path is relative to the public directory
      // and can be accessed directly through the web server
      return mediaPath;
    }

    // For future S3 implementation
    return mediaPath;
  }

  /**
   * Stub method for backward compatibility
   * This will only work server-side and will throw an error if called in the browser
   */
  async saveImage(base64Data: string, options: MediaStorageOptions): Promise<string> {
    throw new Error("saveImage() is only available on the server");
  }

  /**
   * Stub method for backward compatibility
   * This will only work server-side and will throw an error if called in the browser
   */
  async saveMedia(base64Data: string, options: MediaStorageOptions): Promise<string> {
    throw new Error("saveMedia() is only available on the server");
  }

  /**
   * Legacy method to get image URL (for backward compatibility)
   */
  getImageUrl(imagePath: string): string {
    return this.getMediaUrl(imagePath);
  }
}
