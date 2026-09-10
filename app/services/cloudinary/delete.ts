import { v2 as cloudinary } from "cloudinary";
import { config } from "~/config";

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
});

/*==============================| Eliminar foto |==============================*/
/**
 * Elimina la foto con el siguiente id
 */
export async function deletePetImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}

/**
 * Elimina un asset de Cloudinary por su public_id. No lanza si el asset ya no
 * existe (destroy devuelve `{ result: "not found" }`).
 */
export async function deleteCloudinaryImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}
