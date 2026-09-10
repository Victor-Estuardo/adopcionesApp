import { sponsor, Prisma } from "@prisma/client";
import { sanitizeLimit } from "~/utils/sanitize";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type PublicSponsor = Pick<
  sponsor,
  "id" | "name" | "logo_url" | "website"
>;

export type AdminSponsor = Pick<
  sponsor,
  "id" | "name" | "website" | "contact" | "logo_url" | "active"
> & { projectsCount: number };

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener los patrocinadores activos para la vista pública.
 * Solo patrocinadores activos y solo los campos que se muestran públicamente
 * (nombre, logo y sitio web; sin datos de auditoría, sin `contact` interno y
 * sin relaciones).
 * @param limit Cantidad máxima a retornar. Se sanitiza a un entero en [1, 50];
 *              si no es un número usable se ignora (sin límite).
 * @returns Lista de patrocinadores activos
 */
export const listActiveSponsorDb = async (
  limit?: unknown,
): Promise<PrismaUtilResponse<PublicSponsor[]>> => {
  const take = sanitizeLimit(limit, { max: 50 });

  return await handlePosiblePrismaError(async () => {
    return prisma.sponsor.findMany({
      where: { active: true },
      take,
      orderBy: { name: "asc" },
      select: { id: true, name: true, logo_url: true, website: true },
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar los patrocinadores para la pantalla administrativa
 * . Incluye inactivos y calcula `projectsCount` a partir de las
 * donaciones del patrocinador que están asociadas a un proyecto.
 * @returns Lista de patrocinadores con su conteo de proyectos apoyados
 */
export const listSponsorAdminDb = async (): Promise<
  PrismaUtilResponse<AdminSponsor[]>
> => {
  return await handlePosiblePrismaError(async () => {
    const rows = await prisma.sponsor.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        website: true,
        contact: true,
        logo_url: true,
        active: true,
        donation: {
          where: { proyecto_id: { not: null } },
          select: { proyecto_id: true },
        },
      },
    });

    return rows.map(
      ({ donation, ...patrocinador }): AdminSponsor => ({
        ...patrocinador,
        projectsCount: new Set(donation.map((d) => d.proyecto_id)).size,
      }),
    );
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener un patrocinador puntual
 * @param where Filtro (normalmente `{ id, active: true }`)
 * @returns El patrocinador o `null`
 */
export const getSponsorDb = async (
  where: Prisma.sponsorWhereInput,
): Promise<PrismaUtilResponse<sponsor | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.sponsor.findFirst({ where });
  });
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para registrar un patrocinador.
 * @param data Datos del patrocinador (incluye `creator_id`/`updater_id`)
 * @returns El patrocinador creado
 */
export const createSponsorDb = async (
  data: Prisma.sponsorUncheckedCreateInput,
): Promise<PrismaUtilResponse<sponsor>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.sponsor.create({ data });
  });
};

/*==================================================| UPDATE |==================================================*/
/**
 * Función para editar un patrocinador o darlo de baja/reactivarlo. El
 * cambio de estado es un update de `active`, así que va por aquí también.
 * @param id Id del patrocinador
 * @param data Campos a editar (`active`, `updater_id`, `update_date`, ...)
 * @returns El patrocinador actualizado
 */
export const updateSponsorDb = async (
  id: number,
  data: Prisma.sponsorUncheckedUpdateInput,
): Promise<PrismaUtilResponse<sponsor>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.sponsor.update({ where: { id }, data });
  });
};
