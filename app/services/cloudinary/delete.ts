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

/*==============================| Eliminar foto |==============================*/
/**
 * Elimina la foto con el siguiente id
 */
export async function deletePetImage(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}
