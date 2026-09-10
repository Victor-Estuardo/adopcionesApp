import { IconType } from "react-icons";
import {
  FaBoxOpen,
  FaBuilding,
  FaEye,
  FaEyeSlash,
  FaRegCommentDots,
  FaUniversity,
  FaUser,
} from "react-icons/fa";
import type { AdminDonation } from "~/services/db/donation.service";
import { getInitials } from "~/utils/common";

/** La forma que consumen la fila y el drawer es la misma que devuelve el
 *  loader (`AdminDonation`). */
export type DonationRowData = AdminDonation;

/* Cada estado se distingue por color (fondo/borde/punto) Y por su etiqueta de
   texto — nunca solo por color. */
const STATUS_CONFIG = {
  pendiente: {
    label: "Pendiente",
    dot: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  coordinacion: {
    label: "En coordinación",
    dot: "bg-blue-400",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
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

type StatusKey = keyof typeof STATUS_CONFIG;

export const DONATION_STATUSES: { value: StatusKey; label: string }[] = (
  Object.keys(STATUS_CONFIG) as StatusKey[]
).map((value) => ({ value, label: STATUS_CONFIG[value].label }));

function resolveStatus(status: string): StatusKey {
  return (status in STATUS_CONFIG ? status : "pendiente") as StatusKey;
}

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

export function DonationStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[resolveStatus(status)];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function DonationRow({
  donation,
  onSelect,
}: {
  donation: DonationRowData;
  /** Si se pasa, la fila es un botón que abre el detalle. */
  onSelect?: (donation: DonationRowData) => void;
}) {
  const isMoney = donation.donation_type === "Monetaria";
  const isSponsor = donation.origin === "patrocinador";

  const displayName = isSponsor
    ? donation.patrocinador_name ?? "Patrocinador"
    : donation.donor_name ?? "Donante";

  const declared = Number(donation.declared_amount ?? 0);
  const confirmed =
    donation.confirmed_amount != null
      ? Number(donation.confirmed_amount)
      : null;
  const amountAdjusted = confirmed != null && confirmed !== declared;

  const inner = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
        aria-hidden
      >
        {getInitials(displayName)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800">
              {displayName}
            </p>
            {donation.donor_email && (
              <p className="truncate text-xs text-gray-400">
                {donation.donor_email}
              </p>
            )}
          </div>
          <DonationStatusBadge status={donation.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {isMoney ? (
            <span className="font-semibold text-gray-700">
              {formatCurrency(declared)}
              {amountAdjusted && (
                <span className="ml-1 font-normal text-gray-400">
                  (confirmado {formatCurrency(confirmed as number)})
                </span>
              )}
            </span>
          ) : (
            <span className="font-semibold text-gray-700">
              {donation.item_description}
            </span>
          )}

          <Tag Icon={isMoney ? FaUniversity : FaBoxOpen}>
            {isMoney ? "Monetaria" : "En especie"}
          </Tag>

          <Tag Icon={isSponsor ? FaBuilding : FaUser}>
            {isSponsor
              ? `Patrocinador${
                  donation.project_name ? ` · ${donation.project_name}` : ""
                }`
              : "Individual"}
          </Tag>

          <Tag Icon={donation.is_public ? FaEye : FaEyeSlash}>
            {donation.is_public
              ? donation.is_anonymous
                ? "Pública (anónima)"
                : "Pública"
              : "Privada"}
          </Tag>

          {isMoney && donation.bank_name && (
            <Tag Icon={FaUniversity}>
              {donation.bank_name}
              {donation.reference_number
                ? ` · Ref. ${donation.reference_number}`
                : ""}
            </Tag>
          )}
        </div>

        {donation.comment && (
          <p className="flex items-start gap-1.5 text-sm italic text-gray-500">
            <FaRegCommentDots className="mt-0.5 h-3 w-3 shrink-0 text-gray-300" />
            {`“${donation.comment}”`}
          </p>
        )}

        {resolveStatus(donation.status) === "rechazada" &&
          donation.rejection_reason && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <span className="font-semibold text-gray-700">Motivo: </span>
              {donation.rejection_reason}
            </p>
          )}

        <p className="text-xs text-gray-400">
          Registrada el {formatDate(donation.submitted_at)}
        </p>
      </div>
    </>
  );

  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(donation)}
          className="flex w-full gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
        >
          {inner}
        </button>
      ) : (
        <div className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {inner}
        </div>
      )}
    </li>
  );
}

function Tag({
  Icon,
  children,
}: {
  Icon: IconType;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}
