import { module, permission, permission_role, Prisma } from "@prisma/client";
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
