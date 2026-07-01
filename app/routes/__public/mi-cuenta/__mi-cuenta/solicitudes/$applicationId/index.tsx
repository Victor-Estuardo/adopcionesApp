import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  FaCheck,
  FaChevronLeft,
  FaClock,
  FaPaw,
  FaEnvelope,
  FaPhone,
} from "react-icons/fa";
import { toast } from "sonner";
import {
  AdoptionAppAllInfo,
  getAdoptionApplicationAllInfoDb,
} from "~/services/db/adoptionApplication.service";
import { getSession } from "~/services/sessions/sessions.service";

export const meta = () => {
  return [{ title: "PROGRESO DE SOLICITUD" }];
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request, params }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    // Obtenemos el id de la aplicación
    const { applicationId } = params;

    const applicationRes = await getAdoptionApplicationAllInfoDb({
      id: applicationId,
    });

    if (!applicationRes.success || !applicationRes.data) {
      return json({
        errorMsg: "Ocurrió un error al obtener la información de la solicitud",
      });
    }

    const application = applicationRes.data;

    // Solo el dueño puede ver su solicitud
    if (application.user_id != dbUserId) {
      throw new Response("No autorizado", { status: 403 });
    }

    return json({ application, first_name: session.get("first_name") || "" });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pendiente: {
    label: "Solicitud recibida",
    description: "Hemos recibido tu solicitud. La revisaremos pronto.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    step: 1,
  },
  en_revision: {
    label: "En revisión",
    description: "Estamos revisando tu solicitud actualmente.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-400",
    step: 2,
  },
  aprobada: {
    label: "¡Solicitud aprobada!",
    description:
      "Tu solicitud fue aprobada. Nos pondremos en contacto contigo.",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    dot: "bg-teal-400",
    step: 3,
  },
  rechazada: {
    label: "Solicitud no aprobada",
    description:
      "Lamentablemente tu solicitud no fue aprobada en esta ocasión.",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-400",
    step: 3,
  },
} as const;

const STEPS = ["Enviada", "En revisión", "Decisión final"];

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/*==============================| Component |==============================*/
export default function () {
  // Hooks...
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Datos de la aplicacion
  const [application, setApplication] = useState<AdoptionAppAllInfo>();

  // Datos del usuario
  const [firstName, setFirstName] = useState("");

  // Banderas de estado
  const [isLoading, setIsLoading] = useState(true);
  const recienEnviada = searchParams.get("enviada") === "true";
  const routeComing = searchParams.get("rc") || "pets";

  // Estado de solicitud
  const status =
    (application?.status as keyof typeof STATUS_CONFIG) ?? "pendiente";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente;

  // Agrupar respuestas por sección
  const answersBySection = application?.other_applicationAnswer.reduce<
    Record<string, typeof application.other_applicationAnswer>
  >((acc, a) => {
    const sec = a.formQuestion.section;
    acc[sec || "GENERAL"] = [...(acc[sec || "GENERAL"] ?? []), a];
    return acc;
  }, {});

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

    if (fetcher.data?.application) {
      setApplication(fetcher.data.application);
      setIsLoading(false);
    }

    if (fetcher.data?.first_name) {
      setFirstName(fetcher.data?.first_name);
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
    <div className="w-full h-full p-5 flex flex-col gap-y-5 md:overflow-y-auto">
      {/* Botón volver */}
      <button
        className="hidden md:flex max-w-max items-center gap-x-3 text-blue-meraki"
        onClick={() => navigate(-1)}
      >
        <FaChevronLeft className="w-6 h-6" />
        <span className="text-xl font-semibold">
          {routeComing === "applications"
            ? "Mis solicitudes"
            : "Información de mascota"}
        </span>
      </button>

      <div className="w-full md:w-[80%] mx-auto flex flex-col gap-y-6">
        {/* ── Banner de confirmación (solo si recién envió) ── */}
        {recienEnviada && (
          <div className="bg-teal-500 rounded-2xl p-3 md:p-6 flex items-center gap-4 text-white shadow-sm">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <FaCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                ¡Solicitud enviada con éxito!
              </p>
              <p className="text-teal-100 text-sm mt-0.5">
                Gracias {firstName}, revisaremos tu solicitud y te contactaremos
                pronto.
              </p>
            </div>
          </div>
        )}

        {/* ── Encabezado con info del animal ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 grid grid-cols-[min-content_1fr] md:flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
            {application?.pet.pet_images?.[0].path ? (
              <img
                src={application.pet.pet_images[0].path}
                className="w-full h-full object-cover"
              />
            ) : (
              <FaPaw className="w-7 h-7 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm md:text-xl font-bold text-gray-800 truncate">
              Solicitud para adoptar a{" "}
              <span className="text-teal-600">{application?.pet.name}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Enviada el {formatDate(application?.submitted_at || "")}
            </p>
          </div>
          {/* Badge de estado */}
          <div className="md:hidden"></div>
          <div
            className={`max-w-min text-nowrap justify-self-end flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold flex-shrink-0 ${config.bg} ${config.border} ${config.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {config.label}
          </div>
        </div>

        {/* ── Timeline de pasos ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Estado de tu solicitud
          </h2>

          <div className="flex items-center gap-0">
            {STEPS.map((stepLabel, i) => {
              const stepNum = i + 1;
              const isDone = config.step > stepNum;
              const isCurrent = config.step === stepNum;
              const isRejected = status === "rechazada" && stepNum === 3;

              return (
                <div
                  key={stepLabel}
                  className="flex items-center flex-1 last:flex-none"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                        ${
                          isDone
                            ? "bg-teal-500 text-white"
                            : isCurrent && !isRejected
                            ? "bg-teal-100 text-teal-600 ring-2 ring-teal-400 ring-offset-2"
                            : isRejected
                            ? "bg-red-100 text-red-500 ring-2 ring-red-300 ring-offset-2"
                            : "bg-gray-100 text-gray-400"
                        }`}
                    >
                      {isDone ? <FaCheck className="w-3.5 h-3.5" /> : stepNum}
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap
                        ${
                          isCurrent
                            ? config.color
                            : isDone
                            ? "text-teal-600"
                            : "text-gray-400"
                        }`}
                    >
                      {stepLabel}
                    </span>
                  </div>

                  {/* Línea conectora */}
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all
                      ${
                        config.step > stepNum + 1 || isDone
                          ? "bg-teal-400"
                          : "bg-gray-100"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <p
            className={`mt-5 text-sm rounded-xl px-4 py-3 border ${config.bg} ${config.border} ${config.color}`}
          >
            <FaClock className="inline w-3.5 h-3.5 mr-1.5" />
            {config.description}
          </p>
        </div>

        {/* ── Resumen de respuestas ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Tus respuestas
          </h2>

          <div className="flex flex-col gap-6">
            {Object.entries(answersBySection ?? {}).map(
              ([section, answers]) => (
                <div key={section}>
                  <h3 className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                    {section}
                  </h3>
                  <div className="flex flex-col gap-3">
                    {answers.map((a) => (
                      <div key={a.id} className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-400">
                          {a.formQuestion.question_text}
                        </span>
                        <span className="text-sm text-gray-700 font-medium">
                          {a.answer_value || (
                            <span className="text-gray-300 italic">
                              Sin respuesta
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* ── Firma del compromiso ── */}
        {application?.commitmentAgreement?.[0] && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Carta de compromiso
            </h2>
            <div className="flex items-center gap-3 text-sm text-teal-700 bg-teal-50 rounded-xl px-4 py-3 border border-teal-100">
              <FaCheck className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <span>
                Firmada digitalmente el{" "}
                {formatDate(application.commitmentAgreement[0].signed_at)}
              </span>
            </div>
          </div>
        )}

        {/* ── Contacto ── */}
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-3">
            ¿Tienes alguna pregunta sobre tu solicitud?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="mailto:adopciones@meraki.org"
              className="flex items-center gap-2 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors"
            >
              <FaEnvelope className="w-4 h-4" />
              adopciones@meraki.org
            </a>
            <a
              href="tel:+50212345678"
              className="flex items-center gap-2 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors"
            >
              <FaPhone className="w-4 h-4" />
              +502 1234-5678
            </a>
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="flex gap-3 justify-end pb-6">
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            Ver más mascotas
          </button>
          <button
            onClick={() => navigate(`/mascota/${application?.pet.id}`)}
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-all shadow-sm"
          >
            Ver a {application?.pet.name}
          </button>
        </div>
      </div>
    </div>
  );
}
