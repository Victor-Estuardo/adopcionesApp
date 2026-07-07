import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaPaw, FaChevronRight, FaClipboardList } from "react-icons/fa";
import { toast } from "sonner";
import { ApplicationCard } from "~/components/Card/applicationCard";
import { config } from "~/config";
import {
  listAdoptionApplicationWithPetDb,
  ListApplicationWithPet,
} from "~/services/db/adoptionApplication.service";
import { getSession } from "~/services/sessions/sessions.service";
import { calculateAge, validatePermission } from "~/utils/common";
import { petImageUrl } from "~/utils/image";

export const meta = () => {
  return [{ title: "SOLICITUDES DE ADOPCIÓN" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // Verificamos que tenga permiso de Leer "mis solicitudes";
  const validateRequest = validatePermission(session, 7, "Leer");

  if (validateRequest) throw validateRequest;

  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    const applicationsRes = await listAdoptionApplicationWithPetDb({
      user_id: dbUserId || -100,
    });

    if (!applicationsRes.success)
      return json({
        errorMsg: "Ocurrió un error al cargar la pagina",
      });

    return json({
      applications: applicationsRes.data,
      cloudName: config.cloudinaryCloudName,
    });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pendiente: {
    label: "Pendiente",
    dot: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  en_revision: {
    label: "En revisión",
    dot: "bg-blue-400",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  aprobada: {
    label: "Aprobada",
    dot: "bg-teal-400",
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
  },
  rechazada: {
    label: "No aprobada",
    dot: "bg-red-400",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
} as const;

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // Lista de solicitudes
  const [applications, setApplications] = useState<ListApplicationWithPet[]>(
    [],
  );
  const [cloudName, setCloudName] = useState("");

  // Banderas
  const [isLoading, setIsLoading] = useState(true);

  // validar que no este vacio la lista
  const isEmpty = applications.length === 0;

  // Contadores por estado para el resumen
  const counts = applications.reduce((acc: any, a: any) => {
    const s = a.status as keyof typeof STATUS_CONFIG;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  /*------------------------------CARGA DE CATÁLOGOS------------------------------*/
  useEffect(() => {
    fetcher.submit(
      {
        action: "loadInformation",
      },
      { method: "post" },
    );
  }, []);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    // Mensaje de error durante algun proceso
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setIsLoading(false);
    }

    if (fetcher.data?.applications) {
      setApplications(fetcher.data.applications);
      setIsLoading(false);
    }

    if (fetcher.data?.cloudName) {
      setCloudName(fetcher.data?.cloudName);
    }
  }, [fetcher.data]);

  if (isLoading) {
    return (
      <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
        <div className="flex-grow flex justify-center items-center">
          <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-y-5 md:overflow-y-auto">
      <div className="w-full md:w-[80%] mx-auto flex flex-col gap-y-6">
        {/* ── Encabezado ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mis solicitudes</h1>
          <p className="text-sm text-gray-400 mt-1">
            {isEmpty
              ? "Aún no has enviado ninguna solicitud de adopción."
              : `aquí están todas tus solicitudes.`}
          </p>
        </div>

        {/* ── Resumen de estados (solo si hay solicitudes) ── */}
        {!isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              Object.entries(STATUS_CONFIG) as [
                keyof typeof STATUS_CONFIG,
                (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG],
              ][]
            ).map(([key, cfg]) => (
              <div
                key={key}
                className={`rounded-xl border p-4 flex flex-col gap-1 ${cfg.bg} ${cfg.border}`}
              >
                <span className={`text-2xl font-bold ${cfg.text}`}>
                  {counts[key] ?? 0}
                </span>
                <span className={`text-xs font-medium ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Lista de solicitudes ── */}
        {isEmpty ? (
          /* Estado vacío */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
              <FaClipboardList className="w-7 h-7 text-gray-300" />
            </div>
            <div>
              <p className="text-gray-600 font-medium">
                No tienes solicitudes aún
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Explora nuestro catálogo y encuentra a tu compañero ideal.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-all shadow-sm"
            >
              Ver mascotas en adopción
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {applications.map((app) => (
              <ApplicationCard key={app.id} app={app} cloudName={cloudName} />
            ))}
          </div>
        )}

        {/* ── CTA al catálogo ── */}
        {!isEmpty && (
          <div className="bg-teal-50 rounded-2xl border border-teal-100 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700">
                ¿Buscas otra mascota?
              </p>
              <p className="text-xs text-teal-500 mt-0.5">
                Explora más animales disponibles en adopción.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="flex-shrink-0 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-all shadow-sm"
            >
              Ver catálogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
