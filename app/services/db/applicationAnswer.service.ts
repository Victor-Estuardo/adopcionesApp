import { applicationAnswer, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";
import { GetBatchResult } from "@prisma/client/runtime/library";

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear una nueva aplicación a adopción
 * @param data Información de la aplicación
 * @returns
 */
export const createApplicationAnswersDb = async (
  data: Prisma.applicationAnswerUncheckedCreateInput[],
): Promise<PrismaUtilResponse<GetBatchResult>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.applicationAnswer.createMany({ data });
  });
};
