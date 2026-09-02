import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  FaCheck,
  FaChevronLeft,
  FaEnvelope,
  FaPhone,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import { toast } from "sonner";
import { ApplicationDetailCard } from "~/components/Card/ApplicationDetailCard";
import { ApplicationPanel } from "~/components/Panel/ApplicationPanel";
import { ApplicationTimeLine } from "~/components/TimeLine/ApplicationTimeLine";
import { config } from "~/config";
import { PermissionSession } from "~/services/auth/login.service";
import {
  AdoptionAppAllInfo,
  getAdoptionApplicationAllInfoDb,
  getAdoptionApplicationDb,
  updateAdoptionApplicationDb,
} from "~/services/db/adoptionApplication.service";
import {
  EssentialInfoUser,
  getEssentialUserDb,
} from "~/services/db/user.service";
import { sendApplicationDecisionEmail } from "~/services/mail/resend.service";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";

// Notifica al adoptante que se tomó una decisión, sin revelar cuál, con un link a su solicitud
async function notifyAdopterDecision(
  request: Request,
  userId: number,
  applicationId: string,
) {
  try {
    const adopterRes = await getEssentialUserDb({ id: userId });

    if (!adopterRes.success || !adopterRes.data) return;

    const baseUrl = new URL(request.url).origin;
    const applicationUrl = `${baseUrl}/mi-cuenta/solicitudes/${applicationId}`;

    await sendApplicationDecisionEmail(
      adopterRes.data.email,
      applicationUrl,
      adopterRes.data.first_name,
    );
  } catch (error) {
    console.error(
      "No se pudo notificar al adoptante sobre la decisión de su solicitud:",
      error,
    );
  }
}

export const meta = () => {
  return [{ title: "PROGRESO DE SOLICITUD" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request, params }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // Verificamos que tenga permiso de Leer "mis solicitudes";
  const validateRequest = validatePermission(session, 10, "Leer");

  if (validateRequest) throw validateRequest;

  // Obtenemos el id de la aplicación
  const { applicationId } = params;

  // Si es una solicitud pendiente se marca como en revision
  const applicationRes = await getAdoptionApplicationDb({
    id: applicationId || "-1000000000",
  });

  if (
    applicationRes.success &&
    applicationId &&
    applicationRes.data?.status === "pendiente"
  ) {
    // Editamos el status
    await updateAdoptionApplicationDb(applicationId, {
      status: "en_revision",
      updated_at: new Date(),
    });
  }

  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request, params }) => {
  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  // Obtenemos el id de la aplicación
  const { applicationId = "" } = params;

  if (action === "loadInformation") {
    // Información de la solicitud
    const applicationRes = await getAdoptionApplicationAllInfoDb({
      id: applicationId || "-1000000000",
    });

    if (!applicationRes.success || !applicationRes.data) {
      return json({
        errorMsg: "Ocurrió un error al obtener la información de la solicitud",
      });
    }

    const application = applicationRes.data;

    // Información del adoptante
    const adopterRes = await getEssentialUserDb({
      id: application.user_id,
    });

    if (!adopterRes.success || !adopterRes.data) {
      return json({
        errorMsg: "Ocurrió un error al obtener la información de la solicitud",
      });
    }

    const cookie = request.headers.get("cookie");
    const session = await getSession(cookie);

    // Obtenemos los permisos
    const permissions: PermissionSession[] = session.get("permissions") || [];

    return json({
      application,
      adopter: adopterRes.data,
      cloudName: config.cloudinaryCloudName,
      allowedToUpdate: !!permissions.find(
        (p) => p.module_id === 10 && p.action === "Actualizar",
      ),
    });
  }

  if (action === "approve") {
    const updateRes = await updateAdoptionApplicationDb(applicationId, {
      status: "aprobada",
      updated_at: new Date(),
    });

    if (!updateRes.success) {
      return json({ errorMsg: "Ocurrió un error al aprobar la solicitud" });
    }

    await notifyAdopterDecision(
      request,
      updateRes.data.user_id,
      applicationId,
    );

    return json({ confirmed: true, newStatus: "aprobada" });
  }

  if (action === "reject") {
    const rejectionReason = String(
      formData.get("rejection_reason") || "",
    ).trim();

    if (!rejectionReason) {
      return json({ errorMsg: "Debes indicar un motivo de rechazo" });
    }

    const updateRes = await updateAdoptionApplicationDb(applicationId, {
      status: "rechazada",
      rejection_reason: rejectionReason,
      updated_at: new Date(),
    });

    if (!updateRes.success) {
      return json({ errorMsg: "Ocurrió un error al rechazar la solicitud" });
    }

    await notifyAdopterDecision(
      request,
      updateRes.data.user_id,
      applicationId,
    );

    return json({ deleted: true, newStatus: "rechazada" });
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

  // Banderas de estado
  const [isLoading, setIsLoading] = useState(true);
  const [allowedToUpdate, setAllowedToUpdate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | null
  >(null);
  const isSubmitting = fetcher.state !== "idle";

  // Datos de rechazo
  const [rejectionReason, setRejectionReason] = useState("");

  // Datos de la aplicacion
  const [application, setApplication] = useState<AdoptionAppAllInfo>();
  const [cloudName, setCloudName] = useState("");

  // Datos del adoptante
  const [adopter, setAdopter] = useState<EssentialInfoUser | null>(null);

  // Estado de solicitud
  const status = application?.status || "pendiente";
  const canDecide = status === "pendiente" || status === "en_revision";

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

    if (fetcher.data?.adopter) {
      setAdopter(fetcher.data.adopter);
    }

    if (fetcher.data?.allowedToUpdate) {
      setAllowedToUpdate(true);
    }

    if (fetcher.data?.confirmed) {
      toast.success("Solicitud aprobada correctamente");
      setConfirmAction(null);
      setRejectionReason("");
      setApplication((prev) =>
        prev ? { ...prev, status: "aprobada" } : undefined,
      );
    }

    if (fetcher.data?.deleted) {
      toast.success("Solicitud rechazada correctamente");
      setConfirmAction(null);
      setRejectionReason("");
      setApplication((prev) =>
        prev ? { ...prev, status: "rechazada" } : undefined,
      );
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Arma el link de WhatsApp con el teléfono del adoptante y un mensaje inicial
  function buildWhatsAppUrl(
    phone: string,
    applicantName: string,
    petName: string,
  ) {
    const digits = phone.replace(/\D/g, "");
    const withCountryCode = digits.startsWith("502") ? digits : `502${digits}`;
    const message = encodeURIComponent(
      `Hola ${applicantName}, te escribimos de Meraki respecto a tu solicitud de adopción de ${petName}. Nos gustaría coordinar una reunión contigo.`,
    );
    return `https://wa.me/${withCountryCode}?text=${message}`;
  }

  // Función para aprobar solicitudes
  function handleApprove() {
    fetcher.submit({ action: "approve" }, { method: "post" });
  }

  // Función para rechazar solicitudes
  function handleReject() {
    if (!rejectionReason.trim()) {
      toast.error("No puede mandar una razon vacia");
      return;
    }

    fetcher.submit(
      { action: "reject", rejection_reason: rejectionReason },
      { method: "post" },
    );
  }

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
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto ">
      <button
        className="hidden md:flex max-w-max items-center gap-x-3 text-blue-meraki"
        onClick={() => navigate(-1)}
      >
        <FaChevronLeft className="w-5 h-5" />
        <span className="text-lg font-semibold">Solicitudes</span>
      </button>

      <div className="w-full md:w-[85%] mx-auto flex flex-col gap-y-6">
        {/* ── Encabezado con info del animal ── */}
        <ApplicationDetailCard
          application={application}
          cloudName={cloudName}
        />

        {/* ── Info del adoptante ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Datos del adoptante
          </h2>
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4674EA]/10 text-[#4674EA] flex items-center justify-center font-semibold flex-shrink-0">
                {adopter?.first_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {adopter?.first_name} {adopter?.last_name}
                </p>
                <p className="text-xs text-gray-400">Solicitante</p>
              </div>
            </div>
            <a
              href={`mailto:${adopter?.email}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#52C9BB] transition-colors"
            >
              <FaEnvelope className="w-4 h-4" />
              {adopter?.email}
            </a>
            {adopter?.phone && (
              <a
                href={`tel:${adopter.phone}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#52C9BB] transition-colors"
              >
                <FaPhone className="w-4 h-4" />
                {adopter.phone}
              </a>
            )}
          </div>

          {/* CTA de WhatsApp solo cuando la solicitud ya fue aprobada */}
          {status === "aprobada" && adopter?.phone && (
            <a
              href={buildWhatsAppUrl(
                adopter.phone,
                adopter.first_name,
                application?.pet.name || "",
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-semibold transition-all shadow-sm"
            >
              <FaWhatsapp className="w-4 h-4" />
              Contactar por WhatsApp para coordinar reunión
            </a>
          )}
        </div>

        {/* ── Timeline de estado ── */}
        <ApplicationTimeLine application={application}>
          {/* Motivo de rechazo, si aplica */}
          {status === "rechazada" && application?.rejection_reason && (
            <div className="mt-3 text-sm rounded-xl px-4 py-3 border border-gray-200 bg-gray-50 text-gray-600">
              <span className="font-semibold text-gray-700">
                Motivo del rechazo:{" "}
              </span>
              {application.rejection_reason}
            </div>
          )}

          {/* Acciones de decisión */}
          {canDecide && allowedToUpdate && (
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction("reject")}
                className="px-5 py-2.5 rounded-xl border border-[#F2768C] text-sm font-semibold text-[#F2768C] hover:bg-[#F2768C]/5 transition-all"
              >
                Rechazar
              </button>
              <button
                onClick={() => setConfirmAction("approve")}
                className="px-5 py-2.5 rounded-xl bg-[#52C9BB] hover:bg-[#52C9BB]/90 text-white text-sm font-semibold transition-all shadow-sm"
              >
                Aprobar solicitud
              </button>
            </div>
          )}
        </ApplicationTimeLine>

        {/* ── Respuestas del formulario ── */}
        <ApplicationPanel application={application} />

        {/* ── Carta de compromiso ── */}
        {application?.commitmentAgreement?.[0] && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Carta de compromiso
            </h2>
            <div className="flex items-center gap-3 text-sm text-[#52C9BB] bg-[#52C9BB]/5 rounded-xl px-4 py-3 border border-[#52C9BB]/20">
              <FaCheck className="w-4 h-4 flex-shrink-0" />
              <span>
                Firmada digitalmente el{" "}
                {formatDate(application.commitmentAgreement[0].signed_at)}
                {application.commitmentAgreement[0].ip_address &&
                  ` · IP ${application.commitmentAgreement[0].ip_address}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación ── */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                {confirmAction === "approve"
                  ? "Aprobar solicitud"
                  : "Rechazar solicitud"}
              </h3>
              <button
                onClick={() => setConfirmAction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            {confirmAction === "approve" ? (
              <p className="text-sm text-gray-500">
                Estás por aprobar la solicitud de{" "}
                <span className="font-semibold text-gray-700">
                  {adopter?.first_name}
                </span>{" "}
                para adoptar a{" "}
                <span className="font-semibold text-gray-700">
                  {application?.pet.name}
                </span>
                . Después de aprobar, contáctalo por WhatsApp para coordinar la
                reunión.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Indica el motivo del rechazo. Este texto es de uso interno del
                  albergue.
                </p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="Ej. No cumple con el espacio mínimo requerido..."
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F2768C]/30 resize-none"
                />
              </>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                disabled={
                  isSubmitting ||
                  (confirmAction === "reject" && !rejectionReason.trim())
                }
                onClick={
                  confirmAction === "approve" ? handleApprove : handleReject
                }
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                  confirmAction === "approve"
                    ? "bg-[#52C9BB] hover:bg-[#52C9BB]/90"
                    : "bg-[#F2768C] hover:bg-[#F2768C]/90"
                }`}
              >
                {isSubmitting
                  ? "Procesando..."
                  : confirmAction === "approve"
                  ? "Confirmar aprobación"
                  : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
