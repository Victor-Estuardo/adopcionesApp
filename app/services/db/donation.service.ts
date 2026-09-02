import { donation, Prisma } from "@prisma/client";
import { startOfMonth } from "date-fns";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type PublicDonation = Pick<
  donation,
  | "id"
  | "donation_type"
  | "amount"
  | "item_description"
  | "donor_name"
  | "is_anonymous"
  | "submitted_at"
>;

export type DonationTransparencySummary = {
  countMonetarioHistorico: number;
  countMonetarioMes: number;
  totalEspecieHistorico: number;
  totalDonacionesConfirmadas: number;
};

export type DonationWithRelations = donation & {
  donationBankAccount: { bank_name: string; account_number: string } | null;
  user_donation_user_idTouser: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para registrar una intención de donación
 * @param data Información de la donación
 * @returns
 */
export const createDonationDb = async (
  data: Prisma.donationUncheckedCreateInput,
): Promise<PrismaUtilResponse<donation>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donation.create({ data });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar las últimas donaciones públicas confirmadas (transparencia)
 * @param limit Cantidad máxima de donaciones a retornar
 * @returns Lista de donaciones públicas
 */
export const listPublicDonationsDb = async (
  limit: number,
): Promise<PrismaUtilResponse<PublicDonation[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donation.findMany({
      where: { status: "confirmada", is_public: true },
      orderBy: { submitted_at: "desc" },
      take: limit,
      select: {
        id: true,
        donation_type: true,
        amount: true,
        item_description: true,
        donor_name: true,
        is_anonymous: true,
        submitted_at: true,
      },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar donaciones para el panel administrativo
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @param skip Cantidad de registros a saltar (paginación)
 * @param take Cantidad de registros a devolver (paginación)
 * @returns Lista de donaciones con datos del donante/cuenta bancaria
 */
export const listDonationsAdminDb = async (
  where: Prisma.donationWhereInput,
  skip: number,
  take: number,
): Promise<PrismaUtilResponse<DonationWithRelations[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donation.findMany({
      where,
      skip,
      take,
      orderBy: { submitted_at: "desc" },
      include: {
        donationBankAccount: {
          select: { bank_name: true, account_number: true },
        },
        user_donation_user_idTouser: {
          select: { first_name: true, last_name: true, email: true },
        },
      },
    });
  });
};

/*==================================================| COUNT |==================================================*/
/**
 * Función para obtener el conteo de donaciones
 * @param where Objeto que contiene los filtros a aplicar a la query
 * @returns conteo de las donaciones
 */
export const countDonationsDb = async (
  where?: Prisma.donationWhereInput,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donation.count({ where });
  });
};

/*==================================================| UPDATE |==================================================*/
/**
 * Función para editar una donación (confirmar/rechazar)
 * @param id Id de la donación a actualizar
 * @param data Información a editar de la donación
 * @returns donación actualizada
 */
export const updateDonationDb = async (
  id: string,
  data: Prisma.donationUncheckedUpdateInput,
): Promise<PrismaUtilResponse<donation>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donation.update({ where: { id }, data });
  });
};

/*==================================================| STATS |==================================================*/
/**
 * Función para obtener el resumen público de transparencia (solo conteos, sin exponer
 * montos ni donantes: mostrar montos públicamente podría atraer intentos de fraude/robo)
 * @returns Conteos de donaciones confirmadas
 */
export const getDonationTransparencySummaryDb = async (): Promise<
  PrismaUtilResponse<DonationTransparencySummary>
> => {
  return await handlePosiblePrismaError(async () => {
    const inicioMes = startOfMonth(new Date());

    const [monetarioHistorico, monetarioMes, especieHistorico, totalConfirmadas] =
      await Promise.all([
        prisma.donation.count({
          where: { status: "confirmada", donation_type: "Monetaria" },
        }),
        prisma.donation.count({
          where: {
            status: "confirmada",
            donation_type: "Monetaria",
            submitted_at: { gte: inicioMes },
          },
        }),
        prisma.donation.count({
          where: { status: "confirmada", donation_type: "Especie" },
        }),
        prisma.donation.count({
          where: { status: "confirmada" },
        }),
      ]);

    return {
      countMonetarioHistorico: monetarioHistorico,
      countMonetarioMes: monetarioMes,
      totalEspecieHistorico: especieHistorico,
      totalDonacionesConfirmadas: totalConfirmadas,
    };
  });
};
