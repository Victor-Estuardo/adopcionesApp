import { Prisma, role, user } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type EssentialInfoUser = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

/** Datos de usuario seguros para exponer al propio usuario (sin `password`). */
export type OwnProfileUser = Pick<
  user,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "registration_date"
  | "it_is_verified"
>;

/** Usuario administrativo + su rol, sin `password`, para listados en el panel. */
export type AdminUserListItem = Pick<
  user,
  "id" | "first_name" | "last_name" | "email" | "active" | "it_is_verified"
> & { role: Pick<role, "name"> };

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
 * Función para obtener a un usuario
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

/*--------------------------------------------------------------------------------------------------------*/
/**
 * Función para obteneinfo esencial de usuario
 * @param where Información del usuario
 * @returns usuario
 */
export const getEssentialUserDb = async (
  where?: Prisma.userWhereInput,
): Promise<PrismaUtilResponse<EssentialInfoUser | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.findFirst({
      where,
      select: { first_name: true, last_name: true, email: true, phone: true },
    });
  });
};

/*--------------------------------------------------------------------------------------------------------*/
/**
 * Función para obtener los datos propios de un usuario (para mostrar a
 * él mismo en "Mi cuenta"), sin exponer el hash de la contraseña.
 * @param where Información del usuario
 * @returns usuario
 */
export const getOwnProfileUserDb = async (
  where?: Prisma.userWhereInput,
): Promise<PrismaUtilResponse<OwnProfileUser | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.findFirst({
      where,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        registration_date: true,
        it_is_verified: true,
      },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar usuarios administrativos (excluye adoptantes)
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de usuarios con su rol, sin exponer el hash de la contraseña
 */
export const listUsersDb = async (
  where?: Prisma.userWhereInput,
): Promise<PrismaUtilResponse<AdminUserListItem[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.findMany({
      where: { ...where, role: { its_administrative: true } },
      orderBy: { registration_date: "desc" },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        active: true,
        it_is_verified: true,
        role: { select: { name: true } },
      },
    });
  });
};
