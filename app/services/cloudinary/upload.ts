import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from "cloudinary";
import { config } from "~/config";
import {
  DONATION_RECEIPT_MAX_MB,
  DONATION_RECEIPT_MIME_TYPES,
  PATROCINADOR_LOGO_MAX_MB,
  PATROCINADOR_LOGO_MIME_TYPES,
  PROYECTO_FOTO_MAX_MB,
  PROYECTO_FOTO_MIME_TYPES,
} from "./fileConstraints";

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
});

/*==============================| Configuración |==============================*/

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UploadResult =
  | {
      success: true;
      data: { secure_url: string; public_id: string; version: number };
    }
  | { success: false; error: string };

/*==============================| Helpers internos |==============================*/
function validateFile(file: File): string | null {
  if (!file || file.size === 0) {
    return "No se recibió ningún archivo";
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Formato no permitido. Usa JPG, PNG o WEBP";
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `La imagen no debe superar los ${MAX_FILE_SIZE_MB}MB`;
  }
  return null;
}

function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error || !result) {
          return reject(
            error ?? new Error("Cloudinary no devolvió un resultado"),
          );
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

/*==============================| Foto de perfil de usuario |==============================*/
/**
 * Sube la foto de perfil de un usuario. Usa un public_id fijo ("avatar") con
 * overwrite: true para que cada usuario solo ocupe un slot de almacenamiento,
 * sin acumular versiones viejas.
 */
export async function uploadProfileImage(
  file: File,
  userId: string,
): Promise<UploadResult> {
  const validationError = validateFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadBuffer(buffer, {
      folder: `profile/${userId}`,
      public_id: "avatar",
      overwrite: true,
      invalidate: true,
      // Transformación fija: siempre el mismo string -> mismo derivado cacheado
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return {
      success: true,
      data: {
        secure_url: result.secure_url,
        public_id: result.public_id,
        version: result.version,
      },
    };
  } catch (error) {
    console.error("Error al subir foto de perfil a Cloudinary:", error);
    return { success: false, error: "Ocurrió un error al subir la imagen" };
  }
}

/*==============================| Comprobante de donación |==============================*/
/**
 * Sube el comprobante de una donación notificada por un donante. Acepta imagen
 * o PDF (`resource_type: "auto"`); no aplica transformaciones para no degradar
 * un documento que puede necesitar leerse tal cual. Cada donación tiene a lo
 * sumo un comprobante, así que se usa un public_id fijo con overwrite.
 */
export async function uploadDonationReceipt(
  file: File,
  donationId: string,
): Promise<UploadResult> {
  if (!file || file.size === 0) {
    return { success: false, error: "No se recibió ningún archivo" };
  }
  if (!DONATION_RECEIPT_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Formato no permitido. Usa JPG, PNG, WEBP o PDF",
    };
  }
  if (file.size > DONATION_RECEIPT_MAX_MB * 1024 * 1024) {
    return {
      success: false,
      error: `El comprobante no debe superar los ${DONATION_RECEIPT_MAX_MB}MB`,
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadBuffer(buffer, {
      folder: `donation-receipts/${donationId}`,
      public_id: "receipt",
      overwrite: true,
      invalidate: true,
      resource_type: "auto",
    });

    return {
      success: true,
      data: {
        secure_url: result.secure_url,
        public_id: result.public_id,
        version: result.version,
      },
    };
  } catch (error) {
    console.error(
      "Error al subir comprobante de donación a Cloudinary:",
      error,
    );
    return {
      success: false,
      error: "Ocurrió un error al subir el comprobante",
    };
  }
}

/*==============================| Logotipo de patrocinador |==============================*/
/**
 * Sube el logotipo de un patrocinador. Un patrocinador tiene un solo logo, así
 * que se usa un public_id fijo con overwrite. Sin recorte a "fill" (un logo no
 * se debe recortar); solo se limita el tamaño.
 */
export async function uploadSponsorLogo(
  file: File,
  patrocinadorId: string | number,
): Promise<UploadResult> {
  if (!file || file.size === 0) {
    return { success: false, error: "No se recibió ningún archivo" };
  }
  if (!PATROCINADOR_LOGO_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Formato no permitido. Usa PNG, SVG, WEBP o JPG",
    };
  }
  if (file.size > PATROCINADOR_LOGO_MAX_MB * 1024 * 1024) {
    return {
      success: false,
      error: `El logotipo no debe superar los ${PATROCINADOR_LOGO_MAX_MB}MB`,
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadBuffer(buffer, {
      folder: `patrocinador/${patrocinadorId}`,
      public_id: "logo",
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    return {
      success: true,
      data: {
        secure_url: result.secure_url,
        public_id: result.public_id,
        version: result.version,
      },
    };
  } catch (error) {
    console.error(
      "Error al subir logotipo de patrocinador a Cloudinary:",
      error,
    );
    return { success: false, error: "Ocurrió un error al subir el logotipo" };
  }
}

/*==============================| Fotos de proyecto (antes/durante/después) |==============================*/
/**
 * Sube la foto de una etapa (antes/durante/después) de un proyecto. Usa un
 * public_id determinista por (proyecto, etapa) con overwrite: así "reemplazar"
 * la foto de una etapa pisa el mismo asset y no hay que limpiar el anterior.
 * @param categorySlug "antes" | "durante" | "despues"
 */
export async function uploadProjectPhoto(
  file: File,
  proyectoId: string | number,
  categorySlug: string,
): Promise<UploadResult> {
  if (!file || file.size === 0) {
    return { success: false, error: "No se recibió ningún archivo" };
  }
  if (!PROYECTO_FOTO_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Formato no permitido. Usa JPG, PNG o WEBP",
    };
  }
  if (file.size > PROYECTO_FOTO_MAX_MB * 1024 * 1024) {
    return {
      success: false,
      error: `La foto no debe superar los ${PROYECTO_FOTO_MAX_MB}MB`,
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadBuffer(buffer, {
      folder: `proyecto/${proyectoId}`,
      public_id: categorySlug,
      overwrite: true,
      invalidate: true,
      transformation: [
        { width: 1600, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return {
      success: true,
      data: {
        secure_url: result.secure_url,
        public_id: result.public_id,
        version: result.version,
      },
    };
  } catch (error) {
    console.error("Error al subir foto de proyecto a Cloudinary:", error);
    return { success: false, error: "Ocurrió un error al subir la foto" };
  }
}

/*==============================| Fotos de mascotas |==============================*/
/**
 * Sube una foto de mascota. A diferencia del perfil, cada mascota puede tener
 * varias fotos, así que NO se sobrescribe: Cloudinary genera un public_id
 * único dentro de la carpeta de esa mascota.
 */
export async function uploadPetImage(
  file: File,
  petId: string | number,
): Promise<UploadResult> {
  const validationError = validateFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadBuffer(buffer, {
      folder: `pet/${petId}`,
      overwrite: false,
      transformation: [
        { width: 1600, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return {
      success: true,
      data: {
        secure_url: result.secure_url,
        public_id: result.public_id,
        version: result.version,
      },
    };
  } catch (error) {
    console.error("Error al subir foto de mascota a Cloudinary:", error);
    return { success: false, error: "Ocurrió un error al subir la imagen" };
  }
}
