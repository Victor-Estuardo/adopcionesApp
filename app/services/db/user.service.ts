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
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "active"
  | "it_is_verified"
  | "role_id"
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

/*==================================================| COUNT |==================================================*/
/**
 * Función para obtener la cantidad de usuarios que cumplen un filtro
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Cantidad de usuarios obtenidos
 */
export const countUsersDb = async (
  where?: Prisma.userWhereInput,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.user.count({ where });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener los ids de los usuarios que tienen asignado un rol específico
 * @param roleId Id del rol
 * @returns Ids de los usuarios con ese rol
 */
export const listUserIdsByRoleDb = async (
  roleId: number,
): Promise<PrismaUtilResponse<number[]>> => {
  return await handlePosiblePrismaError(async () => {
    const users = await prisma.user.findMany({
      where: { role_id: roleId },
      select: { id: true },
    });
    return users.map((u) => u.id);
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
        role_id: true,
        role: { select: { name: true } },
      },
    });
  });
};
