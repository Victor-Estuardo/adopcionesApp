import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import {
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import { toast } from "sonner";
import {
  DonationRowData,
  DonationStatusBadge,
} from "~/components/Card/DonationRow";
import { useFocusTrap } from "~/hooks/useFocusTrap";
import { buildDonorWhatsAppUrl } from "~/utils/whatsapp";

interface DonationDetailDrawerProps {
  donation: DonationRowData | null;
  allowedToUpdate?: boolean;
  onClose: () => void;
}

type ReviewResponse = {
  ok?: boolean;
  intent?: "confirm" | "reject";
  errorMsg?: string;
};

/* Estados en los que administración todavía puede actuar sobre la donación. */
const ACTIONABLE_STATES = ["pendiente", "coordinacion"];

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

export function DonationDetailDrawer({
  donation,
  allowedToUpdate,
  onClose,
}: DonationDetailDrawerProps) {
  const open = donation != null;
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const fetcher = useFetcher<ReviewResponse>();
  const isSubmitting = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  const [mode, setMode] = useState<"view" | "reject">("view");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Reinicia el formulario cada vez que se abre con otra donación.
  useEffect(() => {
    if (!donation) return;
    setMode("view");
    setConfirmedAmount(
      donation.declared_amount != null ? String(donation.declared_amount) : "",
    );
    setRejectionReason("");
  }, [donation]);

  // Al terminar una acción: éxito → aviso + cerrar (el listado se revalida
  // solo); error → aviso y se deja el drawer abierto para reintentar.
  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (fetcher.data?.ok) {
        toast.success(
          fetcher.data.intent === "confirm"
            ? "Donación confirmada."
            : "Donación rechazada.",
        );
        onClose();
      } else if (fetcher.data?.errorMsg) {
        toast.error(fetcher.data.errorMsg);
      }
    }
  }, [fetcher.state]);

  if (!donation) return null;

  const isMoney = donation.donation_type === "Monetaria";
  const isSponsor = donation.origin === "patrocinador";
  const canAct = ACTIONABLE_STATES.includes(donation.status);
  const donorName = isSponsor
    ? donation.patrocinador_name ?? "Patrocinador"
    : donation.donor_name ?? "Donante";

  const submitReview = (intent: "confirm" | "reject") => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("donationId", donation.id);
    if (intent === "confirm" && isMoney) {
      formData.set("confirmedAmount", confirmedAmount);
    }
    if (intent === "reject") {
      formData.set("rejectionReason", rejectionReason);
    }
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-[#1F1D1A]/40"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-detail-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl animate-slide-in-right focus:outline-none"
      >
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2
            id="donation-detail-title"
            className="text-base font-bold text-gray-800"
          >
            Detalle de donación
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        {/* ── Cuerpo ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5">
            <DonationStatusBadge status={donation.status} />
          </div>

          <dl className="flex flex-col gap-4">
            <DetailBlock label="Donante">
              {donorName}
              {donation.donor_email && (
                <span className="mt-0.5 block text-xs text-gray-400">
                  {donation.donor_email}
                </span>
              )}
              {donation.donor_phone && (
                <a
                  href={buildDonorWhatsAppUrl(donation.donor_phone, donorName)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-medium-turquoise-meraki hover:underline"
                >
                  <FaWhatsapp className="h-3.5 w-3.5" aria-hidden />
                  {donation.donor_phone}
                </a>
              )}
            </DetailBlock>

            <DetailBlock label="Origen">
              {isSponsor
                ? `Patrocinador${
                    donation.project_name ? ` — ${donation.project_name}` : ""
                  }`
                : "Donante individual"}
            </DetailBlock>

            <DetailBlock label="Tipo">
              {isMoney ? "Monetaria" : "En especie"}
            </DetailBlock>

            {isMoney ? (
              <DetailBlock label="Monto declarado">
                {formatCurrency(Number(donation.declared_amount ?? 0))}
                {donation.bank_name && (
                  <span className="mt-0.5 block text-xs text-gray-400">
                    → {donation.bank_name}
                    {donation.reference_number
                      ? ` · Ref. ${donation.reference_number}`
                      : ""}
                  </span>
                )}
                {donation.confirmed_amount != null && (
                  <span className="mt-0.5 block text-xs text-gray-400">
                    Confirmado:{" "}
                    {formatCurrency(Number(donation.confirmed_amount))}
                  </span>
                )}
              </DetailBlock>
            ) : (
              <DetailBlock label="Detalle del aporte">
                {donation.item_description}
              </DetailBlock>
            )}

            {donation.receipt_url && (
              <DetailBlock label="Comprobante">
                <a
                  href={donation.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-medium-turquoise-meraki hover:underline"
                >
                  Ver comprobante
                  <FaExternalLinkAlt className="h-3 w-3" aria-hidden />
                </a>
              </DetailBlock>
            )}

            {donation.comment && (
              <DetailBlock label="Mensaje del donante">
                {`“${donation.comment}”`}
              </DetailBlock>
            )}

            {donation.status === "rechazada" && donation.rejection_reason && (
              <DetailBlock label="Motivo de rechazo">
                {donation.rejection_reason}
              </DetailBlock>
            )}

            {donation.reviewed_by_name && (
              <DetailBlock label="Revisado por">
                {donation.reviewed_by_name}
              </DetailBlock>
            )}

            <DetailBlock label="Visibilidad">
              {donation.is_public
                ? donation.is_anonymous
                  ? "Pública, mostrada como anónima"
                  : "Pública, con nombre"
                : "No autorizada para mostrarse"}
            </DetailBlock>

            <DetailBlock label="Fecha de registro">
              {formatDate(donation.submitted_at)}
            </DetailBlock>
          </dl>
        </div>

        {/* ── Acciones ── */}
        {canAct && !allowedToUpdate ? (
          <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-400">
            No tienes permiso para confirmar o rechazar donaciones.
          </div>
        ) : canAct ? (
          <div className="border-t border-gray-100 px-5 py-4">
            {mode === "view" ? (
              <div className="flex flex-col gap-3">
                {isMoney && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">
                      Monto confirmado (Q)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={confirmedAmount}
                      onChange={(e) => setConfirmedAmount(e.target.value)}
                      disabled={isSubmitting}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-medium-turquoise-meraki focus:outline-none focus:ring-2 focus:ring-medium-turquoise-meraki/30 disabled:opacity-60"
                    />
                    <span className="text-xs text-gray-400">
                      Ajústalo al valor real verificado si difiere de lo
                      declarado.
                    </span>
                  </label>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("reject")}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border border-pink-meraki py-2 text-sm font-semibold text-pink-meraki hover:bg-pink-meraki/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-meraki/40 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => submitReview("confirm")}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-medium-turquoise-meraki py-2 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Confirmando…" : "Confirmar donación"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="flex items-start gap-2 rounded-lg border border-pink-meraki/30 bg-pink-meraki/5 px-3 py-2 text-xs text-pink-meraki">
                  <FaExclamationTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Vas a rechazar esta donación. La acción no se puede deshacer.
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">
                    Motivo del rechazo
                  </span>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Ej. No se pudo verificar el depósito en el estado de cuenta."
                    className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pink-meraki focus:outline-none focus:ring-2 focus:ring-pink-meraki/30 disabled:opacity-60"
                  />
                  <span className="text-xs text-gray-400">
                    Este texto es de uso interno.
                  </span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => submitReview("reject")}
                    disabled={isSubmitting || !rejectionReason.trim()}
                    className="flex-1 rounded-lg bg-pink-meraki py-2 text-sm font-semibold text-white hover:bg-pink-meraki/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-meraki/40"
                  >
                    {isSubmitting ? "Rechazando…" : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-400">
            Esta donación ya fue{" "}
            {donation.status === "confirmada" ? "confirmada" : "rechazada"}; no
            hay acciones disponibles.
          </div>
        )}
      </div>
    </div>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="text-sm text-gray-700">{children}</dd>
    </div>
  );
}
