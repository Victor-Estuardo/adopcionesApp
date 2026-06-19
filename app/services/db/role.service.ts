import { role } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

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
