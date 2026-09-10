import { donation, Prisma } from "@prisma/client";
import { startOfMonth } from "date-fns";
import { sanitizeLimit } from "~/utils/sanitize";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type PublicDonation = {
  id: string;
  donation_type: "Monetaria" | "Especie";
  item_description: string | null;
  donor_name: string | null;
  is_anonymous: boolean;
  submitted_at: string; // ISO
  origin: "individual" | "patrocinador";
  project_name: string | null;
};

export type DonationTransparencySummary = {
  countMonetarioHistorico: number;
  countMonetarioMes: number;
  totalEspecieHistorico: number;
  totalDonacionesConfirmadas: number;
};

export type AdminDonation = {
  id: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  donation_type: "Monetaria" | "Especie";
  declared_amount: number | null;
  confirmed_amount: number | null;
  item_description: string | null;
  status: string;
  is_public: boolean;
  is_anonymous: boolean;
  origin: "individual" | "patrocinador";
  patrocinador_name: string | null;
  project_name: string | null;
  bank_name: string | null;
  reference_number: string | null;
  comment: string | null;
  rejection_reason: string | null;
  reviewed_by_name: string | null;
  receipt_url: string | null;
  submitted_at: string;
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para registrar una donación (notificada por un donante o registrada
 * manualmente por administración).
 * @param data Información de la donación
 * @returns La donación creada
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
 * Función para listar las últimas donaciones públicas para la transparencia.
 * Incluye donaciones monetarias y en especie confirmadas cuyo donante autorizó
 * su publicación. De las monetarias NUNCA se expone el monto: solo se indica
 * que fue un aporte económico.
 * @param limit Cantidad máxima a retornar. Se sanitiza a [1, 30]; por defecto 8.
 * @returns Lista de donaciones públicas (monetarias y en especie)
 */
export const listPublicDonationsDb = async (
  limit?: unknown,
): Promise<PrismaUtilResponse<PublicDonation[]>> => {
  const take = sanitizeLimit(limit, { max: 30 }) ?? 8;

  return await handlePosiblePrismaError(async () => {
    const rows = await prisma.donation.findMany({
      where: {
        status: "confirmada",
        is_public: true,
      },
      orderBy: { submitted_at: "desc" },
      take,
      select: {
        id: true,
        donation_type: true,
        item_description: true,
        donor_name: true,
        is_anonymous: true,
        submitted_at: true,
        patrocinador_id: true,
        proyecto: { select: { name: true } },
      },
    });

    return rows.map(
      (row): PublicDonation => ({
        id: row.id,
        donation_type: row.donation_type,
        // De una donación monetaria no se publica ningún detalle del monto.
        item_description:
          row.donation_type === "Monetaria" ? null : row.item_description,
        // El nombre de una donación anónima no fue autorizado para mostrarse.
        donor_name: row.is_anonymous ? null : row.donor_name,
        is_anonymous: row.is_anonymous,
        submitted_at: row.submitted_at.toISOString(),
        origin: row.patrocinador_id != null ? "patrocinador" : "individual",
        project_name: row.proyecto?.name ?? null,
      }),
    );
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar donaciones para el panel administrativo. Los
 * filtros (tipo, estado, origen, proyecto, rango de fecha) los arma la ruta en
 * el `where`; aquí solo se pagina y se da forma al resultado.
 * @param where Filtros ya construidos (`Prisma.donationWhereInput`)
 * @param skip Registros a saltar (paginación)
 * @param take Registros a devolver (paginación)
 * @returns Lista de donaciones con sus relaciones aplanadas
 */
export const listDonationsAdminDb = async (
  where: Prisma.donationWhereInput,
  skip: number,
  take: number,
): Promise<PrismaUtilResponse<AdminDonation[]>> => {
  return await handlePosiblePrismaError(async () => {
    const rows = await prisma.donation.findMany({
      where,
      skip,
      take,
      orderBy: { submitted_at: "desc" },
      select: {
        id: true,
        donor_name: true,
        donor_email: true,
        donor_phone: true,
        donation_type: true,
        declared_amount: true,
        confirmed_amount: true,
        item_description: true,
        status: true,
        is_public: true,
        is_anonymous: true,
        patrocinador_id: true,
        reference_number: true,
        comment: true,
        rejection_reason: true,
        receipt_url: true,
        submitted_at: true,
        donationBankAccount: { select: { bank_name: true } },
        patrocinador: { select: { name: true } },
        proyecto: { select: { name: true } },
        user_donation_reviewed_byTouser: {
          select: { first_name: true, last_name: true },
        },
      },
    });

    return rows.map(
      (row): AdminDonation => ({
        id: row.id,
        donor_name: row.donor_name,
        donor_email: row.donor_email,
        donor_phone: row.donor_phone,
        donation_type: row.donation_type,
        declared_amount:
          row.declared_amount != null ? row.declared_amount.toNumber() : null,
        confirmed_amount:
          row.confirmed_amount != null ? row.confirmed_amount.toNumber() : null,
        item_description: row.item_description,
        status: row.status,
        is_public: row.is_public,
        is_anonymous: row.is_anonymous,
        origin: row.patrocinador_id != null ? "patrocinador" : "individual",
        patrocinador_name: row.patrocinador?.name ?? null,
        project_name: row.proyecto?.name ?? null,
        bank_name: row.donationBankAccount?.bank_name ?? null,
        reference_number: row.reference_number,
        comment: row.comment,
        rejection_reason: row.rejection_reason,
        reviewed_by_name: row.user_donation_reviewed_byTouser
          ? `${row.user_donation_reviewed_byTouser.first_name} ${row.user_donation_reviewed_byTouser.last_name}`
          : null,
        receipt_url: row.receipt_url,
        submitted_at: row.submitted_at.toISOString(),
      }),
    );
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

/* Estados en los que administración todavía puede confirmar o rechazar una
   donación (coincide con `ACTIONABLE_STATES` del drawer). */
export const REVIEWABLE_DONATION_STATUSES = ["pendiente", "coordinacion"];

/**
 * Confirma o rechaza una donación, pero solo si sigue en un estado accionable.
 * El guardia de estado y la escritura van en un mismo `updateMany` para que
 * sea atómico: si dos revisores actúan a la vez, el segundo cambia 0 filas en
 * lugar de pisar la decisión del primero.
 * @param id Id de la donación
 * @param data Campos a escribir (status, reviewed_by, confirmed_amount / rejection_reason, updated_at)
 * @returns Cantidad de filas modificadas (0 = la donación ya no era accionable)
 */
export const reviewDonationDb = async (
  id: string,
  data: Prisma.donationUncheckedUpdateManyInput,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    const res = await prisma.donation.updateMany({
      where: { id, status: { in: REVIEWABLE_DONATION_STATUSES } },
      data,
    });
    return res.count;
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener una donación puntual (p. ej. antes de confirmarla, para
 * saber su tipo y monto declarado).
 * @param where Filtro (normalmente `{ id }`)
 * @returns La donación o `null`
 */
export const getDonationDb = async (
  where: Prisma.donationWhereInput,
): Promise<PrismaUtilResponse<donation | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.donation.findFirst({ where });
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

    const [
      monetarioHistorico,
      monetarioMes,
      especieHistorico,
      totalConfirmadas,
    ] = await Promise.all([
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
