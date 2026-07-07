interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  mimeType?: string;
}

type Preset = "thumb" | "card" | "full";

const PRESETS: Record<Preset, string> = {
  thumb: "c_fill,g_auto,w_150,h_150,f_auto,q_auto",
  card: "c_fill,g_auto,w_500,h_400,f_auto,q_auto",
  full: "c_fill,g_auto,w_1200,h_900,f_auto,q_auto",
};

export function petImageUrl(
  cloudName: string,
  publicId: string,
  preset: Preset = "card",
) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${PRESETS[preset]}/${publicId}`;
}

// Modificamos el tamaño de una imagen
export async function resizeImage(
  file: File,
  maxDim = 2200,
  quality = 0.85,
): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality),
  );
}

// Comprime usando canvas, reduce dimensiones y convierte a webp.
// Corre solo en cliente (createImageBitmap/canvas no existen en server).
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.75,
    mimeType = "image/webp",
  } = options;

  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, quality),
  );
  if (!blob) return file;

  // Si por alguna razón salió más pesado que el original, nos quedamos con el original
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: mimeType });
}
