import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from "cloudinary";
import { config } from "~/config";

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

/*==============================| Fotos de mascotas |==============================*/
/**
 * Sube una foto de mascota. A diferencia del perfil, cada mascota puede tener
 * varias fotos, así que NO se sobrescribe: Cloudinary genera un public_id
 * único dentro de la carpeta de esa mascota.
 */
export async function uploadPetImage(
  file: File,
  petId: string,
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
        { width: 1000, crop: "limit" },
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
