
export class ImageService {
  private static readonly MAX_FILE_SIZE = 20 * 1024 * 1024;

  private static readonly SUPPORTED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  static validate(file: File): string | null {
    if (!this.SUPPORTED_TYPES.includes(file.type)) {
      return "Unsupported image format. Use JPG, PNG or WEBP.";
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return "Image is too large. Maximum size is 20 MB.";
    }

    return null;
  }

  static formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
