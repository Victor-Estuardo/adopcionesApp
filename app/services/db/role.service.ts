import { permission, permission_role, Prisma, role } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type RoleWithPermissions = role & {
  permission_role: (permission_role & { permission: permission })[];
  _count: { user: number };
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener información de un rol
 * @param id ID de rol a obtener
 * @returns Información de rol
 */
export const getRoleByIdDb = async (
  id?: number,
): Promise<PrismaUtilResponse<role | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.role.findFirst({
      where: { id },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar roles con sus permisos asignados y conteo de usuarios
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de roles
 */
export const listRolesDb = async (
  where?: Prisma.roleWhereInput,
): Promise<PrismaUtilResponse<RoleWithPermissions[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.role.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        permission_role: { include: { permission: true } },
        _count: { select: { user: true } },
      },
    });
  });
};

/*==================================================| CREATE |==================================================*/
export const createRoleDb = async (
  data: Prisma.roleUncheckedCreateInput,
): Promise<PrismaUtilResponse<role>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.role.create({ data });
  });
};

/*==================================================| UPDATE |==================================================*/
export const updateRoleDb = async (
  id: number,
  data: Prisma.roleUncheckedUpdateInput,
): Promise<PrismaUtilResponse<role>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.role.update({ where: { id }, data });
  });
};
