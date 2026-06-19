import { Prisma, user } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear un usuario
 * @param data Información del nuevo usuario
 * @returns nuevo usuario
 */
export const createUserDb = async (
  data: Prisma.userUncheckedCreateInput,
): Promise<PrismaUtilResponse<user>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.create({ data });
  });
};

/*==================================================| UPDATE |==================================================*/
/**
 * Función para editar un usuario
 * @param id Id del usuario a actualizar
 * @param data Información a editar del usuario
 * @returns nuevo usuario
 */
export const updateUserDb = async (
  id: number,
  data: Prisma.userUncheckedUpdateInput,
): Promise<PrismaUtilResponse<user>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.update({ where: { id }, data });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener a u usuario
 * @param where Información del usuario
 * @returns usuario
 */
export const getUserDb = async (
  where?: Prisma.userWhereInput,
): Promise<PrismaUtilResponse<user | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.findFirst({ where });
  });
};
