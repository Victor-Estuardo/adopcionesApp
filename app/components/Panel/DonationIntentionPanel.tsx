import { donation_type_donation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaTimes, FaUserSecret } from "react-icons/fa";
import { toast } from "sonner";
import Input from "~/components/Input";
import { EssentialInfoUser } from "~/services/db/user.service";
import { handleEmailValidation } from "~/utils/common";

interface DonationIntentionPanelProps {
  open: boolean;
  onClose: () => void;
  bankAccounts: { id: number; bank_name: string; account_number: string }[];
  loggedUser: EssentialInfoUser | null;
}

/**
 * Modal (centrado en escritorio, panel lateral en móvil) para registrar una
 * intención de donación desde la vista pública. Usa un fetcher en vez de
 * navegar para poder mostrar el toast de éxito/error sin perder el resto de
 * la página de donaciones detrás.
 */
export function DonationIntentionPanel({
  open,
  onClose,
  bankAccounts,
  loggedUser,
}: DonationIntentionPanelProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  // Datos del formulario
  const [donationType, setDonationType] =
    useState<donation_type_donation>("Monetaria");
  const [amount, setAmount] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [comment, setComment] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  /*------------------------------RESETEO AL ABRIR------------------------------*/
  useEffect(() => {
    if (open) {
      setDonationType("Monetaria");
      setAmount("");
      setItemDescription("");
      setBankAccountId("");
      setReferenceNumber("");
      setComment("");
      setIsPublic(false);
      setIsAnonymous(false);
      if (!loggedUser) {
        setDonorName("");
        setDonorEmail("");
        setDonorPhone("");
      }
    }
  }, [open]);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
    }

    if (fetcher.data?.success) {
      toast.success(
        "¡Gracias! Tu donación quedó registrada como pendiente de confirmación.",
      );
      onClose();
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  function handleSubmit() {
    if (donationType === "Monetaria" && (!amount || Number(amount) <= 0)) {
      toast.error("Indica un monto válido para la donación");
      return;
    }

    if (donationType === "Especie" && !itemDescription) {
      toast.error("Describe los artículos que deseas donar");
      return;
    }

    if (!loggedUser) {
      if (!donorName) {
        toast.error("Indica tu nombre para continuar");
        return;
      }

      const emailError = handleEmailValidation(donorEmail || "");
      if (emailError) {
        toast.error(emailError);
        return;
      }
    }

    fetcher.submit(
      {
        donation_type: donationType,
        amount,
        item_description: itemDescription,
        bank_account_id: bankAccountId,
        reference_number: referenceNumber,
        comment,
        donor_name: loggedUser
          ? `${loggedUser.first_name} ${loggedUser.last_name}`
          : donorName,
        donor_email: loggedUser ? loggedUser.email : donorEmail,
        donor_phone: loggedUser ? loggedUser.phone || "" : donorPhone,
        is_public: String(isPublic),
        is_anonymous: String(isAnonymous),
      },
      { method: "post" },
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end md:items-center md:justify-center transition-opacity duration-300 ${
        open
          ? "opacity-100 bg-[#1F1D1A]/40"
          : "opacity-0 bg-[#1F1D1A]/40 pointer-events-none"
      }`}
      onClick={onClose}
      aria-hidden={!open}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar intención de donación"
        onClick={(e) => e.stopPropagation()}
        className={`h-full w-full max-w-md bg-white shadow-xl overflow-y-auto transition-all duration-300 ease-out md:h-auto md:max-h-[88vh] md:w-full md:max-w-2xl md:rounded-2xl md:translate-x-0 ${
          open
            ? "translate-x-0 opacity-100 md:scale-100"
            : "translate-x-full opacity-0 md:scale-95"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Registrar intención de donación
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Tipo de donación
            </label>
            <div className="flex gap-2">
              {(["Monetaria", "Especie"] as donation_type_donation[]).map(
                (opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 cursor-pointer transition-all text-sm ${
                      donationType === opt
                        ? "border-blue-meraki bg-blue-meraki/5 text-blue-meraki font-medium"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt}
                      checked={donationType === opt}
                      onChange={() => setDonationType(opt)}
                      className="accent-blue-meraki"
                    />
                    {opt === "Monetaria" ? "Monetaria" : "En especie"}
                  </label>
                ),
              )}
            </div>
          </div>

          {donationType === "Monetaria" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Monto (Q)<span className="text-teal-500 ml-1">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej. 100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Cuenta a la que transferirás (opcional)
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full py-2 px-3 border border-gray-400 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar cuenta</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number}
                    </option>
                  ))}
                </select>
              </div>
              {bankAccountId && (
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    Número de referencia del depósito/transferencia (opcional)
                  </label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Ej. 0123456789"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Descripción de los artículos
                <span className="text-teal-500 ml-1">*</span>
              </label>
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={3}
                placeholder="Ej. 2 bultos de alimento para perro adulto"
                className="w-full rounded-lg border border-gray-400 p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Comentario (opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Algo que quieras contarnos sobre tu donación"
              className="w-full rounded-lg border border-gray-400 p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {!loggedUser && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Nombre<span className="text-teal-500 ml-1">*</span>
                </label>
                <Input
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Correo<span className="text-teal-500 ml-1">*</span>
                </label>
                <Input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="tucorreo@email.com"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Teléfono (opcional)
                </label>
                <Input
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  placeholder="Ej. 5555-5555"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => {
                  setIsPublic(e.target.checked);
                  if (!e.target.checked) setIsAnonymous(false);
                }}
                className="accent-blue-meraki"
              />
              Autorizo que mi donación aparezca en el listado público de
              transparencia
            </label>
            {isPublic && (
              <label className="flex items-center gap-2 text-sm text-gray-600 ml-6">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="accent-blue-meraki"
                />
                <FaUserSecret className="w-3.5 h-3.5" />
                Mostrar mi donación como anónima
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 rounded-xl bg-blue-meraki hover:opacity-90 text-white text-sm font-semibold disabled:opacity-40 transition-all shadow-sm"
            >
              {isSubmitting ? "Enviando..." : "Registrar intención"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
