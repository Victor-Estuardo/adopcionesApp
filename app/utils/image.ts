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

export type StoryImagePreset =
  | "storyThumb"
  | "storyCard"
  | "storyCover"
  | "storyOg";

const STORY_PRESETS: Record<StoryImagePreset, string> = {
  storyThumb: "c_fill,g_auto,w_120,h_120,f_auto,q_auto", // miniatura del admin
  storyCard: "c_fill,g_auto,w_640,h_400,f_auto,q_auto", // tarjeta 16:10
  storyCover: "c_fill,g_auto,w_1600,h_900,f_auto,q_auto", // portada del detalle
  // Vista previa al compartir: JPG fijo (WhatsApp/Facebook no siempre
  // procesan WebP/AVIF, que es lo que f_auto podría entregar).
  storyOg: "c_fill,g_auto,w_1200,h_630,f_jpg,q_auto",
};

/** Dimensiones de cada preset (para `width`/`height` y `og:image:*`). */
export const STORY_IMAGE_SIZES: Record<
  StoryImagePreset,
  { width: number; height: number }
> = {
  storyThumb: { width: 120, height: 120 },
  storyCard: { width: 640, height: 400 },
  storyCover: { width: 1600, height: 900 },
  storyOg: { width: 1200, height: 630 },
};

export function storyImageUrl(
  cloudName: string,
  publicId: string,
  preset: StoryImagePreset = "storyCard",
) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${STORY_PRESETS[preset]}/${publicId}`;
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
