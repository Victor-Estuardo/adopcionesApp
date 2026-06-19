import { formQuestion, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener la lista de preguntas del formulario de adopción
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de preguntas
 */
export const listFormQuestionDb = async (
  where?: Prisma.formQuestionWhereInput,
): Promise<PrismaUtilResponse<formQuestion[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.formQuestion.findMany({
      where,
      orderBy: { sort_order: "asc" },
    });
  });
};
