import { ActionFunction, json } from "@remix-run/node";
import { useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaCheck, FaChevronLeft, FaEnvelope, FaPhone } from "react-icons/fa";
import { toast } from "sonner";
import { ApplicationDetailCard } from "~/components/Card/ApplicationDetailCard";
import { ApplicationPanel } from "~/components/Panel/ApplicationPanel";
import { ApplicationTimeLine } from "~/components/TimeLine/ApplicationTimeLine";
import { config } from "~/config";
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

    return json({
      application,
      first_name: session.get("first_name") || "",
      cloudName: config.cloudinaryCloudName,
    });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

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
  const [cloudName, setCloudName] = useState("");

  // Datos del usuario
  const [firstName, setFirstName] = useState("");

  // Banderas de estado
  const [isLoading, setIsLoading] = useState(true);
  const recienEnviada = searchParams.get("enviada") === "true";
  const routeComing = searchParams.get("rc") || "pets";

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

    if (fetcher.data?.cloudName) {
      setCloudName(fetcher.data.cloudName);
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
        <ApplicationDetailCard
          application={application}
          cloudName={cloudName}
        />

        {/* ── Timeline de pasos ── */}
        <ApplicationTimeLine application={application} adopter />

        {/* ── Resumen de respuestas ── */}
        <ApplicationPanel application={application} />

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
