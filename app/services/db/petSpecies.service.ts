import { petSpecies, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener la lista de categorías de mascotas
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de categorías de mascotas obtenidos
 */
export const listPetSpeciesDb = async (
  where?: Prisma.petSpeciesWhereInput,
  skip?: number,
  take?: number,
): Promise<PrismaUtilResponse<petSpecies[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.petSpecies.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
    });
  });
};
