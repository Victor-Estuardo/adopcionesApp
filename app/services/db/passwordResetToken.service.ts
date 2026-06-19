import { passwordResetToken, Prisma, user } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";
import { GetBatchResult } from "@prisma/client/runtime/library";
import { getDateGt } from "~/utils/common";
import { verifyText } from "~/utils/crypto.server";

/*==================================================| CREATE |==================================================*/
/**
 * Función para crear un nuevo token de recuperación de contraseña
 * @param data Información del token
 * @returns nuevo usuario
 */
export const createPasswordResetTokenDb = async (
  data: Prisma.passwordResetTokenUncheckedCreateInput,
): Promise<PrismaUtilResponse<passwordResetToken>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.passwordResetToken.create({ data });
  });
};

/*==================================================| DELETE |==================================================*/
/**
 * Función para crear eliminar token de recuperación de contraseña
 * @param where query para la eliminación
 * @returns respuesta de eliminación
 */
export const deleteManyPasswordResetTokenDb = async (
  where: Prisma.passwordResetTokenWhereInput,
): Promise<PrismaUtilResponse<GetBatchResult>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.passwordResetToken.deleteMany({ where });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener un token de recuperación de contraseña
 * @param where Información del token
 * @returns token
 */
export const getPasswrodResetTokenDB = async (
  where?: Prisma.passwordResetTokenWhereInput,
): Promise<PrismaUtilResponse<passwordResetToken | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.passwordResetToken.findFirst({ where });
  });
};

/*------------------------------------------------------------------------*/
/**
 * Valida el token de recuperación
 */
export async function validatePasswordResetToken(token: string): Promise<{
  valid: boolean;
  userId?: number;
  error?: string;
}> {
  if (!token) {
    return { valid: false, error: "Token no proporcionado" };
  }

  // Buscar todos los tokens no expirados
  const tokens = await prisma.passwordResetToken.findMany({
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
