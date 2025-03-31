import fs from "fs";
import path from "path";
import { MediaStorageService, MediaType, MediaStorageOptions } from "../media-storage";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-only MediaStorageService implementation.
 * This file should only be imported in server components or API routes.
 */
export class ServerMediaStorageService extends MediaStorageService {
  protected storageType: string;
  protected storagePath: string;
  protected s3Client: S3Client | null = null;
  protected s3BucketName: string | null = null;
  protected s3StaticUrl: string | null = null;

  constructor() {
    super();
    // Support both new and old environment variable names for backward compatibility
    this.storageType = process.env.MEDIA_STORAGE_TYPE || process.env.IMAGE_STORAGE_TYPE || "local";
    this.storagePath =
      process.env.MEDIA_STORAGE_PATH || process.env.IMAGE_STORAGE_PATH || "./generated-media";

    // Initialize S3 client if using S3 storage
    if (this.storageType === "s3") {
      const region = process.env.AWS_REGION;
      this.s3BucketName = process.env.AWS_S3_BUCKET_NAME || null;
      this.s3StaticUrl = process.env.NEXT_PUBLIC_AWS_S3_STATIC_URL || null;

      if (!region || !this.s3BucketName) {
        throw new Error("AWS_REGION and AWS_S3_BUCKET_NAME must be set when using S3 storage");
      }

      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
      });
    } else if (this.storageType === "local") {
      // Ensure storage directory exists for local storage
      this.ensureDirectoryExists(this.storagePath);
    }
  }

  /**
   * Save media to storage
   * @param base64Data Base64 encoded data (without data prefix)
   * @param options Options including userId, provider info, etc.
   * @returns URL or path to the saved media file
   */
  async saveMedia(base64Data: string, options: MediaStorageOptions): Promise<string> {
    const { userId = "anonymous", provider, mediaType = MediaType.IMAGE, fileExtension } = options;

    switch (this.storageType) {
      case "local":
        return this.saveToLocalStorage(base64Data, userId, provider, mediaType, fileExtension);
      case "s3":
        return this.saveToS3Storage(base64Data, userId, provider, mediaType, fileExtension);
      default:
        throw new Error(`Unsupported storage type: ${this.storageType}`);
    }
  }

  /**
   * Save media to local filesystem
   */
  private async saveToLocalStorage(
    base64Data: string,
    userId: string,
    provider: string,
    mediaType: MediaType = MediaType.IMAGE,
    fileExtension?: string
  ): Promise<string> {
    // Create user-specific directory
    const userDir = path.join(this.storagePath, userId);
    this.ensureDirectoryExists(userDir);

    // Generate unique filename with media type prefix for easy identification
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = this.getFileExtension(mediaType, fileExtension);
    const filename = `${mediaType}-${provider}-${timestamp}-${uniqueId}${extension}`;
    const filePath = path.join(userDir, filename);

    // Save the file
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    // For media stored outside public directory, we need to serve it through an API endpoint
    return `/api/media/${userId}/${filename}`;
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Save media to S3 storage
   */
  private async saveToS3Storage(
    base64Data: string,
    userId: string,
    provider: string,
    mediaType: MediaType = MediaType.IMAGE,
    fileExtension?: string
  ): Promise<string> {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error("S3 client or bucket name not initialized");
    }

    // Generate unique filename with media type prefix for easy identification
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = this.getFileExtension(mediaType, fileExtension);
    const filename = `${mediaType}-${provider}-${timestamp}-${uniqueId}${extension}`;

    // Create S3 key with user ID for organization
    const s3Key = `${userId}/${filename}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: this.getContentType(mediaType, extension),
    });

    await this.s3Client.send(command);

    // Return a path that includes S3 identifier for later deletion
    return `/api/media/s3/${userId}/${filename}`;
  }

  /**
   * Get content type based on media type and extension
   */
  private getContentType(mediaType: MediaType, extension: string): string {
    switch (mediaType) {
      case MediaType.IMAGE:
        return extension === ".png"
          ? "image/png"
          : extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : extension === ".gif"
              ? "image/gif"
              : extension === ".webp"
                ? "image/webp"
                : "image/png";
      case MediaType.AUDIO:
        return extension === ".mp3"
          ? "audio/mpeg"
          : extension === ".wav"
            ? "audio/wav"
            : extension === ".ogg"
              ? "audio/ogg"
              : "audio/mpeg";
      case MediaType.VIDEO:
        return extension === ".mp4"
          ? "video/mp4"
          : extension === ".webm"
            ? "video/webm"
            : extension === ".ogg"
              ? "video/ogg"
              : "video/mp4";
      case MediaType.MODEL:
        return extension === ".glb"
          ? "model/gltf-binary"
          : extension === ".gltf"
            ? "model/gltf+json"
            : "application/octet-stream";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Delete a file from storage based on its media path
   * @param mediaPath The path to the media file
   * @returns true if deletion was successful, false otherwise
   */
  async deleteMedia(mediaPath: string): Promise<boolean> {
    try {
      if (mediaPath.startsWith("/api/media/s3/")) {
        // S3 storage path
        return this.deleteFromS3(mediaPath);
      } else if (mediaPath.startsWith("/api/media/")) {
        // Local storage path
        return this.deleteFromLocalStorage(mediaPath);
      } else {
        console.warn(`Unknown media path format: ${mediaPath}`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to delete media at ${mediaPath}:`, error);
      return false;
    }
  }

  /**
   * Delete a file from S3 storage
   */
  private async deleteFromS3(mediaPath: string): Promise<boolean> {
    if (!this.s3Client || !this.s3BucketName) {
      throw new Error("S3 client or bucket name not initialized");
    }

    // Extract S3 key from the media path
    // Format: /api/media/s3/userId/filename
    const pathParts = mediaPath.split("/");
    if (pathParts.length < 5) {
      console.warn(`Invalid S3 media path format: ${mediaPath}`);
      return false;
    }

    const userId = pathParts[4];
    const filename = pathParts.slice(5).join("/");
    const s3Key = `${userId}/${filename}`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.s3BucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
      console.log(`Deleted S3 file: ${s3Key}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete S3 file at ${s3Key}:`, error);
      return false;
    }
  }

  /**
   * Delete a file from local storage
   */
  private deleteFromLocalStorage(mediaPath: string): boolean {
    // Convert API path to actual file path
    // Format: /api/media/userId/filename
    const pathParts = mediaPath.split("/");
    if (pathParts.length < 4 || pathParts[1] !== "api" || pathParts[2] !== "media") {
      console.warn(`Invalid local media path format: ${mediaPath}`);
      return false;
    }

    const userId = pathParts[3];
    const filename = pathParts.slice(4).join("/");
    const filePath = path.join(this.storagePath, userId, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted local file: ${filePath}`);
      return true;
    } else {
      console.warn(`File not found: ${filePath}`);
      return false;
    }
  }

  /**
   * Get the full URL for a media file
   * @param mediaPath Path to the media file
   * @returns Full URL to access the media
   */
  /**
   * Get the storage type (local or s3)
   * @returns The storage type
   */
  getStorageType(): string {
    return this.storageType;
  }

  /**
   * Get the full URL for a media file
   * @param mediaPath Path to the media file
   * @param useProxy Whether to use the S3 proxy for S3 URLs (helps with CORS issues)
   * @returns Full URL to access the media
   */
  getMediaUrl(mediaPath: string, useProxy: boolean = false): string {
    if (this.storageType === "s3") {
      if (mediaPath.startsWith("/api/media/s3/")) {
        const pathParts = mediaPath.split("/");
        if (pathParts.length >= 5) {
          const userId = pathParts[4];
          const filename = pathParts.slice(5).join("/");

          // If useProxy is true, return a URL through our proxy API
          if (useProxy) {
            const proxyPath = `${userId}/${filename}`;
            const proxyUrl = `/api/media/s3-proxy/${proxyPath}`;
            console.log(`Generated S3 proxy URL: ${proxyUrl}`);
            return proxyUrl;
          }

          // Otherwise, if we have a static URL, generate a direct S3 URL
          if (this.s3StaticUrl) {
            // Ensure the s3StaticUrl doesn't have a trailing slash
            const cleanStaticUrl = this.s3StaticUrl.replace(/\/$/, "");

            const url = `${cleanStaticUrl}/${userId}/${filename}`;
            console.log(`Generated S3 URL: ${url}`);
            return url;
          }
        }
      }

      // If we don't have a static URL or the path doesn't match the expected format,
      // return the original path which will be handled by the API route
      return mediaPath;
    }

    // For local storage or if S3 static URL is not configured,
    // we'll serve through the API endpoint
    return mediaPath;
  }

  /**
   * Legacy method to save images (for backward compatibility)
   */
  async saveImage(base64Data: string, options: MediaStorageOptions): Promise<string> {
    return this.saveMedia(base64Data, {
      ...options,
      mediaType: MediaType.IMAGE,
      fileExtension: ".png",
    });
  }
}
