import { accountVerificationToken, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";
import { GetBatchResult } from "@prisma/client/runtime/library";
import { getDateGt } from "~/utils/common";
import { verifyText } from "~/utils/crypto.server";

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear un nuevo token de verificación de cuenta
 * @param data Información del token
 * @returns nuevo token
 */
export const createAccountVerificationTokenDb = async (
  data: Prisma.accountVerificationTokenUncheckedCreateInput,
): Promise<PrismaUtilResponse<accountVerificationToken>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.accountVerificationToken.create({ data });
  });
};

/*==================================================| DELETE |==================================================*/
/**
 * Función para eliminar token(s) de verificación de cuenta
 * @param where query para la eliminación
 * @returns respuesta de eliminación
 */
export const deleteManyAccountVerificationTokenDb = async (
  where: Prisma.accountVerificationTokenWhereInput,
): Promise<PrismaUtilResponse<GetBatchResult>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.accountVerificationToken.deleteMany({ where });
  });
};

/*------------------------------------------------------------------------*/
/**
 * Valida el token de verificación de cuenta
 */
export async function validateAccountVerificationToken(token: string): Promise<{
  valid: boolean;
  userId?: number;
  error?: string;
}> {
  if (!token) {
    return { valid: false, error: "Token no proporcionado" };
  }

  // Buscar todos los tokens no expirados
  const tokens = await prisma.accountVerificationToken.findMany({
    where: {
      expires_at: { gt: getDateGt() },
    },
    include: {
      user: { select: { id: true } },
    },
  });

  // Verificar contra cada token hasheado
  for (const dbToken of tokens) {
    const isValid = await verifyText(token, dbToken.token);
    if (isValid) {
      return { valid: true, userId: dbToken.user_id };
    }
  }

  return { valid: false, error: "Token inválido o expirado" };
}
