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
