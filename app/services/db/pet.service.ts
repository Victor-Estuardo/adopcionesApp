import { pet, pet_images, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
type OmitField = "creation_date" | "creator_id" | "update_date" | "updater_id";
export type Pet = Omit<pet, OmitField>;
export type PetImage = Omit<pet_images, OmitField>;
export type PetWithImage = Pet & {
  pet_images: PetImage[];
  petSpecies?: { id: number; name: string };
};

/*==================================================| CREATE |==================================================*/
/*==================================================| LIST |==================================================*/
/**
 * Función para obtener la lista de mascotas con sus imagenes
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de mascotas obtenidos
 */
export const listPetsWithImagesDb = async (
  where?: Prisma.petWhereInput,
  skip?: number,
  take?: number,
): Promise<PrismaUtilResponse<PetWithImage[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet.findMany({
      where,
      skip,
      take,
      select: {
        status: true,
        birthdate: true,
        gender: true,
        id: true,
        name: true,
        pet_species_id: true,
        color: true,
        size: true,
        vaccinated: true,
        sterilized: true,
        description: true,
        race: true,
        pet_images: {
          select: {
            id: true,
            path: true,
            pet_id: true,
          },
        },
        petSpecies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener la lista de mascotas con sus imagenes
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de mascotas obtenidos
 */
export const getPetWithImagesDb = async (
  where?: Prisma.petWhereInput,
): Promise<PrismaUtilResponse<PetWithImage | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet.findFirst({
      where,
      select: {
        status: true,
        birthdate: true,
        gender: true,
        id: true,
        name: true,
        pet_species_id: true,
        color: true,
        size: true,
        vaccinated: true,
        sterilized: true,
        description: true,
        race: true,
        pet_images: {
          select: {
            id: true,
            path: true,
            pet_id: true,
          },
        },
      },
    });
  });
};

/*----------------------------------------------------------------------------------------------------------*/
/**
 * Función para obtener una sola mascota
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Informacion de mascota
 */
export const getPetDb = async (
  where?: Prisma.petWhereInput,
): Promise<PrismaUtilResponse<Pet | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet.findFirst({
      where,
      select: {
        status: true,
        birthdate: true,
        gender: true,
        id: true,
        name: true,
        pet_species_id: true,
        color: true,
        size: true,
        vaccinated: true,
        sterilized: true,
        description: true,
        race: true,
      },
    });
  });
};

/*==================================================| COUNT |==================================================*/
/**
 * Función para obtener la cantidad de mascotas
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Cantidad de mascotas obtenidos
 */
export const CountPetsDb = async (
  where?: Prisma.petWhereInput,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.pet.count({ where });
  });
};
