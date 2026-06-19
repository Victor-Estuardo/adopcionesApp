import {
  adoptionApplication,
  applicationAnswer,
  commitmentAgreement,
  formQuestion,
  pet,
  pet_images,
  petSpecies,
  Prisma,
} from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type AdoptionAppAllInfo = adoptionApplication & {
  pet: pet & { pet_images: pet_images[] };
  other_applicationAnswer: (applicationAnswer & {
    formQuestion: formQuestion;
  })[];
  commitmentAgreement: commitmentAgreement[];
};

export type ListApplicationWithPet = adoptionApplication & {
  pet: pet & {
    petSpecies: petSpecies;
    pet_images: pet_images[];
  };
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear una nueva aplicación a adopción
 * @param data Información de la aplicación
 * @returns
 */
export const createAdoptionApplicationDb = async (
  data: Prisma.adoptionApplicationUncheckedCreateInput,
): Promise<PrismaUtilResponse<adoptionApplication>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.adoptionApplication.create({ data });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener una aplicación a adopcion
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Objeto encontrado
 */
export const getAdoptionApplicationDb = async (
  where?: Prisma.adoptionApplicationWhereInput,
): Promise<PrismaUtilResponse<adoptionApplication | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.adoptionApplication.findFirst({
      where,
    });
  });
};

/*------------------------------------------------------------------------------------------------------*/
/**
 * Función para obtener una aplicación a adopcion
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Objeto encontrado
 */
export const getAdoptionApplicationAllInfoDb = async (
  where?: Prisma.adoptionApplicationWhereInput,
): Promise<PrismaUtilResponse<AdoptionAppAllInfo | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.adoptionApplication.findFirst({
      where,
      include: {
        pet: {
          include: { pet_images: true },
        },
        other_applicationAnswer: {
          include: { formQuestion: true },
          orderBy: { formQuestion: { sort_order: "asc" } },
        },
        commitmentAgreement: true,
      },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener una lista de aplicación a adopcion
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista encontrada
 */
export const listAdoptionApplicationWithPetDb = async (
  where?: Prisma.adoptionApplicationWhereInput,
  orderBy?: Prisma.adoptionApplicationOrderByWithRelationInput,
): Promise<PrismaUtilResponse<ListApplicationWithPet[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.adoptionApplication.findMany({
      where,
      orderBy,
      include: { pet: { include: { petSpecies: true, pet_images: true } } },
    });
  });
};

/*==================================================| COUNT |==================================================*/
/**
 * Función para obtener el conteo de aplicaciones a adopcion
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns conteo de lo encontrado
 */
export const countAdoptionApplicationDb = async (
  where?: Prisma.adoptionApplicationWhereInput,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.adoptionApplication.count({
      where,
    });
  });
};
