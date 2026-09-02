import { donationBankAccount, Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| LIST |==================================================*/
/**
 * Función para listar las cuentas bancarias de donación
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns Lista de cuentas bancarias
 */
export const listDonationBankAccountDb = async (
  where?: Prisma.donationBankAccountWhereInput,
): Promise<PrismaUtilResponse<donationBankAccount[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donationBankAccount.findMany({
      where,
      orderBy: { bank_name: "asc" },
    });
  });
};
