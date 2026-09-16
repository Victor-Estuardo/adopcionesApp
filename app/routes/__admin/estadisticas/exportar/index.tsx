import { LoaderFunction } from "@remix-run/node";
import ExcelJS from "exceljs";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";
import { resolveDateRange } from "~/utils/statsDateRange";
import { PresetRange } from "~/components/Stats/StatsHeader";
import {
  ApplicationsStats,
  DonationOrigenStats,
  DonationStats,
  PetsCatalogStats,
  TopSavedPet,
  countSavedPetsInRangeDb,
  getApplicationsStatsDb,
  getDonationOrigenStatsDb,
  getDonationStatsDb,
  getPetsCatalogStatsDb,
  getTopSavedPetsDb,
} from "~/services/db/stats.service";

const ESTADISTICAS_MODULE_ID = 16;
const ASSOCIATION_NAME = process.env.EMAIL_FROM_NAME || "Asociación Meraki";

type Seccion = "solicitudes" | "catalogo" | "interes" | "donaciones" | "todas";

const SECCIONES_VALIDAS: Seccion[] = [
  "solicitudes",
  "catalogo",
  "interes",
  "donaciones",
  "todas",
];

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendientes",
  en_revision: "En revisión",
  aprobada: "Aprobadas",
  rechazada: "Rechazadas",
};

const DONATION_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  coordinacion: "Coordinación",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
};

const ORIGEN_LABELS: Record<string, string> = {
  individual: "Individual",
  patrocinador: "Patrocinador",
};

/*==============================| Helpers de armado del Excel |==============================*/

// Encabezado de cada hoja: nombre de la asociación + título de la sección + rango aplicado
function writeSheetHeader(
  sheet: ExcelJS.Worksheet,
  title: string,
  rangeLabel: string,
) {
  sheet.getCell("A1").value = ASSOCIATION_NAME;
  sheet.getCell("A1").font = { bold: true, size: 14 };

  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF4674EA" } };

  sheet.getCell("A3").value = `Rango aplicado: ${rangeLabel}`;
  sheet.getCell("A3").font = { italic: true, size: 10, color: { argb: "FF666666" } };

  return 5; // primera fila libre para empezar a escribir tablas
}

// Escribe una tabla con subtítulo, encabezados de columna y filas; devuelve la
// siguiente fila libre (deja una fila en blanco de separación).
function writeTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  headers: string[],
  rows: (string | number | Date)[][],
): number {
  sheet.getCell(`A${startRow}`).value = title;
  sheet.getCell(`A${startRow}`).font = { bold: true, size: 11 };

  const headerRowIndex = startRow + 1;
  const headerRow = sheet.getRow(headerRowIndex);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
  });

  let rowIndex = headerRowIndex + 1;
  if (rows.length === 0) {
    sheet.getCell(`A${rowIndex}`).value = "Sin datos en el periodo";
    sheet.getCell(`A${rowIndex}`).font = { italic: true, color: { argb: "FF999999" } };
    rowIndex++;
  } else {
    for (const values of rows) {
      const row = sheet.getRow(rowIndex);
      values.forEach((v, i) => {
        row.getCell(i + 1).value = v;
      });
      rowIndex++;
    }
  }

  return rowIndex + 1;
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

/*==============================| Una hoja por sección |==============================*/

async function buildSolicitudesSheet(
  workbook: ExcelJS.Workbook,
  from: Date,
  to: Date,
  rangeLabel: string,
) {
  const res = await getApplicationsStatsDb(from, to);
  if (!res.success) throw new Error("No se pudieron obtener datos de Solicitudes");
  const data: ApplicationsStats = res.data;

  const sheet = workbook.addWorksheet("Solicitudes");
  setColumnWidths(sheet, [30, 20, 20]);
  let row = writeSheetHeader(sheet, "Estadísticas de Solicitudes", rangeLabel);

  row = writeTable(sheet, row, "Resumen", ["Indicador", "Valor"], [
    ["Solicitudes en el periodo", data.totalEnPeriodo],
    ["Tasa de aprobación", `${data.tasaAprobacion.toFixed(0)}%`],
    [
      "Tiempo promedio de decisión (días)",
      data.tiempoPromedioDecisionDias !== null
        ? data.tiempoPromedioDecisionDias.toFixed(1)
        : "Sin datos",
    ],
  ]);

  row = writeTable(
    sheet,
    row,
    "Tendencia de solicitudes recibidas",
    ["Fecha", "Total"],
    data.tendencia.map((t) => [t.fecha, t.total]),
  );

  row = writeTable(
    sheet,
    row,
    "Distribución por estado",
    ["Estado", "Total"],
    Object.entries(data.porEstado).map(([status, total]) => [
      STATUS_LABELS[status] ?? status,
      total,
    ]),
  );

  writeTable(
    sheet,
    row,
    "Motivos de rechazo recientes",
    ["Mascota", "Motivo", "Fecha"],
    data.motivosRechazoRecientes.map((m) => [
      m.pet_name,
      m.reason,
      new Date(m.date).toLocaleDateString("es-GT"),
    ]),
  );
}

async function buildCatalogoSheet(workbook: ExcelJS.Workbook, rangeLabel: string) {
  const res = await getPetsCatalogStatsDb();
  if (!res.success) throw new Error("No se pudieron obtener datos de Catálogo");
  const data: PetsCatalogStats = res.data;

  const sheet = workbook.addWorksheet("Catálogo");
  setColumnWidths(sheet, [30, 20, 20]);
  let row = writeSheetHeader(sheet, "Estadísticas de Catálogo", rangeLabel);
  sheet.getCell(`A${row}`).value =
    "Nota: el catálogo es un estado actual, no depende del rango de fecha.";
  sheet.getCell(`A${row}`).font = { italic: true, size: 9, color: { argb: "FF999999" } };
  row += 2;

  row = writeTable(sheet, row, "Resumen", ["Indicador", "Valor"], [
    ["Total en catálogo", data.total],
    ["Disponibles", data.disponibles],
    ["Adoptados", data.adoptados],
    ["Vacunados", `${data.porcentajeVacunados.toFixed(0)}%`],
    ["Esterilizados", `${data.porcentajeEsterilizados.toFixed(0)}%`],
  ]);

  row = writeTable(
    sheet,
    row,
    "Por especie",
    ["Especie", "Total"],
    data.porEspecie.map((p) => [p.especie, p.total]),
  );

  row = writeTable(
    sheet,
    row,
    "Por tamaño",
    ["Tamaño", "Total"],
    data.porTamano.map((p) => [p.tamano, p.total]),
  );

  writeTable(
    sheet,
    row,
    "Por género",
    ["Género", "Total"],
    data.porGenero.map((p) => [p.genero, p.total]),
  );
}

async function buildInteresSheet(
  workbook: ExcelJS.Workbook,
  from: Date,
  to: Date,
  rangeLabel: string,
) {
  const [topSavedRes, savedCountRes] = await Promise.all([
    getTopSavedPetsDb(from, to, 5),
    countSavedPetsInRangeDb(from, to),
  ]);
  if (!topSavedRes.success || !savedCountRes.success) {
    throw new Error("No se pudieron obtener datos de Interés de adoptantes");
  }
  const topSaved: TopSavedPet[] = topSavedRes.data;

  const sheet = workbook.addWorksheet("Interés de adoptantes");
  setColumnWidths(sheet, [30, 20, 15, 15]);
  let row = writeSheetHeader(sheet, "Interés de adoptantes", rangeLabel);

  row = writeTable(sheet, row, "Resumen", ["Indicador", "Valor"], [
    ["Mascotas guardadas en el periodo", savedCountRes.data],
  ]);

  writeTable(
    sheet,
    row,
    "Mascotas más guardadas por adoptantes",
    ["Mascota", "Especie", "Veces guardada", "¿Tiene solicitud?"],
    topSaved.map((p) => [
      p.name,
      p.species,
      p.totalGuardados,
      p.tieneSolicitud ? "Sí" : "No",
    ]),
  );
}

async function buildDonacionesSheet(
  workbook: ExcelJS.Workbook,
  from: Date,
  to: Date,
  rangeLabel: string,
) {
  const [donationsRes, origenRes] = await Promise.all([
    getDonationStatsDb(from, to),
    getDonationOrigenStatsDb(from, to),
  ]);
  if (!donationsRes.success || !origenRes.success) {
    throw new Error("No se pudieron obtener datos de Donaciones");
  }
  const data: DonationStats = donationsRes.data;
  const origen: DonationOrigenStats = origenRes.data;

  const sheet = workbook.addWorksheet("Donaciones");
  setColumnWidths(sheet, [30, 20, 20]);
  let row = writeSheetHeader(sheet, "Estadísticas de Donaciones", rangeLabel);

  row = writeTable(sheet, row, "Resumen", ["Indicador", "Valor"], [
    ["Donaciones en el periodo", data.totalEnPeriodo],
    ["Tasa de confirmación", `${data.tasaConfirmacion.toFixed(0)}%`],
    ["Monto confirmado (Q)", data.montoConfirmado],
  ]);

  row = writeTable(
    sheet,
    row,
    "Distribución por estado",
    ["Estado", "Total"],
    Object.entries(data.porEstado).map(([status, total]) => [
      DONATION_STATUS_LABELS[status] ?? status,
      total,
    ]),
  );

  row = writeTable(
    sheet,
    row,
    "Distribución por tipo",
    ["Tipo", "Total"],
    Object.entries(data.porTipo).map(([tipo, total]) => [tipo, total]),
  );

  row = writeTable(
    sheet,
    row,
    "Por origen",
    ["Origen", "Total"],
    origen.porOrigen.map((o) => [ORIGEN_LABELS[o.origen] ?? o.origen, o.total]),
  );

  writeTable(
    sheet,
    row,
    "Top proyectos con más donaciones",
    ["Proyecto", "Donaciones", "Monto confirmado (Q)"],
    origen.topProyectos.map((p) => [p.nombre, p.totalDonaciones, p.montoConfirmado]),
  );
}

/*==============================| Loader Function |==============================*/
/**
 * Resource route: genera y devuelve el reporte de Estadísticas en Excel
 * (una hoja por sección, o las 4 si `seccion=todas`). Solo tablas de datos,
 * sin gráficos — exceljs no los genera de forma nativa sin trabajo adicional.
 */
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  const validateRequest = validatePermission(
    session,
    ESTADISTICAS_MODULE_ID,
    "Leer",
  );
  if (validateRequest) throw validateRequest;

  const url = new URL(request.url);
  const preset = (url.searchParams.get("range") as PresetRange) || "30d";
  const customFrom = url.searchParams.get("from");
  const customTo = url.searchParams.get("to");
  const seccionParam = url.searchParams.get("seccion");
  const seccion: Seccion = SECCIONES_VALIDAS.includes(seccionParam as Seccion)
    ? (seccionParam as Seccion)
    : "todas";

  const { from, to } = resolveDateRange(preset, customFrom, customTo);
  const rangeLabel = `${from.toLocaleDateString("es-GT")} - ${to.toLocaleDateString("es-GT")}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = ASSOCIATION_NAME;
  workbook.created = new Date();

  try {
    if (seccion === "solicitudes" || seccion === "todas") {
      await buildSolicitudesSheet(workbook, from, to, rangeLabel);
    }
    if (seccion === "catalogo" || seccion === "todas") {
      await buildCatalogoSheet(workbook, rangeLabel);
    }
    if (seccion === "interes" || seccion === "todas") {
      await buildInteresSheet(workbook, from, to, rangeLabel);
    }
    if (seccion === "donaciones" || seccion === "todas") {
      await buildDonacionesSheet(workbook, from, to, rangeLabel);
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ errorMsg: "Ocurrió un error al generar el archivo de Excel" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileDate = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="estadisticas-${seccion}-${fileDate}.xlsx"`,
    },
  });
};
