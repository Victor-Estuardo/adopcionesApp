import { pet, pet_images, petSpecies, Prisma, savedPet } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type SavedPetWithPet = savedPet & {
  pet: pet & {
    petSpecies: petSpecies;
    pet_images: pet_images[];
  };
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para guardar una mascota
 * @param data Información de la mascota
 * @returns
 */
export const createSavedPetDb = async (
  data: Prisma.savedPetUncheckedCreateInput,
): Promise<PrismaUtilResponse<savedPet>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.savedPet.create({ data });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener información de guardado de una mascota
 * @param data Información de la mascota
 * @returns
 */
export const getSavedPetDb = async (
  where: Prisma.savedPetWhereInput,
): Promise<PrismaUtilResponse<savedPet | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.savedPet.findFirst({ where });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener información de guardado de mascotas
 * @param data Información de la mascota
 * @returns
 */
export const listSavedPetWithPetDb = async (
  where: Prisma.savedPetWhereInput,
  orderBy?: Prisma.savedPetOrderByWithAggregationInput,
): Promise<PrismaUtilResponse<SavedPetWithPet[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.savedPet.findMany({
      where,
      orderBy,
      include: {
        pet: {
          include: {
            petSpecies: true,
            pet_images: {
              take: 1,
              orderBy: { creation_date: "asc" },
            },
          },
        },
      },
    });
  });
};

/*==================================================| DELETE |==================================================*/
/**
 * Función para eliminar información de guardado de una mascota
 * @param data Información de la mascota
 * @returns
 */
export const deleteSavedPetDb = async (
  where: Prisma.savedPetWhereUniqueInput,
): Promise<PrismaUtilResponse<savedPet>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.savedPet.delete({ where });
  });
};

/*==================================================| COUNT |==================================================*/
/**
 * Función para obtener el conteo de guardados
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns conteo de los guardados
 */
export const countSavedpetDb = async (
  where?: Prisma.savedPetWhereInput,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.savedPet.count({
      where,
    });
  });
};
