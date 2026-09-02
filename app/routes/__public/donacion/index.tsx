import { donation_type_donation, donationBankAccount } from "@prisma/client";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import {
  FaEnvelope,
  FaHandHoldingHeart,
  FaMoneyBillWave,
  FaPhone,
  FaBoxOpen,
} from "react-icons/fa";
import { DonationIntentionPanel } from "~/components/Panel/DonationIntentionPanel";
import {
  createDonationDb,
  DonationTransparencySummary,
  getDonationTransparencySummaryDb,
  listPublicDonationsDb,
  PublicDonation,
} from "~/services/db/donation.service";
import { listDonationBankAccountDb } from "~/services/db/donationBankAccount.service";
import {
  EssentialInfoUser,
  getEssentialUserDb,
} from "~/services/db/user.service";
import { getSession } from "~/services/sessions/sessions.service";
import { handleEmailValidation } from "~/utils/common";

export const meta = () => {
  return [{ title: "DONACIONES" }];
};

const ASSOCIATION_CONTACT = {
  phone: "+502 0000-0000",
  whatsapp: "50200000000",
  email: "contacto@meraki.org",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Monetaria: "Cuenta Monetaria",
  Ahorro: "Cuenta de Ahorro",
  Pr_stamo: "Préstamo",
  Tarjeta_de_cr_dito: "Tarjeta de crédito",
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  const [bankAccountsRes, recentDonationsRes, summaryRes] = await Promise.all([
    listDonationBankAccountDb({ active: true }),
    listPublicDonationsDb(8),
    getDonationTransparencySummaryDb(),
  ]);

  if (
    !bankAccountsRes.success ||
    !recentDonationsRes.success ||
    !summaryRes.success
  ) {
    return json({
      errorMsg: "Ocurrió un error al cargar la información de donaciones",
    });
  }

  let loggedUser: EssentialInfoUser | null = null;
  if (dbUserId) {
    const loggedUserRes = await getEssentialUserDb({ id: dbUserId });
    if (loggedUserRes.success) loggedUser = loggedUserRes.data;
  }

  return json({
    bankAccounts: bankAccountsRes.data,
    recentDonations: recentDonationsRes.data,
    summary: summaryRes.data,
    loggedUser,
  });
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();

  const donationType = formData
    .get("donation_type")
    ?.toString() as donation_type_donation;
  const amount = formData.get("amount")?.toString().trim();
  const itemDescription = formData.get("item_description")?.toString().trim();
  const comment = formData.get("comment")?.toString().trim();
  const bankAccountId = formData.get("bank_account_id")?.toString();
  const referenceNumber = formData.get("reference_number")?.toString().trim();
  const donorName = formData.get("donor_name")?.toString().trim();
  const donorEmail = formData.get("donor_email")?.toString().trim();
  const donorPhone = formData.get("donor_phone")?.toString().trim();
  const isPublic = formData.get("is_public") === "true";
  const isAnonymous = isPublic && formData.get("is_anonymous") === "true";

  if (donationType !== "Monetaria" && donationType !== "Especie") {
    return json({ errorMsg: "Selecciona un tipo de donación válido" });
  }

  if (donationType === "Monetaria" && (!amount || Number(amount) <= 0)) {
    return json({ errorMsg: "Indica un monto válido para la donación" });
  }

  if (donationType === "Especie" && !itemDescription) {
    return json({ errorMsg: "Describe los artículos que deseas donar" });
  }

  if (!dbUserId) {
    if (!donorName) {
      return json({ errorMsg: "Indica tu nombre para continuar" });
    }

    const emailError = handleEmailValidation(donorEmail || "");
    if (emailError) {
      return json({ errorMsg: emailError });
    }
  }

  const createDonationRes = await createDonationDb({
    user_id: dbUserId || undefined,
    donor_name: dbUserId ? undefined : donorName,
    donor_email: dbUserId ? undefined : donorEmail,
    donor_phone: dbUserId ? undefined : donorPhone || undefined,
    donation_type: donationType,
    amount: donationType === "Monetaria" ? Number(amount) : undefined,
    item_description: donationType === "Especie" ? itemDescription : undefined,
    bank_account_id: bankAccountId ? Number(bankAccountId) : undefined,
    reference_number: bankAccountId ? referenceNumber || undefined : undefined,
    comment: comment || undefined,
    is_public: isPublic,
    is_anonymous: isAnonymous,
    status: "pendiente",
    submitted_at: new Date(),
    updated_at: new Date(),
  });

  if (!createDonationRes.success) {
    return json({
      errorMsg:
        "Ocurrió un error al registrar tu intención de donación, por favor intenta nuevamente",
    });
  }

  return json({ success: true });
};

/*==============================| Component |==============================*/
export default function () {
  const { bankAccounts, recentDonations, summary, loggedUser } = useLoaderData<{
    bankAccounts: donationBankAccount[];
    recentDonations: PublicDonation[];
    summary: DonationTransparencySummary;
    loggedUser: EssentialInfoUser | null;
  }>();
  // Modal de intención de donación
  const [donationModalOpen, setDonationModalOpen] = useState(false);

  function whatsappUrl() {
    const message = encodeURIComponent(
      "Hola, quisiera coordinar una donación para la asociación.",
    );
    return `https://wa.me/${ASSOCIATION_CONTACT.whatsapp}?text=${message}`;
  }

  function formatCurrency(value: number) {
    return `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("es-GT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      {/* ── Botón flotante para donar ── */}
      <button
        type="button"
        onClick={() => setDonationModalOpen(true)}
        className="fixed top-24 right-5 md:right-8 z-30 flex items-center gap-2 rounded-full bg-blue-meraki px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-meraki/30 transition-all hover:opacity-90 hover:scale-105 active:scale-95"
      >
        <FaHandHoldingHeart className="w-4 h-4" />
        Donar
      </button>

      <div>
        <h1 className="text-xl md:text-3xl font-bold text-blue-meraki pt-10 md:pt-0">
          Dona y ayuda a nuestros peludos
        </h1>
        <p className="text-gray-400">
          Cada aporte, en efectivo, transferencia o especie, ayuda a cubrir
          alimentación, medicinas y cuidados de los animales que esperan un
          hogar.
        </p>
      </div>

      <div className="w-full md:w-[85%] mx-auto flex flex-col gap-y-6">
        {/* ── Resumen de transparencia ── */}
        <section className="bg-white rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Resumen de transparencia
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="Donaciones monetarias este mes"
              value={summary.countMonetarioMes}
            />
            <KpiCard
              label="Donaciones monetarias (histórico)"
              value={summary.countMonetarioHistorico}
            />
            <KpiCard
              label="Donaciones en especie"
              value={summary.totalEspecieHistorico}
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Conteo de donaciones confirmadas. Por seguridad no publicamos montos
            ni el detalle de donantes individuales salvo autorización expresa.
          </p>
        </section>

        {/* ── Medios de donación ── */}
        <section className="bg-white rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Medios de donación
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-meraki font-semibold">
                <FaMoneyBillWave className="w-4 h-4" />
                Transferencia o depósito
              </div>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Por el momento no hay cuentas configuradas.
                </p>
              ) : (
                bankAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="text-sm text-gray-600 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0"
                  >
                    <p className="font-semibold text-gray-700">
                      {acc.bank_name}
                    </p>
                    <p>
                      {ACCOUNT_TYPE_LABELS[acc.account_type] ??
                        acc.account_type}
                    </p>
                    <p>No. {acc.account_number}</p>
                    {acc.account_holder && (
                      <p>A nombre de {acc.account_holder}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-meraki font-semibold">
                <FaHandHoldingHeart className="w-4 h-4" />
                Efectivo
              </div>
              <p className="text-sm text-gray-600">
                Coordina con nosotros para entregar tu donativo en efectivo.
              </p>
              <a
                href={`tel:${ASSOCIATION_CONTACT.phone}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-meraki"
              >
                <FaPhone className="w-3.5 h-3.5" />
                {ASSOCIATION_CONTACT.phone}
              </a>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-[#25D366]"
              >
                Escribir por WhatsApp
              </a>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-meraki font-semibold">
                <FaBoxOpen className="w-4 h-4" />
                Especie
              </div>
              <p className="text-sm text-gray-600">
                Alimento, medicinas o insumos. Coordinamos la entrega o el punto
                de recolección contigo.
              </p>
              <a
                href={`mailto:${ASSOCIATION_CONTACT.email}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-meraki"
              >
                <FaEnvelope className="w-3.5 h-3.5" />
                {ASSOCIATION_CONTACT.email}
              </a>
            </div>
          </div>
        </section>

        {/* ── Últimas donaciones ── */}
        <section className="py-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Últimas donaciones
          </h2>
          {recentDonations.length === 0 ? (
            <p className="text-sm text-gray-400">
              Todavía no hay donaciones públicas registradas. ¡Sé el primero!
            </p>
          ) : (
            <div className="w-full flex flex-col gap-3 rounded-2xl border border-gray-100 shadow-sm p-6">
              {recentDonations.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-b-0"
                >
                  <div>
                    <p className="font-semibold text-gray-700">
                      {d.is_anonymous
                        ? "Donante anónimo"
                        : d.donor_name || "Donante"}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {formatDate(d.submitted_at)}
                    </p>
                  </div>
                  <p className="text-gray-600">
                    {d.donation_type === "Monetaria"
                      ? formatCurrency(Number(d.amount ?? 0))
                      : d.item_description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DonationIntentionPanel
        open={donationModalOpen}
        onClose={() => setDonationModalOpen(false)}
        bankAccounts={bankAccounts}
        loggedUser={loggedUser}
      />
    </div>
  );
}

/*==============================| Subcomponentes ==============================*/
function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 flex flex-col gap-1">
      <p className="text-xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
