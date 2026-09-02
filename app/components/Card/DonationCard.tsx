import { FaEye, FaEyeSlash, FaUniversity } from "react-icons/fa";
import { DonationWithRelations } from "~/services/db/donation.service";

interface DonationCardProps {
  donation: DonationWithRelations;
  allowedToUpdate: boolean;
  isProcessing: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pendiente: {
    label: "Pendiente",
    dot: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  confirmada: {
    label: "Confirmada",
    dot: "bg-teal-400",
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
  },
  rechazada: {
    label: "Rechazada",
    dot: "bg-red-400",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
} as const;

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

export function DonationCard({
  donation,
  allowedToUpdate,
  isProcessing,
  onConfirm,
  onReject,
}: DonationCardProps) {
  const status = (donation.status as keyof typeof STATUS_CONFIG) ?? "pendiente";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente;

  const donorName = donation.user_donation_user_idTouser
    ? `${donation.user_donation_user_idTouser.first_name} ${donation.user_donation_user_idTouser.last_name}`
    : donation.donor_name || "Visitante";

  const donorEmail =
    donation.user_donation_user_idTouser?.email || donation.donor_email;

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">{donorName}</p>
          {donorEmail && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{donorEmail}</p>
          )}
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold flex-shrink-0 ${cfg.bg} ${cfg.border} ${cfg.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-600">
        <span className="font-semibold text-gray-700">
          {donation.donation_type === "Monetaria"
            ? formatCurrency(Number(donation.amount ?? 0))
            : donation.item_description}
        </span>
        <span className="text-xs text-gray-400">
          {donation.donation_type === "Monetaria" ? "Monetaria" : "En especie"}
        </span>
        {donation.donationBankAccount && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <FaUniversity className="w-3 h-3" />
            {donation.donationBankAccount.bank_name} ·{" "}
            {donation.donationBankAccount.account_number}
            {donation.reference_number && (
              <> · Ref. {donation.reference_number}</>
            )}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          {donation.is_public ? (
            <>
              <FaEye className="w-3 h-3" />
              Pública{donation.is_anonymous ? " (anónima)" : ""}
            </>
          ) : (
            <>
              <FaEyeSlash className="w-3 h-3" />
              Privada
            </>
          )}
        </span>
      </div>

      {donation.comment && (
        <p className="text-sm text-gray-500 mt-2 italic">
          "{donation.comment}"
        </p>
      )}

      {status === "rechazada" && donation.rejection_reason && (
        <div className="mt-3 text-sm rounded-xl px-4 py-2.5 border border-gray-200 bg-gray-50 text-gray-600">
          <span className="font-semibold text-gray-700">Motivo: </span>
          {donation.rejection_reason}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">
          Registrada el {formatDate(donation.submitted_at)}
        </span>

        {status === "pendiente" && allowedToUpdate && (
          <div className="flex gap-2">
            <button
              disabled={isProcessing}
              onClick={() => onReject(donation.id)}
              className="px-3 py-1.5 rounded-lg border border-[#F2768C] text-xs font-semibold text-[#F2768C] hover:bg-[#F2768C]/5 disabled:opacity-40 transition-all"
            >
              Rechazar
            </button>
            <button
              disabled={isProcessing}
              onClick={() => onConfirm(donation.id)}
              className="px-3 py-1.5 rounded-lg bg-[#52C9BB] hover:bg-[#52C9BB]/90 text-xs font-semibold text-white disabled:opacity-40 transition-all"
            >
              Confirmar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
