import { commitmentAgreement, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear una nueva aplicación a adopción
 * @param data Información de la aplicación
 * @returns
 */
export const createcommitmentAgreementDb = async (
  data: Prisma.commitmentAgreementUncheckedCreateInput,
): Promise<PrismaUtilResponse<commitmentAgreement>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.commitmentAgreement.create({ data });
  });
};
