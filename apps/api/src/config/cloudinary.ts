import { v2 as cloudinary } from "cloudinary";
import logger from "../lib/logger";

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  logger.warn("Cloudinary variables are missing. File uploads will fail.");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

/**
 * Extracts the public ID from a Cloudinary secure URL.
 * Example URL: https://res.cloudinary.com/cloudname/image/upload/v1234567890/folder/subfolder/image.png
 * Extracted public ID: folder/subfolder/image
 */
export function extractPublicId(url: string): string | null {
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    
    // remove the version (e.g. v1234567890/)
    const withoutVersion = parts[1].replace(/^v\d+\//, "");
    
    // remove the extension
    const lastDotIndex = withoutVersion.lastIndexOf(".");
    if (lastDotIndex === -1) return withoutVersion;
    
    return withoutVersion.substring(0, lastDotIndex);
  } catch (error) {
    logger.error("Error extracting public ID from Cloudinary URL", error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}
