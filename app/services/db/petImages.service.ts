import { pet_images, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";
import { GetBatchResult } from "@prisma/client/runtime/library";

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear nuevas imagenes de una mascota
 * @param data Información de las imagenes
 * @returns
 */
export const createManyPetImagesDb = async (
  data: Prisma.pet_imagesUncheckedCreateInput[],
): Promise<PrismaUtilResponse<GetBatchResult>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet_images.createMany({ data });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener la lista de imagenes de mascotas
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de imagenes de mascotas
 */
export const listPetImagesDb = async (
  where?: Prisma.pet_imagesWhereInput,
): Promise<PrismaUtilResponse<pet_images[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet_images.findMany({
      where,
    });
  });
};

/*==================================================| DELETE |==================================================*/
/**
 * Función para eliminar imagenes de mascotas
 * @param where query para la eliminación
 * @returns respuesta de eliminación
 */
export const deleteManyPetImagesDb = async (
  where: Prisma.pet_imagesWhereInput,
): Promise<PrismaUtilResponse<GetBatchResult>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet_images.deleteMany({ where });
  });
};
