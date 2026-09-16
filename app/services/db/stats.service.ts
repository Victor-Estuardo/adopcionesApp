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

export type DonationStats = {
  totalEnPeriodo: number;
  porEstado: Record<string, number>;
  porTipo: Record<string, number>;
  montoConfirmado: number;
  tasaConfirmacion: number;
  tendencia: { fecha: string; total: number }[];
};

export type DonationOrigenStats = {
  porOrigen: { origen: "individual" | "patrocinador"; total: number }[];
  topProyectos: {
    proyecto_id: number;
    nombre: string;
    totalDonaciones: number;
    montoConfirmado: number;
  }[];
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

/*==================================================| DONACIONES |==================================================*/
/**
 * Función para obtener estadísticas de donaciones en un rango de fechas.
 * Lectura nueva e independiente de `donation.service.ts`: no reemplaza ni
 * modifica la lógica existente de creación/revisión de donaciones.
 * @param dateFrom Fecha de inicio del periodo
 * @param dateTo Fecha de fin del periodo
 * @returns Estadísticas agregadas de donaciones
 */
export const getDonationStatsDb = async (
  dateFrom: Date,
  dateTo: Date,
): Promise<PrismaUtilResponse<DonationStats>> => {
  return await handlePosiblePrismaError(async () => {
    const donations = await prisma.donation.findMany({
      where: { submitted_at: { gte: dateFrom, lte: dateTo } },
      select: {
        status: true,
        donation_type: true,
        confirmed_amount: true,
        submitted_at: true,
      },
      orderBy: { submitted_at: "asc" },
    });

    const porEstado: Record<string, number> = {
      pendiente: 0,
      coordinacion: 0,
      confirmada: 0,
      rechazada: 0,
    };

    const porTipo: Record<string, number> = {
      Monetaria: 0,
      Especie: 0,
    };

    let montoConfirmado = 0;
    const tendenciaMap = new Map<string, number>();

    for (const donation of donations) {
      porEstado[donation.status] = (porEstado[donation.status] ?? 0) + 1;
      porTipo[donation.donation_type] =
        (porTipo[donation.donation_type] ?? 0) + 1;

      if (donation.status === "confirmada" && donation.confirmed_amount) {
        montoConfirmado += donation.confirmed_amount.toNumber();
      }

      const dayKey = donation.submitted_at.toISOString().slice(0, 10);
      tendenciaMap.set(dayKey, (tendenciaMap.get(dayKey) ?? 0) + 1);
    }

    const confirmadas = porEstado["confirmada"] ?? 0;
    const rechazadas = porEstado["rechazada"] ?? 0;
    const totalDecididas = confirmadas + rechazadas;

    return {
      totalEnPeriodo: donations.length,
      porEstado,
      porTipo,
      montoConfirmado,
      tasaConfirmacion:
        totalDecididas > 0 ? (confirmadas / totalDecididas) * 100 : 0,
      tendencia: Array.from(tendenciaMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, total]) => ({ fecha, total })),
    };
  });
};

/**
 * Función para obtener el desglose de donaciones por origen (individual vs.
 * patrocinador) y el top de proyectos por cantidad y monto confirmado de
 * donaciones asociadas, dentro de un rango de fechas.
 * @param dateFrom Fecha de inicio del periodo
 * @param dateTo Fecha de fin del periodo
 * @returns Desglose por origen y ranking de los 5 proyectos con más donaciones
 */
export const getDonationOrigenStatsDb = async (
  dateFrom: Date,
  dateTo: Date,
): Promise<PrismaUtilResponse<DonationOrigenStats>> => {
  return await handlePosiblePrismaError(async () => {
    const donations = await prisma.donation.findMany({
      where: { submitted_at: { gte: dateFrom, lte: dateTo } },
      select: {
        patrocinador_id: true,
        proyecto_id: true,
        status: true,
        confirmed_amount: true,
      },
    });

    let individual = 0;
    let patrocinador = 0;
    const porProyecto = new Map<
      number,
      { totalDonaciones: number; montoConfirmado: number }
    >();

    for (const donation of donations) {
      if (donation.patrocinador_id != null) {
        patrocinador++;
      } else {
        individual++;
      }

      if (donation.proyecto_id != null) {
        const acc = porProyecto.get(donation.proyecto_id) ?? {
          totalDonaciones: 0,
          montoConfirmado: 0,
        };
        acc.totalDonaciones += 1;
        if (donation.status === "confirmada" && donation.confirmed_amount) {
          acc.montoConfirmado += donation.confirmed_amount.toNumber();
        }
        porProyecto.set(donation.proyecto_id, acc);
      }
    }

    const topProyectoEntries = Array.from(porProyecto.entries())
      .sort(([, a], [, b]) => b.totalDonaciones - a.totalDonaciones)
      .slice(0, 5);

    const proyectos = await prisma.project.findMany({
      where: { id: { in: topProyectoEntries.map(([id]) => id) } },
      select: { id: true, name: true },
    });

    return {
      porOrigen: [
        { origen: "individual", total: individual },
        { origen: "patrocinador", total: patrocinador },
      ],
      topProyectos: topProyectoEntries.map(([proyecto_id, data]) => ({
        proyecto_id,
        nombre: proyectos.find((p) => p.id === proyecto_id)?.name ?? "N/D",
        totalDonaciones: data.totalDonaciones,
        montoConfirmado: data.montoConfirmado,
      })),
    };
  });
};
