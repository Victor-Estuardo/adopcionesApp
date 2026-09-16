import { json, LoaderFunction } from "@remix-run/node";
import {
  ShouldRevalidateFunction,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FaHeart,
  FaClipboardCheck,
  FaClock,
  FaPaw,
  FaMoneyBillWave,
  FaInbox,
} from "react-icons/fa";
import { BsClipboard2Heart } from "react-icons/bs";
import { BiSolidDonateHeart } from "react-icons/bi";
import Tabs from "~/components/Tabs";
import {
  countSavedPetsInRangeDb,
  getApplicationsStatsDb,
  getDonationOrigenStatsDb,
  getDonationStatsDb,
  getPetsCatalogStatsDb,
  getTopSavedPetsDb,
} from "~/services/db/stats.service";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";
import { resolveDateRange } from "~/utils/statsDateRange";
import StatsHeader, { PresetRange } from "~/components/Stats/StatsHeader";

export const meta = () => {
  return [{ title: "ESTADÍSTICAS" }];
};

const ESTADISTICAS_MODULE_ID = 16;

const COLORS = [
  "#52C9BB",
  "#4674EA",
  "#F2768C",
  "#F2B84B",
  "#8A8577",
  "#B9B3A4",
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

const TABS = [
  { id: "solicitudes", label: "Solicitudes", icon: BsClipboard2Heart },
  { id: "catalogo", label: "Catálogo", icon: FaPaw },
  { id: "interes", label: "Interés de adoptantes", icon: FaHeart },
  { id: "donaciones", label: "Donaciones", icon: BiSolidDonateHeart },
];

type TabId = (typeof TABS)[number]["id"];

function formatCurrency(value: number) {
  return `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

// Umbral (en días) a partir del cual la tendencia diaria deja de ser legible
// y se agrupa por semana. 30 días se lee
// bien, 90 días se ve ruidoso.
const WEEKLY_GROUPING_THRESHOLD_DAYS = 45;

// Agrupa una tendencia diaria (posiblemente dispersa, sin días en cero) en
// buckets semanales alineados al inicio del rango seleccionado, sumando los
// totales de cada semana. La etiqueta es el rango de fechas de esa semana.
function bucketTendenciaByWeek(
  tendencia: { fecha: string; total: number }[],
  rangeFrom: Date,
) {
  const buckets = new Map<number, { start: Date; total: number }>();

  for (const t of tendencia) {
    const day = new Date(`${t.fecha}T00:00:00`);
    const diffDays = Math.floor(
      (day.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24),
    );
    const bucketIndex = Math.floor(diffDays / 7);
    const existing = buckets.get(bucketIndex);
    if (existing) {
      existing.total += t.total;
    } else {
      const start = new Date(rangeFrom);
      start.setDate(start.getDate() + bucketIndex * 7);
      buckets.set(bucketIndex, { start, total: t.total });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([, bucket]) => {
      const end = new Date(bucket.start);
      end.setDate(end.getDate() + 6);
      const fmt = (d: Date) =>
        d.toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
      return {
        fecha: `${fmt(bucket.start)} - ${fmt(end)}`,
        total: bucket.total,
      };
    });
}

/*==============================| Loader Function |==============================*/
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

  const { from, to } = resolveDateRange(preset, customFrom, customTo);

  const [
    applicationsRes,
    catalogRes,
    topSavedRes,
    savedCountRes,
    donationsRes,
    donationOrigenRes,
  ] = await Promise.all([
    getApplicationsStatsDb(from, to),
    getPetsCatalogStatsDb(),
    getTopSavedPetsDb(from, to, 5),
    countSavedPetsInRangeDb(from, to),
    getDonationStatsDb(from, to),
    getDonationOrigenStatsDb(from, to),
  ]);

  if (
    !applicationsRes.success ||
    !catalogRes.success ||
    !topSavedRes.success ||
    !savedCountRes.success ||
    !donationsRes.success ||
    !donationOrigenRes.success
  ) {
    return json({ errorMsg: "Ocurrió un error al cargar las estadísticas" });
  }

  return json({
    applications: applicationsRes.data,
    catalog: catalogRes.data,
    topSaved: topSavedRes.data,
    savedCountInRange: savedCountRes.data,
    donations: donationsRes.data,
    donationOrigen: donationOrigenRes.data,
    range: { preset, from: from.toISOString(), to: to.toISOString() },
  });
};

// Cambiar de pestaña (parámetro `tab`) no cambia ningún dato del loader — las
// 4 pestañas ya se cargan juntas — así que evita la revalidación
// completa (~10 queries) cuando solo cambió `tab`. Si cambió `range`/`from`/
// `to` sí se revalida, porque eso sí afecta los datos.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  const dataParams = ["range", "from", "to"];
  const dataParamsChanged = dataParams.some(
    (p) => currentUrl.searchParams.get(p) !== nextUrl.searchParams.get(p),
  );
  if (!dataParamsChanged) return false;
  return defaultShouldRevalidate;
};

/*==============================| Component |==============================*/
export default function () {
  const {
    applications,
    catalog,
    topSaved,
    savedCountInRange,
    donations,
    donationOrigen,
    range,
  } = useLoaderData();

  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get("tab") as TabId) || "solicitudes";

  function setTab(tab: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { preventScrollReset: true },
    );
  }

  function setPreset(preset: PresetRange) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("range", preset);
        if (preset !== "custom") {
          next.delete("from");
          next.delete("to");
        }
        return next;
      },
      { preventScrollReset: true },
    );
  }

  function setCustomDate(key: "from" | "to", value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("range", "custom");
        next.set(key, value);
        return next;
      },
      { preventScrollReset: true },
    );
  }

  const rangeFromDate = new Date(range.from);
  const rangeToDate = new Date(range.to);
  const rangeDays = Math.ceil(
    (rangeToDate.getTime() - rangeFromDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const groupTendenciaByWeek = rangeDays > WEEKLY_GROUPING_THRESHOLD_DAYS;

  const tendenciaData = groupTendenciaByWeek
    ? bucketTendenciaByWeek(applications.tendencia, rangeFromDate)
    : applications.tendencia.map((t: any) => ({
        fecha: new Date(`${t.fecha}T00:00:00`).toLocaleDateString("es-GT", {
          day: "2-digit",
          month: "short",
        }),
        total: t.total,
      }));

  const estadoData = Object.entries(applications.porEstado).map(
    ([status, total]) => ({
      estado: STATUS_LABELS[status] ?? status,
      total,
    }),
  );

  const donationEstadoData = Object.entries(donations.porEstado).map(
    ([status, total]) => ({
      estado: DONATION_STATUS_LABELS[status] ?? status,
      total,
    }),
  );

  const donationTipoData = Object.entries(donations.porTipo).map(
    ([tipo, total]) => ({
      tipo,
      total,
    }),
  );

  const origenData = donationOrigen.porOrigen.map((o: any) => ({
    origen: ORIGEN_LABELS[o.origen] ?? o.origen,
    total: o.total,
  }));

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-6 overflow-y-auto">
      <StatsHeader
        title="Estadísticas"
        preset={range.preset}
        customFrom={searchParams.get("from") || ""}
        customTo={searchParams.get("to") || ""}
        onPresetChange={setPreset}
        onCustomDateChange={setCustomDate}
        activeTabId={activeTab}
        activeTabLabel={
          TABS.find((t) => t.id === activeTab)?.label ?? activeTab
        }
      />

      <Tabs
        tabs={TABS}
        activeId={activeTab}
        onChange={setTab}
        ariaLabel="Secciones de estadísticas"
        idPrefix="estadisticas"
      />

      {/* ── Pestaña: Solicitudes ── */}
      <div
        role="tabpanel"
        id="estadisticas-panel-solicitudes"
        aria-labelledby="estadisticas-tab-solicitudes"
        hidden={activeTab !== "solicitudes"}
        className={
          activeTab === "solicitudes" ? "flex flex-col gap-y-6" : "hidden"
        }
      >
        {/* ── KPIs de solicitudes ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            icon={<FaClipboardCheck className="w-4 h-4" />}
            label="Solicitudes en el periodo"
            value={applications.totalEnPeriodo}
            color="text-[#4674EA]"
            bg="bg-[#4674EA]/10"
          />
          <KpiCard
            icon={<FaClipboardCheck className="w-4 h-4" />}
            label="Tasa de aprobación"
            value={`${applications.tasaAprobacion.toFixed(0)}%`}
            color="text-[#52C9BB]"
            bg="bg-[#52C9BB]/10"
          />
          <KpiCard
            icon={<FaClock className="w-4 h-4" />}
            label="Tiempo promedio de decisión"
            value={
              applications.tiempoPromedioDecisionDias !== null
                ? `${applications.tiempoPromedioDecisionDias.toFixed(1)} días`
                : "Sin datos"
            }
            color="text-[#F2B84B]"
            bg="bg-[#F2B84B]/10"
          />
        </div>

        {/* ── Solicitudes y adopciones ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Solicitudes y adopciones
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-2">
                Tendencia de solicitudes recibidas
                {groupTendenciaByWeek && " (agrupado por semana)"}
              </p>
              {applications.totalEnPeriodo === 0 ? (
                <EmptyChartState message="No hay solicitudes registradas en este periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={tendenciaData}>
                    <defs>
                      <linearGradient
                        id="colorTotal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#52C9BB"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#52C9BB"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#52C9BB"
                      fill="url(#colorTotal)"
                      name="Solicitudes"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">
                Distribución por estado
              </p>
              {applications.totalEnPeriodo === 0 ? (
                <EmptyChartState message="No hay solicitudes registradas en este periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={estadoData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      dataKey="estado"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {estadoData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Motivos de rechazo recientes */}
          <div className="mt-6">
            <p className="text-xs text-gray-400 mb-3">
              Motivos de rechazo recientes
            </p>
            {applications.motivosRechazoRecientes.length === 0 ? (
              <EmptyChartState message="No hay motivos de rechazo registrados en este periodo." />
            ) : (
              <div className="flex flex-col gap-2">
                {applications.motivosRechazoRecientes.map(
                  (m: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-sm bg-[#F2768C]/5 border border-[#F2768C]/20 rounded-xl px-4 py-2.5"
                    >
                      <span className="font-semibold text-gray-700 flex-shrink-0">
                        {m.pet_name}:
                      </span>
                      <span className="text-gray-600">{m.reason}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Pestaña: Catálogo ── */}
      <div
        role="tabpanel"
        id="estadisticas-panel-catalogo"
        aria-labelledby="estadisticas-tab-catalogo"
        hidden={activeTab !== "catalogo"}
        className={
          activeTab === "catalogo" ? "flex flex-col gap-y-6" : "hidden"
        }
      >
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Catálogo de mascotas
            </h2>
            <span className="text-xs text-gray-400">
              Estado actual, no depende del filtro de fecha
            </span>
          </div>

          {catalog.total === 0 ? (
            <EmptyChartState message="Todavía no hay mascotas registradas en el catálogo." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="flex flex-col justify-center gap-4">
                <StatRow label="Total en catálogo" value={catalog.total} />
                <StatRow
                  label="Disponibles"
                  value={catalog.disponibles}
                  accent="text-[#52C9BB]"
                />
                <StatRow
                  label="Adoptados"
                  value={catalog.adoptados}
                  accent="text-[#4674EA]"
                />
                <StatRow
                  label="Vacunados"
                  value={`${catalog.porcentajeVacunados.toFixed(0)}%`}
                />
                <StatRow
                  label="Esterilizados"
                  value={`${catalog.porcentajeEsterilizados.toFixed(0)}%`}
                />
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2">Por especie</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={catalog.porEspecie}
                      dataKey="total"
                      nameKey="especie"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {catalog.porEspecie.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2">Por tamaño</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catalog.porTamano} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      type="category"
                      dataKey="tamano"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                      width={70}
                    />
                    <Tooltip />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                      {catalog.porTamano.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2">Por género</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catalog.porGenero}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      dataKey="genero"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {catalog.porGenero.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Pestaña: Interés de adoptantes ── */}
      <div
        role="tabpanel"
        id="estadisticas-panel-interes"
        aria-labelledby="estadisticas-tab-interes"
        hidden={activeTab !== "interes"}
        className={activeTab === "interes" ? "flex flex-col gap-y-6" : "hidden"}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<FaHeart className="w-4 h-4" />}
            label="Mascotas guardadas en el periodo"
            value={savedCountInRange}
            color="text-[#F2768C]"
            bg="bg-[#F2768C]/10"
          />
        </div>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Mascotas más guardadas por adoptantes
          </h2>

          {topSaved.length === 0 ? (
            <EmptyChartState message="No hay mascotas guardadas como favoritas en este periodo." />
          ) : (
            <div className="flex flex-col gap-3">
              {topSaved.map((p: any, i: number) => (
                <div
                  key={p.pet_id}
                  className="flex items-center gap-4 rounded-xl border border-gray-100 px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-full bg-[#F2768C]/10 text-[#F2768C] flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400">{p.species}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-shrink-0">
                    <FaHeart className="w-3.5 h-3.5 text-[#F2768C]" />
                    {p.totalGuardados}
                  </div>
                  {!p.tieneSolicitud && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex-shrink-0">
                      Sin solicitud aún
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Pestaña: Donaciones ── */}
      <div
        role="tabpanel"
        id="estadisticas-panel-donaciones"
        aria-labelledby="estadisticas-tab-donaciones"
        hidden={activeTab !== "donaciones"}
        className={
          activeTab === "donaciones" ? "flex flex-col gap-y-6" : "hidden"
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            icon={<BiSolidDonateHeart className="w-4 h-4" />}
            label="Donaciones en el periodo"
            value={donations.totalEnPeriodo}
            color="text-[#4674EA]"
            bg="bg-[#4674EA]/10"
          />
          <KpiCard
            icon={<FaClipboardCheck className="w-4 h-4" />}
            label="Tasa de confirmación"
            value={`${donations.tasaConfirmacion.toFixed(0)}%`}
            color="text-[#52C9BB]"
            bg="bg-[#52C9BB]/10"
          />
          <KpiCard
            icon={<FaMoneyBillWave className="w-4 h-4" />}
            label="Monto confirmado"
            value={formatCurrency(donations.montoConfirmado)}
            color="text-[#F2B84B]"
            bg="bg-[#F2B84B]/10"
          />
        </div>

        {/* ── Distribución por estado y por tipo ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Donaciones por estado y tipo
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-2">
                Distribución por estado
              </p>
              {donations.totalEnPeriodo === 0 ? (
                <EmptyChartState message="No hay donaciones registradas en este periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={donationEstadoData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      dataKey="estado"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {donationEstadoData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">
                Distribución por tipo
              </p>
              {donations.totalEnPeriodo === 0 ? (
                <EmptyChartState message="No hay donaciones registradas en este periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={donationTipoData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      dataKey="tipo"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {donationTipoData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* ── Origen y top proyectos ──
            Desglose por origen (individual/patrocinador) y ranking de
            proyectos ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Origen de las donaciones y proyectos más apoyados
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-2">Por origen</p>
              {donations.totalEnPeriodo === 0 ? (
                <EmptyChartState message="No hay donaciones registradas en este periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={origenData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F0EDE5"
                    />
                    <XAxis
                      dataKey="origen"
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="#B9B3A4"
                    />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {origenData.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-3">
                Top proyectos con más donaciones
              </p>
              {donationOrigen.topProyectos.length === 0 ? (
                <EmptyChartState message="No hay donaciones asociadas a proyectos en este periodo." />
              ) : (
                <div className="flex flex-col gap-3">
                  {donationOrigen.topProyectos.map((p: any, i: number) => (
                    <div
                      key={p.proyecto_id}
                      className="flex items-center gap-4 rounded-xl border border-gray-100 px-4 py-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#4674EA]/10 text-[#4674EA] flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {p.nombre}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.totalDonaciones} donaciones
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-gray-600 flex-shrink-0">
                        {formatCurrency(p.montoConfirmado)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/*==============================| Subcomponentes ==============================*/
function KpiCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
      <div
        className={`w-8 h-8 rounded-full ${bg} ${color} flex items-center justify-center`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-lg font-bold ${accent ?? "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}

// Estado vacío consistente para cuando no hay datos en el rango de fecha
// seleccionado (reemplaza un gráfico o lista, en vez de dejarlo en blanco o roto).
function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 py-10 text-center">
      <FaInbox className="w-6 h-6 text-gray-300" aria-hidden />
      <p className="max-w-xs text-sm text-gray-400">{message}</p>
    </div>
  );
}
