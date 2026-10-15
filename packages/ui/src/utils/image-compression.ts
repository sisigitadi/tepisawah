/**
 * @tepisawah/ui — Client-Side Image Compression to WebP.
 *
 * Prevents bloated database storage and high network latency by compressing
 * user-uploaded images in the browser before submitting to the backend.
 * Scales down dimensions to maximum bounding box (e.g., 1000px) and encodes
 * to modern WebP format with high visual fidelity (~40-80 KB).
 */

export interface CompressionResult {
  readonly dataUrl: string;
  readonly originalSize: number;
  readonly compressedSize: number;
  readonly width: number;
  readonly height: number;
  readonly savedPercent: number;
}

export interface CompressionOptions {
  readonly maxDimension?: number;
  readonly quality?: number;
}

export async function compressImageToWebP(
  file: File | Blob,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  const maxDim = options.maxDimension ?? 1000;
  const quality = options.quality ?? 0.82;
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
    reader.onload = (e) => {
      const srcUrl = e.target?.result as string;
      if (!srcUrl) {
        reject(new Error("File gambar kosong"));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak didukung"));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Gagal membuat konteks rendering canvas"));
          return;
        }

        // Clean white background for transparent images if converting
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to jpeg if unsupported
        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        // Calculate size from base64
        const head = dataUrl.indexOf(",") + 1;
        const b64 = dataUrl.slice(head);
        const compressedSize = Math.round((b64.length * 3) / 4);
        const savedPercent = originalSize > 0 
          ? Math.max(0, Math.round((1 - compressedSize / originalSize) * 100))
          : 0;

        resolve({
          dataUrl,
          originalSize,
          compressedSize,
          width,
          height,
          savedPercent,
        });
      };

      img.src = srcUrl;
    };

    reader.readAsDataURL(file);
  });
}
