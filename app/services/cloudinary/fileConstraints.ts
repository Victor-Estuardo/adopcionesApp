/**
 * Límites de archivo (tipos MIME permitidos + tamaño máximo en MB) de cada tipo
 * de subida del módulo de Donaciones.
 *
 */

/** Comprobante de depósito/transferencia: imagen o PDF. */
export const DONATION_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
export const DONATION_RECEIPT_MAX_MB = 5;

/** Logotipo de un patrocinador: imagen rasterizada o SVG, archivo chico. */
export const PATROCINADOR_LOGO_MIME_TYPES = [
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/jpeg",
];
export const PATROCINADOR_LOGO_MAX_MB = 2;

/** Foto de una etapa de un proyecto: solo imagen rasterizada. */
export const PROYECTO_FOTO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];
export const PROYECTO_FOTO_MAX_MB = 5;

/** Foto de una historia (Finales felices / Camino al arcoíris). */
export const STORY_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const STORY_IMAGE_MAX_MB = 5;
/** Máximo de fotos por historia (RN-06). */
export const STORY_MAX_IMAGES = 10;
