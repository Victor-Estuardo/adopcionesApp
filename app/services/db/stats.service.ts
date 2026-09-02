import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPES |==================================================*/
export type ApplicationsStats = {
  totalEnPeriodo: number;
  porEstado: Record<string, number>;
  tasaAprobacion: number;
  tiempoPromedioDecisionDias: number | null;
  tendencia: { fecha: string; total: number }[];
  motivosRechazoRecientes: { pet_name: string; reason: string; date: Date }[];
};

export type PetsCatalogStats = {
  total: number;
  disponibles: number;
  adoptados: number;
  porEspecie: { especie: string; total: number }[];
  porTamano: { tamano: string; total: number }[];
  porGenero: { genero: string; total: number }[];
  porcentajeVacunados: number;
  porcentajeEsterilizados: number;
};

export type TopSavedPet = {
  pet_id: number;
  name: string;
  species: string;
  totalGuardados: number;
  tieneSolicitud: boolean;
};

/*==================================================| SOLICITUDES / ADOPCIONES |==================================================*/
/**
 * Función para obtener estadísticas de solicitudes de adopción en un rango de fechas
 * @param dateFrom Fecha de inicio del periodo
 * @param dateTo Fecha de fin del periodo
 * @returns Estadísticas agregadas de solicitudes
 */
export const getApplicationsStatsDb = async (
  dateFrom: Date,
  dateTo: Date,
): Promise<PrismaUtilResponse<ApplicationsStats>> => {
  return await handlePosiblePrismaError(async () => {
    const applications = await prisma.adoptionApplication.findMany({
      where: { submitted_at: { gte: dateFrom, lte: dateTo } },
      select: {
        status: true,
        submitted_at: true,
        updated_at: true,
        rejection_reason: true,
        pet: { select: { name: true } },
      },
      orderBy: { submitted_at: "asc" },
    });

    const porEstado: Record<string, number> = {
      pendiente: 0,
      en_revision: 0,
      aprobada: 0,
      rechazada: 0,
    };

    let sumaDiasDecision = 0;
    let countDecididas = 0;
    const tendenciaMap = new Map<string, number>();
    const motivosRechazoRecientes: ApplicationsStats["motivosRechazoRecientes"] =
      [];

    for (const app of applications) {
      porEstado[app.status] = (porEstado[app.status] ?? 0) + 1;

      const dayKey = app.submitted_at.toISOString().slice(0, 10);
      tendenciaMap.set(dayKey, (tendenciaMap.get(dayKey) ?? 0) + 1);

      if (app.status === "aprobada" || app.status === "rechazada") {
        const dias =
          (app.updated_at.getTime() - app.submitted_at.getTime()) /
          (1000 * 60 * 60 * 24);
        sumaDiasDecision += dias;
        countDecididas++;
      }

      if (app.status === "rechazada" && app.rejection_reason) {
        motivosRechazoRecientes.push({
          pet_name: app.pet.name,
          reason: app.rejection_reason,
          date: app.updated_at,
        });
      }
    }

    const aprobadas = porEstado["aprobada"] ?? 0;
    const rechazadas = porEstado["rechazada"] ?? 0;
    const totalDecididas = aprobadas + rechazadas;

    return {
      totalEnPeriodo: applications.length,
      porEstado,
      tasaAprobacion:
        totalDecididas > 0 ? (aprobadas / totalDecididas) * 100 : 0,
      tiempoPromedioDecisionDias:
        countDecididas > 0 ? sumaDiasDecision / countDecididas : null,
      tendencia: Array.from(tendenciaMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, total]) => ({ fecha, total })),
      motivosRechazoRecientes: motivosRechazoRecientes
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 5),
    };
  });
};

/*==================================================| CATÁLOGO DE MASCOTAS |==================================================*/
/**
 * Función para obtener la composición actual del catálogo de mascotas
 * Nota: esta es una foto del estado ACTUAL, no se filtra por rango de fechas,
 * ya que "disponibles vs adoptados" es un estado presente, no un evento en el tiempo.
 * @returns Estadísticas agregadas del catálogo
 */
export const getPetsCatalogStatsDb = async (): Promise<
  PrismaUtilResponse<PetsCatalogStats>
> => {
  return await handlePosiblePrismaError(async () => {
    const [
      total,
      disponibles,
      adoptados,
      vacunados,
      esterilizados,
      porEspecieRaw,
      porTamanoRaw,
      porGeneroRaw,
    ] = await Promise.all([
      prisma.pet.count(),
      prisma.pet.count({ where: { status: "Disponible" } }),
      prisma.pet.count({ where: { status: "Adoptado" } }),
      prisma.pet.count({ where: { vaccinated: true } }),
      prisma.pet.count({ where: { sterilized: true } }),
      prisma.pet.groupBy({ by: ["pet_species_id"], _count: { _all: true } }),
      prisma.pet.groupBy({ by: ["size"], _count: { _all: true } }),
      prisma.pet.groupBy({ by: ["gender"], _count: { _all: true } }),
    ]);

    const especies = await prisma.petSpecies.findMany({
      where: { id: { in: porEspecieRaw.map((p) => p.pet_species_id) } },
    });

    return {
      total,
      disponibles,
      adoptados,
      porEspecie: porEspecieRaw.map((p) => ({
        especie: especies.find((e) => e.id === p.pet_species_id)?.name ?? "N/D",
        total: p._count._all,
      })),
      porTamano: porTamanoRaw.map((p) => ({
        tamano: p.size,
        total: p._count._all,
      })),
      porGenero: porGeneroRaw.map((p) => ({
        genero: p.gender,
        total: p._count._all,
      })),
      porcentajeVacunados: total > 0 ? (vacunados / total) * 100 : 0,
      porcentajeEsterilizados: total > 0 ? (esterilizados / total) * 100 : 0,
    };
  });
};

/*==================================================| INTERÉS DE ADOPTANTES |==================================================*/
/**
 * Función para obtener las mascotas más guardadas (favoritas) en un rango de fechas
 * @param dateFrom Fecha de inicio del periodo
 * @param dateTo Fecha de fin del periodo
 * @param limit Cantidad máxima de mascotas a retornar
 * @returns Lista de mascotas ordenadas por veces guardada
 */
export const getTopSavedPetsDb = async (
  dateFrom: Date,
  dateTo: Date,
  limit = 5,
): Promise<PrismaUtilResponse<TopSavedPet[]>> => {
  return await handlePosiblePrismaError(async () => {
    const grouped = await prisma.savedPet.groupBy({
      by: ["pet_id"],
      where: { saved_at: { gte: dateFrom, lte: dateTo } },
      _count: { _all: true },
      orderBy: { _count: { pet_id: "desc" } },
      take: limit,
    });

    const petIds = grouped.map((g) => g.pet_id);

    const [pets, applications] = await Promise.all([
      prisma.pet.findMany({
        where: { id: { in: petIds } },
        include: { petSpecies: true },
      }),
      prisma.adoptionApplication.findMany({
        where: { pet_id: { in: petIds } },
        select: { pet_id: true },
      }),
    ]);

    const petIdsWithApplication = new Set(applications.map((a) => a.pet_id));

    return grouped.map((g) => {
      const pet = pets.find((p) => p.id === g.pet_id);
      return {
        pet_id: g.pet_id,
        name: pet?.name ?? "N/D",
        species: pet?.petSpecies.name ?? "N/D",
        totalGuardados: g._count._all,
        tieneSolicitud: petIdsWithApplication.has(g.pet_id),
      };
    });
  });
};

/*==================================================| TOTAL GUARDADOS EN PERIODO |==================================================*/
export const countSavedPetsInRangeDb = async (
  dateFrom: Date,
  dateTo: Date,
): Promise<PrismaUtilResponse<number>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.savedPet.count({
      where: { saved_at: { gte: dateFrom, lte: dateTo } },
    });
  });
};
