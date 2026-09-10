import { donationBankAccount, Prisma } from "@prisma/client";
import { sanitizeLimit } from "~/utils/sanitize";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type DonationMethod = Pick<
  donationBankAccount,
  "id" | "bank_name" | "account_type" | "account_number" | "account_holder"
>;

export type AdminDonationBankAccount = Pick<
  donationBankAccount,
  | "id"
  | "bank_name"
  | "account_type"
  | "account_number"
  | "account_holder"
  | "active"
>;

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

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener los medios de donación activos para la vista pública
 * solo cuentas activas y solo los campos que se muestran públicamente
 * (sin datos de auditoría ni relaciones).
 * @param limit Cantidad máxima a retornar.
 * @returns Lista de cuentas bancarias activas
 */
export const listActiveDonationMethodsDb = async (
  limit?: unknown,
): Promise<PrismaUtilResponse<DonationMethod[]>> => {
  const take = sanitizeLimit(limit, { max: 50 });

  return await handlePosiblePrismaError(async () => {
    return prisma.donationBankAccount.findMany({
      where: { active: true },
      take,
      orderBy: { bank_name: "asc" },
      select: {
        id: true,
        bank_name: true,
        account_type: true,
        account_number: true,
        account_holder: true,
      },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar las cuentas bancarias para la pantalla administrativa. Incluye las inactivas, ordenadas primero las activas.
 * @returns Lista de cuentas con su estado, sin campos de auditoría
 */
export const listDonationBankAccountsAdminDb = async (): Promise<
  PrismaUtilResponse<AdminDonationBankAccount[]>
> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donationBankAccount.findMany({
      orderBy: [{ active: "desc" }, { bank_name: "asc" }],
      select: {
        id: true,
        bank_name: true,
        account_type: true,
        account_number: true,
        account_holder: true,
        active: true,
      },
    });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener una cuenta bancaria puntual (p. ej. antes de editarla o
 * cambiar su estado).
 * @param where Filtro (normalmente `{ id }`)
 * @returns La cuenta o `null`
 */
export const getDonationBankAccountDb = async (
  where: Prisma.donationBankAccountWhereInput,
): Promise<PrismaUtilResponse<donationBankAccount | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donationBankAccount.findFirst({ where });
  });
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para registrar una cuenta bancaria de donación.
 * @param data Datos de la cuenta (incluye `creator_id`/`updater_id`)
 * @returns La cuenta creada
 */
export const createDonationBankAccountDb = async (
  data: Prisma.donationBankAccountUncheckedCreateInput,
): Promise<PrismaUtilResponse<donationBankAccount>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donationBankAccount.create({ data });
  });
};

/*==================================================| UPDATE |==================================================*/
/**
 * Función para editar una cuenta bancaria o activarla/desactivarla.
 * El toggle activar/desactivar es solo un update de `active`, así que reutiliza
 * esta misma función en vez de tener una aparte.
 * @param id Id de la cuenta
 * @param data Campos a editar (`active`, `updater_id`, `update_date`, ...)
 * @returns La cuenta actualizada
 */
export const updateDonationBankAccountDb = async (
  id: number,
  data: Prisma.donationBankAccountUncheckedUpdateInput,
): Promise<PrismaUtilResponse<donationBankAccount>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donationBankAccount.update({ where: { id }, data });
  });
};
