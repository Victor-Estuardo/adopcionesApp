import {
  nav_audience_module,
  nav_zone_module,
  Prisma,
  module,
  permission,
} from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

export interface ModuleSession {
  key: string;
  name: string;
  icon: string;
  order: number;
  is_active: boolean;
  nav_zone: nav_zone_module;
  nav_audience: nav_audience_module;
}

export type ModuleWithPermissions = module & { permission: permission[] };

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener la lista de modulos activos para la sesión
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de modulos obtenidos
 */
export const listModulesForSessionDb = async (
  where?: Prisma.moduleWhereInput,
): Promise<PrismaUtilResponse<ModuleSession[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.module.findMany({
      where,
      select: {
        icon: true,
        is_active: true,
        key: true,
        name: true,
        nav_audience: true,
        nav_zone: true,
        order: true,
      },
      orderBy: { order: "asc" },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar módulos junto con su catálogo de permisos (para armar la matriz)
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de módulos con sus permisos
 */
export const listModulesWithPermissionsDb = async (
  where?: Prisma.moduleWhereInput,
): Promise<PrismaUtilResponse<ModuleWithPermissions[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.module.findMany({
      where,
      orderBy: { order: "asc" },
      include: { permission: true },
    });
  });
};
