import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { useState } from "react";
import { IconType } from "react-icons";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  FaBoxOpen,
  FaBuilding,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaGlobe,
  FaHandHoldingHeart,
  FaMoneyBillWave,
  FaRegImage,
  FaUniversity,
  FaWhatsapp,
} from "react-icons/fa";
import { PrimaryButton } from "~/components/Button/primary";
import { SecondaryButton } from "~/components/Button/secondary";
import { NotifyDonationModal } from "~/components/Modal/NotifyDonationModal";
import Tabs, { TabItem } from "~/components/Tabs";
import {
  DonationMethod,
  listActiveDonationMethodsDb,
  listDonationBankAccountDb,
} from "~/services/db/donationBankAccount.service";
import {
  createDonationDb,
  DonationTransparencySummary,
  getDonationTransparencySummaryDb,
  listPublicDonationsDb,
  PublicDonation,
  updateDonationDb,
} from "~/services/db/donation.service";
import {
  listActiveNeededSuppliesDb,
  NeededSupply,
} from "~/services/db/needSupplies.service";
import {
  listActiveSponsorDb,
  PublicSponsor,
} from "~/services/db/sponsor.service";
import {
  listPublicProjectsDb,
  PublicProject,
} from "~/services/db/project.service";
import { getEssentialUserDb } from "~/services/db/user.service";
import {
  DONATION_RECEIPT_MAX_MB,
  DONATION_RECEIPT_MIME_TYPES,
} from "~/services/cloudinary/fileConstraints";
import { uploadDonationReceipt } from "~/services/cloudinary/upload";
import { getSession } from "~/services/sessions/sessions.service";
import { getInitials } from "~/utils/common";
import { buildDonationWhatsAppUrl } from "~/utils/whatsapp";
import {
  sanitizeAmount,
  sanitizeEmail,
  sanitizeLimit,
  sanitizePhone,
  sanitizeText,
} from "~/utils/sanitize";

export const meta = () => {
  return [{ title: "DONACIONES" }];
};

/* Etiqueta legible para el tipo de cuenta (el enum de Prisma llega como su
   identificador: "Ahorro", "Pr_stamo", ...). */
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  Monetaria: "Cuenta Monetaria",
  Ahorro: "Cuenta de Ahorro",
  Pr_stamo: "Préstamo",
  Tarjeta_de_cr_dito: "Tarjeta de crédito",
};

/*==============================| Loader |==============================*/
type LoaderData = {
  donationMethods: DonationMethod[];
  neededSupplies: NeededSupply[];
  transparencySummary: DonationTransparencySummary | null;
  latestDonations: PublicDonation[];
  sponsors: PublicSponsor[];
  projects: PublicProject[];
  isAuthenticated: boolean;
  errorMsg?: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const isAuthenticated = Boolean(session.get("dbUserId"));

  const [
    methodsRes,
    suppliesRes,
    summaryRes,
    latestRes,
    sponsorsRes,
    projectsRes,
  ] = await Promise.all([
    listActiveDonationMethodsDb(),
    listActiveNeededSuppliesDb(20),
    getDonationTransparencySummaryDb(),
    listPublicDonationsDb(8),
    listActiveSponsorDb(50),
    listPublicProjectsDb(20),
  ]);

  if (
    !methodsRes.success ||
    !suppliesRes.success ||
    !summaryRes.success ||
    !latestRes.success ||
    !sponsorsRes.success ||
    !projectsRes.success
  ) {
    return json({
      donationMethods: [],
      neededSupplies: [],
      transparencySummary: null,
      latestDonations: [],
      sponsors: [],
      projects: [],
      isAuthenticated,
      errorMsg: "Ocurrió un error al cargar la información de donaciones",
    });
  }

  return json({
    donationMethods: methodsRes.data,
    neededSupplies: suppliesRes.data,
    transparencySummary: summaryRes.data,
    latestDonations: latestRes.data,
    sponsors: sponsorsRes.data,
    projects: projectsRes.data,
    isAuthenticated,
  });
};

/*==============================| Action |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const intent = formData.get("intent");

  /* ── un donante notifica una donación monetaria ya hecha ── */
  if (intent === "notify") {
    // Datos del donante: si está registrado se toman de su cuenta, no
    // del formulario; si es invitado, se exige nombre + un medio de contacto.
    let userId: number | null = null;
    let donorName: string | null = null;
    let donorEmail: string | null = null;
    let donorPhone: string | null = null;
    let bankAccountId: number | null = null;

    if (dbUserId) {
      // Donante registrado: los datos salen de su cuenta, no del formulario.
      const userRes = await getEssentialUserDb({ id: Number(dbUserId) });
      if (!userRes.success || !userRes.data) {
        return json({
          errorMsg: "No pudimos verificar tu cuenta. Vuelve a iniciar sesión.",
        });
      }
      userId = Number(dbUserId);
      donorName =
        sanitizeText(
          `${userRes.data.first_name} ${userRes.data.last_name}`,
          100,
        ) || null;
      donorEmail = sanitizeEmail(userRes.data.email);
      donorPhone = sanitizePhone(userRes.data.phone);
    } else {
      // Invitado: nombre obligatorio + al menos un medio de contacto.
      donorName = sanitizeText(formData.get("donorName"), 100) || null;
      donorEmail = sanitizeEmail(formData.get("donorEmail"));
      donorPhone = sanitizePhone(formData.get("donorPhone"));

      if (!donorName) {
        return json({
          errorMsg: "Indica tu nombre para registrar la donación.",
        });
      }
      if (!donorEmail && !donorPhone) {
        return json({
          errorMsg:
            "Indica al menos un medio de contacto: un correo o un teléfono.",
        });
      }
    }

    // Monto declarado (obligatorio; el confirmado lo pone administración).
    const rawDeclaredAmount = Number(formData.get("declaredAmount"));
    if (
      Number.isFinite(rawDeclaredAmount) &&
      rawDeclaredAmount > 9_999_999.99
    ) {
      return json({ errorMsg: "El monto es demasiado alto; verifícalo." });
    }

    const declaredAmount = sanitizeAmount(formData.get("declaredAmount"));
    if (!declaredAmount) {
      return json({ errorMsg: "Indica un monto válido mayor a cero." });
    }

    // Cuenta a la que se depositó (opcional). Si viene, debe existir y estar
    // activa: así no se guarda una referencia inventada.
    const rawBankAccountId = sanitizeLimit(formData.get("bankAccountId"), {
      max: 1_000_000,
    });
    if (rawBankAccountId !== undefined) {
      const accRes = await listDonationBankAccountDb({
        id: rawBankAccountId,
        active: true,
      });
      if (!accRes.success || accRes.data.length === 0) {
        return json({ errorMsg: "La cuenta seleccionada no es válida." });
      }
      bankAccountId = rawBankAccountId;
    }

    // Autorización de publicación y anonimato: el anonimato solo aplica
    // si la donación se autoriza como pública.
    const isPublic = formData.get("isPublic") === "on";
    const isAnonymous = isPublic && formData.get("visibility") === "anonimo";
    const comment = sanitizeText(formData.get("comment"), 1000) || null;

    // Comprobante (opcional): se valida tipo y tamaño ANTES de crear nada.
    const receiptEntry = formData.get("receipt");
    const receipt =
      receiptEntry && typeof receiptEntry !== "string" && receiptEntry.size > 0
        ? receiptEntry
        : null;
    if (receipt) {
      if (!DONATION_RECEIPT_MIME_TYPES.includes(receipt.type)) {
        return json({
          errorMsg:
            "El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF.",
        });
      }
      if (receipt.size > DONATION_RECEIPT_MAX_MB * 1024 * 1024) {
        return json({
          errorMsg: `El comprobante no debe superar los ${DONATION_RECEIPT_MAX_MB}MB.`,
        });
      }
    }

    // El sistema no puede confirmar una donación monetaria por sí solo (no hay
    // pasarela de pago): queda "pendiente" hasta revisión administrativa.
    const now = new Date();
    const createRes = await createDonationDb({
      user_id: userId,
      donor_name: donorName,
      donor_email: donorEmail,
      donor_phone: donorPhone,
      donation_type: "Monetaria",
      declared_amount: declaredAmount,
      bank_account_id: bankAccountId,
      status: "pendiente",
      is_public: isPublic,
      is_anonymous: isAnonymous,
      comment,
      submitted_at: now,
      updated_at: now,
    });

    if (!createRes.success) {
      return json({ errorMsg: "Ocurrió un error al registrar tu donación." });
    }

    // Subir el comprobante y enlazarlo. Si la subida falla, la donación ya
    // quedó registrada: administración puede pedir el comprobante después, no
    // se pierde la notificación por eso.
    if (receipt) {
      const uploadRes = await uploadDonationReceipt(receipt, createRes.data.id);
      if (uploadRes.success) {
        await updateDonationDb(createRes.data.id, {
          receipt_url: uploadRes.data.secure_url,
        });
      }
    }

    return json({ notifySuccess: true });
  }

  return json({ errorMsg: "Acción no reconocida." }, { status: 400 });
};

const TABS = [
  { id: "apoyar", label: "Cómo apoyar" },
  { id: "donantes", label: "Nuestros donantes" },
  { id: "patrocinadores", label: "Patrocinadores y proyectos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/*==============================| Component |==============================*/
export default function () {
  const {
    donationMethods,
    neededSupplies,
    transparencySummary,
    latestDonations,
    sponsors,
    projects,
    isAuthenticated,
    errorMsg,
  } = useLoaderData<LoaderData>();
  const [activeTab, setActiveTab] = useState<TabId>("apoyar");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const navigation = useNavigation();
  const revalidator = useRevalidator();

  const sectionState = {
    isLoading:
      navigation.state === "loading" || revalidator.state === "loading",
    hasError: Boolean(errorMsg),
    onRetry: () => revalidator.revalidate(),
  };

  const panels: Record<TabId, React.ReactNode> = {
    apoyar: (
      <ComoApoyarSection
        donationMethods={donationMethods}
        neededSupplies={neededSupplies}
        onNotify={() => setNotifyOpen(true)}
        {...sectionState}
      />
    ),
    donantes: (
      <NuestrosDonantesSection
        summary={transparencySummary}
        latestDonations={latestDonations}
        {...sectionState}
      />
    ),
    patrocinadores: (
      <PatrocinadoresProyectosSection
        sponsors={sponsors}
        projects={projects}
        {...sectionState}
      />
    ),
  };

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <div className="w-full md:w-[85%] mx-auto flex flex-col gap-y-6">
        {/* ── Encabezado de la página ── */}
        <header className="flex flex-col gap-y-2">
          <h1 className="text-blue-meraki text-xl md:text-3xl font-bold">
            Dona y ayuda a nuestros peludos
          </h1>
          <p className="text-gray-400 max-w-2xl">
            Cada aporte, en efectivo, transferencia o especie, ayuda a cubrir
            alimentación, medicinas y cuidados de los animales que esperan un
            hogar.
          </p>
        </header>

        {/* ── Navegación por pestañas ── */}
        <Tabs
          tabs={TABS as unknown as TabItem[]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          ariaLabel="Secciones de donaciones"
          idPrefix="donacion"
        />

        {/* ── Paneles ── */}
        {TABS.map(({ id }) => (
          <div
            key={id}
            role="tabpanel"
            id={`donacion-panel-${id}`}
            aria-labelledby={`donacion-tab-${id}`}
            tabIndex={0}
            hidden={id !== activeTab}
            className="focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-meraki/30"
          >
            {panels[id]}
          </div>
        ))}
      </div>

      {notifyOpen && (
        <NotifyDonationModal
          onClose={() => setNotifyOpen(false)}
          donationMethods={donationMethods}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}

/*==============================| Sección: Cómo apoyar |==============================*/
function ComoApoyarSection({
  donationMethods,
  neededSupplies,
  onNotify,
  isLoading,
  hasError,
  onRetry,
}: {
  donationMethods: DonationMethod[];
  neededSupplies: NeededSupply[];
  onNotify: () => void;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="como-apoyar-title"
      className="flex flex-col gap-y-8"
      aria-busy={isLoading}
    >
      <h2 id="como-apoyar-title" className="sr-only">
        Cómo apoyar
      </h2>

      {isLoading ? (
        <SectionLoading label="Cargando las formas de apoyar…" />
      ) : hasError ? (
        <SectionError
          message="No pudimos cargar las formas de apoyar en este momento. Revisa tu conexión e inténtalo de nuevo."
          onRetry={onRetry}
        />
      ) : (
        <>
          {/* ── Medios de donación ── */}
          <div className="flex flex-col gap-y-4">
            <SectionLabel>Medios de donación</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MedioCard Icon={FaUniversity} title="Transferencia o depósito">
                {donationMethods.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Por el momento no hay cuentas configuradas.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-gray-100 text-sm">
                    {donationMethods.map((acc) => (
                      <li key={acc.id} className="py-2 first:pt-0 last:pb-0">
                        <p className="font-semibold text-gray-700">
                          {acc.bank_name} —{" "}
                          {ACCOUNT_TYPE_LABEL[acc.account_type] ??
                            acc.account_type}
                        </p>
                        <p className="break-all text-gray-500">
                          No. {acc.account_number}
                        </p>
                        {acc.account_holder && (
                          <p className="text-gray-500">
                            A nombre de {acc.account_holder}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <MedioCardAction>
                  <SecondaryButton
                    label="Ya deposité, notificar"
                    width="w-full"
                    onClick={onNotify}
                  />
                </MedioCardAction>
              </MedioCard>

              <MedioCard Icon={FaMoneyBillWave} title="Efectivo">
                <p className="text-sm text-gray-500">
                  Coordina con nosotros para entregar tu donativo en efectivo,
                  en el horario que te convenga.
                </p>
                <MedioCardAction>
                  <SecondaryButton
                    Icon={FaWhatsapp}
                    label="Escribir por WhatsApp"
                    width="w-full justify-center"
                    onClick={() =>
                      window.open(
                        buildDonationWhatsAppUrl("efectivo"),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  />
                </MedioCardAction>
              </MedioCard>

              <MedioCard Icon={FaBoxOpen} title="En especie">
                <p className="text-sm text-gray-500">
                  Alimento, medicinas o insumos. Coordinamos contigo la entrega
                  o el punto de recolección.
                </p>
                <MedioCardAction>
                  <SecondaryButton
                    Icon={FaWhatsapp}
                    label="Coordinar donación"
                    width="w-full justify-center"
                    onClick={() =>
                      window.open(
                        buildDonationWhatsAppUrl("especie"),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  />
                </MedioCardAction>
              </MedioCard>
            </div>
          </div>

          {/* ── Insumos necesitados ── */}
          {neededSupplies.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <SectionLabel>¿Qué necesitamos ahora mismo?</SectionLabel>
              <ul className="flex flex-wrap gap-2.5">
                {neededSupplies.map((supply) => (
                  <li
                    key={supply.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-600"
                  >
                    <FaBoxOpen className="h-3.5 w-3.5 shrink-0 text-medium-turquoise-meraki" />
                    <span className="min-w-0 break-words">
                      {supply.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Banner: notificar donación ── */}
          <div className="flex flex-col gap-4 rounded-2xl border border-medium-turquoise-meraki/30 bg-medium-turquoise-meraki/10 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-gray-800">
                ¿Ya hiciste tu depósito o transferencia?
              </h3>
              <p className="text-sm text-gray-600">
                Notifícanos el monto y, si quieres, adjunta tu comprobante — así
                confirmamos tu donación más rápido.
              </p>
            </div>
            <PrimaryButton
              Icon={FaHandHoldingHeart}
              label="Notificar donación"
              className="shrink-0 justify-center whitespace-nowrap"
              onClick={onNotify}
            />
          </div>
        </>
      )}
    </section>
  );
}

/*==============================| Sección: Nuestros donantes |==============================*/
function NuestrosDonantesSection({
  summary,
  latestDonations,
  isLoading,
  hasError,
  onRetry,
}: {
  summary: DonationTransparencySummary | null;
  latestDonations: PublicDonation[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  // Sección vacía: no hay ninguna donación confirmada todavía, así que ni el
  // resumen ni el listado tienen algo que mostrar.
  const isEmpty =
    !!summary &&
    summary.totalDonacionesConfirmadas === 0 &&
    latestDonations.length === 0;

  return (
    <section
      aria-labelledby="nuestros-donantes-title"
      className="flex flex-col gap-y-8"
      aria-busy={isLoading}
    >
      <h2 id="nuestros-donantes-title" className="sr-only">
        Nuestros donantes
      </h2>

      {isLoading ? (
        <SectionLoading label="Cargando el resumen de transparencia…" />
      ) : hasError ? (
        <SectionError
          message="No pudimos cargar el resumen de transparencia en este momento. Revisa tu conexión e inténtalo de nuevo."
          onRetry={onRetry}
        />
      ) : isEmpty ? (
        <SectionEmpty
          title="Todavía no hay donaciones registradas"
          message="Cuando confirmemos las primeras donaciones, aquí aparecerá el resumen de transparencia y las donaciones que los donantes autoricen mostrar."
        />
      ) : (
        <>
          {/* ── Resumen de transparencia ── */}
          <div className="flex flex-col gap-y-4">
            <SectionLabel>Resumen de transparencia</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                value={summary?.countMonetarioMes ?? 0}
                caption="Donaciones monetarias este mes"
              />
              <StatCard
                value={summary?.countMonetarioHistorico ?? 0}
                caption="Donaciones monetarias (histórico)"
              />
              <StatCard
                value={summary?.totalEspecieHistorico ?? 0}
                caption="Donaciones en especie"
              />
            </div>
            <p className="text-xs text-gray-400">
              Conteo de donaciones confirmadas. Por seguridad no publicamos
              montos ni el detalle de contacto de los donantes; los nombres solo
              aparecen cuando el donante autorizó su publicación.
            </p>
          </div>

          {/* ── Últimas donaciones ── */}
          <div className="flex flex-col gap-y-4">
            <SectionLabel>Últimas donaciones</SectionLabel>
            {latestDonations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
                Aún no hay donaciones públicas que mostrar. Aquí aparecen las
                donaciones cuyo donante autorizó su publicación. De las donaciones
                monetarias solo se indica que lo son; nunca se muestra el monto.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {latestDonations.map((donation) => {
                  const isMonetaria = donation.donation_type === "Monetaria";
                  return (
                    <li
                      key={donation.id}
                      className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {donation.is_anonymous
                            ? "Donante anónimo"
                            : donation.donor_name ?? "Donante"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDonationDate(donation.submitted_at)}
                        </p>
                      </div>
                      <div className="min-w-0 sm:shrink-0 sm:text-right">
                        <p className="text-sm text-gray-600 line-clamp-2 sm:max-w-[16rem]">
                          {isMonetaria
                            ? "Donación monetaria"
                            : donation.item_description}
                        </p>
                        <p className="text-xs text-gray-400">
                          {donation.origin === "patrocinador" &&
                          donation.project_name
                            ? `Patrocinador · ${donation.project_name}`
                            : isMonetaria
                            ? "Aporte económico"
                            : "En especie"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/*==============================| Sección: Patrocinadores y proyectos |==============================*/
function PatrocinadoresProyectosSection({
  sponsors,
  projects,
  isLoading,
  hasError,
  onRetry,
}: {
  sponsors: PublicSponsor[];
  projects: PublicProject[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="patrocinadores-proyectos-title"
      className="flex flex-col gap-y-8"
      aria-busy={isLoading}
    >
      <h2 id="patrocinadores-proyectos-title" className="sr-only">
        Patrocinadores y proyectos
      </h2>

      {isLoading ? (
        <SectionLoading label="Cargando patrocinadores y proyectos…" />
      ) : hasError ? (
        <SectionError
          message="No pudimos cargar los patrocinadores y proyectos en este momento. Revisa tu conexión e inténtalo de nuevo."
          onRetry={onRetry}
        />
      ) : (
        <>
          {/* ── Patrocinadores — vacío independiente del de proyectos ── */}
          <div className="flex flex-col gap-y-4">
            <SectionLabel>Patrocinadores</SectionLabel>
            {sponsors.length === 0 ? (
              <SectionEmpty
                title="Sin patrocinadores todavía"
                message="Cuando una empresa o negocio apoye a la asociación, aparecerá aquí."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sponsors.map((sponsor) => (
                  <SponsorCard key={sponsor.id} sponsor={sponsor} />
                ))}
              </ul>
            )}
          </div>

          {/* ── Proyectos — vacío independiente del de patrocinadores ── */}
          <div className="flex flex-col gap-y-4">
            <SectionLabel>Proyectos</SectionLabel>
            {projects.length === 0 ? (
              <SectionEmpty
                title="Sin proyectos todavía"
                message="Aquí verás los proyectos financiados con aportes de patrocinadores, con su galería de antes, durante y después."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/* Categorías de la galería, en el orden en que se muestran. */
const PHOTO_CATEGORIES: {
  key: keyof PublicProject["photos"];
  label: string;
}[] = [
  { key: "antes", label: "Antes" },
  { key: "durante", label: "Durante" },
  { key: "despues", label: "Después" },
];

function ProjectCard({ project }: { project: PublicProject }) {
  const gallery = PHOTO_CATEGORIES.flatMap(({ key, label }) =>
    project.photos[key].map((photo) => ({ ...photo, label })),
  );

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Galería antes / durante / después */}
      {gallery.length === 0 ? (
        <div className="flex items-center justify-center gap-2 bg-gray-50 py-8 text-gray-300">
          <FaRegImage className="h-6 w-6" />
          <span className="text-xs text-gray-400">Sin fotos por ahora</span>
        </div>
      ) : (
        <div
          className={`grid gap-px bg-gray-100 ${
            gallery.length >= 3
              ? "grid-cols-3"
              : gallery.length === 2
              ? "grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {gallery.map((photo) => (
            <ProjectPhoto
              key={photo.id}
              url={photo.url}
              label={photo.label}
              projectName={project.name}
            />
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words font-semibold text-gray-800">
            {project.name}
          </h3>
          <ProjectStatusBadge status={project.status} />
        </div>

        <p className="text-sm text-gray-500">{project.description}</p>

        {project.progress != null ? (
          <ProjectProgress progress={project.progress} goal={project.goal} />
        ) : (
          project.goal && (
            <p className="text-xs text-gray-400">Meta: {project.goal}</p>
          )
        )}

        {project.sponsors.length > 0 && (
          <p className="mt-auto flex items-center gap-2 pt-1 text-xs text-gray-500">
            <FaBuilding className="h-3 w-3 shrink-0 text-gray-400" />
            <span className="min-w-0 break-words">
              {project.sponsors.map((sponsor) => sponsor.name).join(" · ")}
            </span>
          </p>
        )}
      </div>
    </article>
  );
}

function ProjectProgress({
  progress,
  goal,
}: {
  progress: number;
  goal: string | null;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avance del proyecto: ${pct}%`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className="h-full rounded-full bg-medium-turquoise-meraki"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 text-xs text-gray-400">
        <span className="shrink-0">{pct}% avanzado</span>
        {goal && <span className="min-w-0 truncate">Meta: {goal}</span>}
      </div>
    </div>
  );
}

/* Una foto de la galería de un proyecto, con su categoría rotulada por texto
   (antes/durante/después), no solo por posición. */
function ProjectPhoto({
  url,
  label,
  projectName,
}: {
  url: string;
  label: string;
  projectName: string;
}) {
  return (
    <div className="relative aspect-[4/3] bg-gray-50">
      <span className="absolute left-2 top-2 z-10 rounded-md bg-gray-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {label}
      </span>
      <img
        src={url}
        alt={`${projectName} — ${label}`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function ProjectStatusBadge({ status }: { status: "Activo" | "Finalizado" }) {
  const isActive = status === "Activo";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? "bg-blue-meraki/10 text-blue-meraki"
          : "bg-medium-turquoise-meraki/10 text-medium-turquoise-meraki"
      }`}
    >
      {isActive ? "En curso" : "Finalizado"}
    </span>
  );
}

/* Ficha pública de un patrocinador: logo, nombre y, si lo tiene,
   un enlace a su sitio web que se abre en una pestaña nueva. El `contact` no se
   muestra: es un campo interno de texto libre. */
function SponsorCard({ sponsor }: { sponsor: PublicSponsor }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <SponsorLogo name={sponsor.name} logoUrl={sponsor.logo_url} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-700">
          {sponsor.name}
        </span>
      </div>

      {sponsor.website && (
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visitar el sitio web de ${sponsor.name} (se abre en una pestaña nueva)`}
          className="mt-auto flex max-w-full items-center gap-1.5 self-start rounded text-xs font-medium text-blue-meraki hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-meraki/40"
        >
          <FaGlobe className="h-3 w-3 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">
            {formatWebsite(sponsor.website)}
          </span>
          <FaExternalLinkAlt className="h-2.5 w-2.5 shrink-0" aria-hidden />
        </a>
      )}
    </li>
  );
}

/* Quita el esquema y la barra final para mostrar el dominio de forma legible;
   el enlace real sigue usando la URL completa (`https://…`). */
function formatWebsite(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/* Logo del patrocinador; si no hay logo cargado, muestra sus iniciales. */
function SponsorLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${name}`}
        loading="lazy"
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
    >
      {getInitials(name)}
    </span>
  );
}

/*==============================| Subcomponentes |==============================*/
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h2>
  );
}

/* Estado de carga de una sección, con el mismo spinner que usa el resto de la
   app. */
function SectionLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400"
    >
      <AiOutlineLoading3Quarters className="h-10 w-10 animate-spin text-blue-meraki" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* Estado vacío de una sección: la carga funcionó pero todavía no hay datos. */
function SectionEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      <p className="max-w-sm text-sm text-gray-400">{message}</p>
    </div>
  );
}

/* Estado de error de una sección, con mensaje claro y opción de reintentar
   (revalida el loader sin recargar la página). */
function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-pink-meraki/30 bg-pink-meraki/5 px-6 py-12 text-center"
    >
      <FaExclamationTriangle className="h-7 w-7 text-pink-meraki" />
      <p className="max-w-sm text-sm text-gray-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-pink-meraki px-4 py-2 text-sm font-semibold text-pink-meraki hover:bg-pink-meraki/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-meraki/40"
      >
        Reintentar
      </button>
    </div>
  );
}

function MedioCard({
  Icon,
  title,
  children,
}: {
  Icon: IconType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-meraki/10 text-blue-meraki">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </article>
  );
}

/* Ancla la acción al fondo de la tarjeta para que los tres botones queden
   alineados aunque las tarjetas tengan distinta cantidad de texto. */
function MedioCardAction({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto pt-1">{children}</div>;
}

/* Tarjeta del resumen de transparencia: solo un conteo, nunca un monto. */
function StatCard({ value, caption }: { value: number; caption: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5">
      <span className="text-2xl font-bold text-gray-800 md:text-3xl">
        {value}
      </span>
      <span className="text-sm text-gray-500">{caption}</span>
    </div>
  );
}

function formatDonationDate(date: string) {
  return new Date(date).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
