import { needSupplies, Prisma } from "@prisma/client";
import { sanitizeLimit } from "~/utils/sanitize";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type NeededSupply = Pick<needSupplies, "id" | "description">;

/** Insumo tal como lo ve el rol Administrativo al gestionarlo: incluye
 *  el estado `active`, ya que "quitar" un insumo es desactivarlo. */
export type AdminNeededSupply = Pick<
  needSupplies,
  "id" | "description" | "active"
>;

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener los insumos que la asociación necesita en el periodo
 * actual, para la vista pública. Solo insumos activos y solo los campos
 * que se muestran públicamente.
 * @param limit Cantidad máxima a retornar.
 * @returns Lista de insumos necesitados activos
 */
export const listActiveNeededSuppliesDb = async (
  limit?: unknown,
): Promise<PrismaUtilResponse<NeededSupply[]>> => {
  const take = sanitizeLimit(limit, { max: 50 });

  return await handlePosiblePrismaError(async () => {
    return prisma.needSupplies.findMany({
      where: { active: true },
      take,
      orderBy: { creation_date: "asc" },
      select: { id: true, description: true },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar los insumos para la pantalla administrativa.
 * Incluye los inactivos (los "quitados"), para poder distinguirlos y, si se
 * decide, reactivarlos.
 * @returns Lista de insumos con su estado
 */
export const listNeededSuppliesAdminDb = async (): Promise<
  PrismaUtilResponse<AdminNeededSupply[]>
> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.needSupplies.findMany({
      orderBy: [{ active: "desc" }, { creation_date: "asc" }],
      select: { id: true, description: true, active: true },
    });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener un insumo puntual.
 * @param where Filtro (normalmente `{ id }`)
 * @returns El insumo o `null`
 */
export const getNeededSupplyDb = async (
  where: Prisma.needSuppliesWhereInput,
): Promise<PrismaUtilResponse<needSupplies | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.needSupplies.findFirst({ where });
  });
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para registrar un insumo necesitado.
 * @param data Datos del insumo (incluye `creator_id`/`updater_id`)
 * @returns El insumo creado
 */
export const createNeededSupplyDb = async (
  data: Prisma.needSuppliesUncheckedCreateInput,
): Promise<PrismaUtilResponse<needSupplies>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.needSupplies.create({ data });
  });
};

/*==================================================| UPDATE |==================================================*/
/**
 * Función para editar un insumo o cambiar su estado (editar / quitar).
 * @param id Id del insumo
 * @param data Campos a editar (descripción, `active`, `updater_id`, `update_date`)
 * @returns El insumo actualizado
 */
export const updateNeededSupplyDb = async (
  id: number,
  data: Prisma.needSuppliesUncheckedUpdateInput,
): Promise<PrismaUtilResponse<needSupplies>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.needSupplies.update({ where: { id }, data });
  });
};
