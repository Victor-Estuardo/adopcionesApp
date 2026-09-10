import { useFetcher } from "@remix-run/react";
import { useId, useRef, useState } from "react";
import { FaCheckCircle, FaCloudUploadAlt, FaTimes } from "react-icons/fa";
import { Field } from "~/components/Form/Field";
import Input from "~/components/Input";
import { Select } from "~/components/Input/Select";
import { Textarea } from "~/components/Input/Textarea";
import { Modal } from "~/components/Modal/Modal";
import {
  DONATION_RECEIPT_MAX_MB,
  DONATION_RECEIPT_MIME_TYPES,
} from "~/services/cloudinary/fileConstraints";
import type { DonationMethod } from "~/services/db/donationBankAccount.service";

/* Etiqueta legible del tipo de cuenta (el enum de Prisma llega como su
   identificador). */
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  Monetaria: "Cuenta Monetaria",
  Ahorro: "Cuenta de Ahorro",
  Pr_stamo: "Préstamo",
  Tarjeta_de_cr_dito: "Tarjeta de crédito",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Errors = {
  declaredAmount?: string;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  contact?: string;
  receipt?: string;
};

interface NotifyDonationModalProps {
  onClose: () => void;
  donationMethods: DonationMethod[];
  /** Si el donante tiene sesión, no se le piden datos de contacto (RF-03). */
  isAuthenticated: boolean;
}

/**
 * Modal "Notificar mi donación". Envía el intent `"notify"` de
 * la acción de la ruta vía `useFetcher` (mismo patrón que `PetFormPanel`), sin
 * navegar. La validación de cliente refleja las reglas del backend solo para
 * dar feedback inmediato; el servidor vuelve a validar y sanitizar todo.
 */
export function NotifyDonationModal({
  onClose,
  donationMethods,
  isAuthenticated,
}: NotifyDonationModalProps) {
  const fetcher = useFetcher<{ notifySuccess?: boolean; errorMsg?: string }>();
  const formId = useId();
  const isSubmitting = fetcher.state !== "idle";
  const succeeded = fetcher.data?.notifySuccess === true;
  const serverError = fetcher.data?.errorMsg;

  const [errors, setErrors] = useState<Errors>({});
  const [isPublic, setIsPublic] = useState(true);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const clearError = (key: keyof Errors) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next: Errors = {};

    const amount = Number(formData.get("declaredAmount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      next.declaredAmount = "Indica el monto que donaste (mayor a cero).";
    } else if (amount > 9_999_999.99) {
      next.declaredAmount = "El monto es demasiado alto; verifícalo.";
    }

    if (!isAuthenticated) {
      const name = String(formData.get("donorName") ?? "").trim();
      const email = String(formData.get("donorEmail") ?? "").trim();
      const phone = String(formData.get("donorPhone") ?? "").trim();

      if (!name) next.donorName = "Indica tu nombre.";
      if (!email && !phone) {
        next.contact =
          "Déjanos un correo o un teléfono para poder confirmarte la donación.";
      }
      if (email && !EMAIL_RE.test(email)) {
        next.donorEmail = "El correo no tiene un formato válido.";
      }
      if (phone && (phone.match(/\d/g) ?? []).length < 6) {
        next.donorPhone = "El teléfono no parece válido.";
      }
    }

    if (receiptFile) {
      if (!DONATION_RECEIPT_MIME_TYPES.includes(receiptFile.type)) {
        next.receipt =
          "El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF.";
      } else if (receiptFile.size > DONATION_RECEIPT_MAX_MB * 1024 * 1024) {
        next.receipt = `El comprobante no debe superar los ${DONATION_RECEIPT_MAX_MB}MB.`;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  /* ── Confirmación de éxito ── */
  if (succeeded) {
    return (
      <Modal open onClose={onClose} title="Donación notificada">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <FaCheckCircle className="h-12 w-12 text-medium-turquoise-meraki" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-gray-800">
              ¡Gracias por avisarnos!
            </p>
            <p className="max-w-sm text-sm text-gray-500">
              Registramos tu notificación como <strong>pendiente</strong>. Un
              voluntario la revisará y confirmará tu donación. Si dejaste un
              medio de contacto, te avisaremos cuando quede confirmada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-medium-turquoise-meraki px-5 py-2 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Notificar mi donación"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-medium-turquoise-meraki py-2 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enviando…" : "Notificar donación"}
          </button>
        </>
      }
    >
      <fetcher.Form
        id={formId}
        method="post"
        encType="multipart/form-data"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <input type="hidden" name="intent" value="notify" />

        {serverError && (
          <p
            role="alert"
            className="rounded-lg border border-pink-meraki/30 bg-pink-meraki/5 px-3 py-2 text-sm text-pink-meraki"
          >
            {serverError}
          </p>
        )}

        <Field
          id="notify-amount"
          label="Monto donado (Q)"
          error={errors.declaredAmount}
        >
          <Input
            id="notify-amount"
            name="declaredAmount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Ej. 250"
            aria-invalid={Boolean(errors.declaredAmount)}
            aria-describedby={
              errors.declaredAmount ? "notify-amount-error" : undefined
            }
            onChange={() => clearError("declaredAmount")}
          />
        </Field>

        {donationMethods.length > 0 && (
          <Field id="notify-bank" label="Cuenta a la que depositaste" optional>
            <Select
              id="notify-bank"
              name="bankAccountId"
              defaultValue=""
              className="w-full"
            >
              <option value="">No lo recuerdo / otra</option>
              {donationMethods.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} ·{" "}
                  {ACCOUNT_TYPE_LABEL[account.account_type] ??
                    account.account_type}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {isAuthenticated ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Usaremos el nombre y los datos de contacto de tu cuenta.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3">
            <legend className="px-1 text-xs font-semibold text-gray-500">
              Tus datos
            </legend>

            <Field id="notify-name" label="Nombre" error={errors.donorName}>
              <Input
                id="notify-name"
                name="donorName"
                maxLength={100}
                autoComplete="name"
                aria-invalid={Boolean(errors.donorName)}
                aria-describedby={
                  errors.donorName ? "notify-name-error" : undefined
                }
                onChange={() => clearError("donorName")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="notify-email"
                label="Correo"
                optional
                error={errors.donorEmail}
              >
                <Input
                  id="notify-email"
                  name="donorEmail"
                  type="email"
                  maxLength={100}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.donorEmail)}
                  aria-describedby={
                    errors.donorEmail ? "notify-email-error" : undefined
                  }
                  onChange={() => {
                    clearError("donorEmail");
                    clearError("contact");
                  }}
                />
              </Field>
              <Field
                id="notify-phone"
                label="Teléfono"
                optional
                error={errors.donorPhone}
              >
                <Input
                  id="notify-phone"
                  name="donorPhone"
                  type="tel"
                  maxLength={25}
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.donorPhone)}
                  aria-describedby={
                    errors.donorPhone ? "notify-phone-error" : undefined
                  }
                  onChange={() => {
                    clearError("donorPhone");
                    clearError("contact");
                  }}
                />
              </Field>
            </div>
            {errors.contact && (
              <p className="text-xs font-medium text-pink-meraki">
                {errors.contact}
              </p>
            )}
          </fieldset>
        )}

        <Field id="notify-comment" label="Mensaje" optional>
          <Textarea
            id="notify-comment"
            name="comment"
            rows={2}
            maxLength={1000}
            placeholder="Ej. Para que los animalitos sean felices"
          />
        </Field>

        {/* Comprobante (opcional) */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">
            Comprobante{" "}
            <span className="font-normal text-gray-400">(opcional)</span>
          </span>
          <label
            htmlFor="notify-receipt"
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-5 text-center text-xs text-gray-400 transition-colors hover:border-medium-turquoise-meraki/60 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-medium-turquoise-meraki/40"
          >
            <FaCloudUploadAlt className="h-6 w-6 text-gray-300" aria-hidden />
            <span>
              {receiptFile
                ? receiptFile.name
                : "Sube una foto o PDF de tu depósito/transferencia"}
            </span>
            <input
              id="notify-receipt"
              ref={receiptInputRef}
              type="file"
              name="receipt"
              accept={DONATION_RECEIPT_MIME_TYPES.join(",")}
              className="sr-only"
              aria-invalid={Boolean(errors.receipt)}
              aria-describedby={
                errors.receipt ? "notify-receipt-error" : undefined
              }
              onChange={(event) => {
                setReceiptFile(event.currentTarget.files?.[0] ?? null);
                clearError("receipt");
              }}
            />
          </label>
          {receiptFile && (
            <button
              type="button"
              onClick={() => {
                setReceiptFile(null);
                clearError("receipt");
                if (receiptInputRef.current) receiptInputRef.current.value = "";
              }}
              className="self-start text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="mr-1 inline h-3 w-3" />
              Quitar comprobante
            </button>
          )}
          {errors.receipt && (
            <p
              id="notify-receipt-error"
              className="text-xs font-medium text-pink-meraki"
            >
              {errors.receipt}
            </p>
          )}
        </div>

        {/* Publicación */}
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isPublic"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.currentTarget.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-medium-turquoise-meraki"
            />
            Mostrar esta donación en el listado público de transparencia
          </label>
          {isPublic && (
            <fieldset className="ml-6 flex flex-col gap-1.5">
              <legend className="text-xs text-gray-500">
                ¿Cómo quieres aparecer?
              </legend>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="visibility"
                  value="con-nombre"
                  defaultChecked
                  className="h-4 w-4 accent-medium-turquoise-meraki"
                />
                Con mi nombre
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="visibility"
                  value="anonimo"
                  className="h-4 w-4 accent-medium-turquoise-meraki"
                />
                De forma anónima
              </label>
            </fieldset>
          )}
        </div>
      </fetcher.Form>
    </Modal>
  );
}
