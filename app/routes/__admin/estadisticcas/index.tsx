import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
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
import { FaHeart, FaClipboardCheck, FaClock, FaPaw } from "react-icons/fa";
import {
  ApplicationsStats,
  PetsCatalogStats,
  TopSavedPet,
  countSavedPetsInRangeDb,
  getApplicationsStatsDb,
  getPetsCatalogStatsDb,
  getTopSavedPetsDb,
} from "~/services/db/stats.service";
import { getSession } from "~/services/sessions/sessions.service";

export const meta = () => {
  return [{ title: "ESTADÍSTICAS" }];
};

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

type PresetRange = "7d" | "30d" | "90d" | "mes_actual" | "custom";

// Calcula el rango de fechas real a partir del preset o de fechas personalizadas
function resolveDateRange(
  preset: PresetRange,
  customFrom?: string | null,
  customTo?: string | null,
) {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (preset === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const toCustom = new Date(customTo);
    toCustom.setHours(23, 59, 59, 999);
    return { from, to: toCustom };
  }

  if (preset === "mes_actual") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  /*const validateRequest = validatePermission(session, MODULE_ID_ESTADISTICAS, "Leer");
  if (validateRequest) throw validateRequest;*/

  const url = new URL(request.url);
  const preset = (url.searchParams.get("range") as PresetRange) || "30d";
  const customFrom = url.searchParams.get("from");
  const customTo = url.searchParams.get("to");

  const { from, to } = resolveDateRange(preset, customFrom, customTo);

  const [applicationsRes, catalogRes, topSavedRes, savedCountRes] =
    await Promise.all([
      getApplicationsStatsDb(from, to),
      getPetsCatalogStatsDb(),
      getTopSavedPetsDb(from, to, 5),
      countSavedPetsInRangeDb(from, to),
    ]);

  if (
    !applicationsRes.success ||
    !catalogRes.success ||
    !topSavedRes.success ||
    !savedCountRes.success
  ) {
    return json({ errorMsg: "Ocurrió un error al cargar las estadísticas" });
  }

  return json({
    applications: applicationsRes.data,
    catalog: catalogRes.data,
    topSaved: topSavedRes.data,
    savedCountInRange: savedCountRes.data,
    range: { preset, from: from.toISOString(), to: to.toISOString() },
  });
};

/*==============================| Component |==============================*/
export default function () {
  const { applications, catalog, topSaved, savedCountInRange, range } =
    useLoaderData(); /* as {
    applications: ApplicationsStats;
    catalog: PetsCatalogStats;
    topSaved: TopSavedPet[];
    savedCountInRange: number;
    range: { preset: PresetRange; from: string; to: string };
  }*/

  const [searchParams, setSearchParams] = useSearchParams();

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

  const tendenciaData = applications.tendencia.map((t: any) => ({
    fecha: new Date(t.fecha).toLocaleDateString("es-GT", {
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

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-6 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Estadísticas</h1>

        {/* ── Filtro de rango de fechas ── */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "7d", label: "7 días" },
              { key: "30d", label: "30 días" },
              { key: "90d", label: "90 días" },
              { key: "mes_actual", label: "Este mes" },
            ] as { key: PresetRange; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPreset(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range.preset === opt.key
                  ? "bg-[#52C9BB] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              defaultValue={searchParams.get("from") || ""}
              onChange={(e) => setCustomDate("from", e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-600"
            />
            <span className="text-gray-400 text-sm">-</span>
            <input
              type="date"
              defaultValue={searchParams.get("to") || ""}
              onChange={(e) => setCustomDate("to", e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-600"
            />
          </div>
        </div>
      </div>

      {/* ── KPIs de resumen ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <KpiCard
          icon={<FaHeart className="w-4 h-4" />}
          label="Mascotas guardadas en el periodo"
          value={savedCountInRange}
          color="text-[#F2768C]"
          bg="bg-[#F2768C]/10"
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
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={tendenciaData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52C9BB" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#52C9BB" stopOpacity={0} />
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
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">
              Distribución por estado
            </p>
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
          </div>
        </div>

        {/* Motivos de rechazo recientes */}
        {applications.motivosRechazoRecientes.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-gray-400 mb-3">
              Motivos de rechazo recientes
            </p>
            <div className="flex flex-col gap-2">
              {applications.motivosRechazoRecientes.map((m: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm bg-[#F2768C]/5 border border-[#F2768C]/20 rounded-xl px-4 py-2.5"
                >
                  <span className="font-semibold text-gray-700 flex-shrink-0">
                    {m.pet_name}:
                  </span>
                  <span className="text-gray-600">{m.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Catálogo de mascotas ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Catálogo de mascotas
          </h2>
          <span className="text-xs text-gray-400">
            Estado actual, no depende del filtro de fecha
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <Bar dataKey="total" fill="#4674EA" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Interés de adoptantes ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
          Mascotas más guardadas por adoptantes
        </h2>

        {topSaved.length === 0 ? (
          <p className="text-sm text-gray-400">
            No hay mascotas guardadas como favoritas en este periodo.
          </p>
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
