import { permission, permission_role, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

type PermissionRole = permission_role & {
  permission: permission;
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener los modulos disponibles por su permiso
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de modulos disponibles
 */
export const listPermissionRoleDb = async (
  where?: Prisma.permission_roleWhereInput,
): Promise<PrismaUtilResponse<PermissionRole[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.permission_role.findMany({
      where,
      include: {
        permission: true,
      },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener permisos (con su módulo y acción) a partir de una lista de ids
 * @param ids Ids de permisos a obtener
 * @returns Lista de permisos encontrados
 */
export const getPermissionsByIdsDb = async (
  ids: number[],
): Promise<PrismaUtilResponse<permission[]>> => {
  return await handlePosiblePrismaError(async () => {
    if (ids.length === 0) return [];
    return prisma.permission.findMany({ where: { id: { in: ids } } });
  });
};

/*==================================================| SYNC |==================================================*/
/**
 * Función para sincronizar los permisos de un rol: elimina los actuales y crea los nuevos
 * @param roleId Id del rol
 * @param permissionIds Ids de los permisos que debe tener el rol
 */
export const syncPermissionRoleDb = async (
  roleId: number,
  permissionIds: number[],
): Promise<PrismaUtilResponse<{ count: number }>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.$transaction(async (tx) => {
      await tx.permission_role.deleteMany({ where: { role_id: roleId } });

      if (permissionIds.length > 0) {
        await tx.permission_role.createMany({
          data: permissionIds.map((permission_id) => ({
            role_id: roleId,
            permission_id,
            created_in: new Date(),
          })),
        });
      }

      return { count: permissionIds.length };
    });
  });
};
