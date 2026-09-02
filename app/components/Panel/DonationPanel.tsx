import { donation_type_donation, donationBankAccount } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import Input from "../Input";
import { Select } from "../Input/Select";

interface DonationPanelProps {
  open: boolean;
  onClose: () => void;
  bankAccounts: donationBankAccount[];
}

/**
 * Panel lateral (slide-over) para registrar manualmente una donación recibida
 * fuera del sistema. Usa un fetcher en vez de navegar, así el listado y sus
 * filtros de fondo no se pierden. Envía a la acción de la ruta de listado con
 * `intent: "create-manual"`.
 */
export function DonationPanel({
  open,
  onClose,
  bankAccounts,
}: DonationPanelProps) {
  const fetcher = useFetcher();
  const wasSubmitting = useRef(false);

  const [donationType, setDonationType] =
    useState<donation_type_donation>("Monetaria");
  const [bankAccountId, setBankAccountId] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Reinicia el formulario cada vez que se abre el panel
  useEffect(() => {
    if (open) {
      setDonationType("Monetaria");
      setBankAccountId("");
      setIsPublic(false);
    }
  }, [open]);

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      onClose();
    }
  }, [fetcher.state]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#1F1D1A]/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar donación manual"
      >
        <div className="flex items-center justify-between border-b border-[#EAE6DC] px-5 py-4">
          <h2 className="font-semibold">Registrar donación manual</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A8577] hover:bg-[#F4F2EC]"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <fetcher.Form method="post" className="flex flex-col gap-4 p-5">
          <input type="hidden" name="intent" value="create-manual" />

          <Field label="Tipo de donación">
            <div className="flex gap-2">
              {(["Monetaria", "Especie"] as donation_type_donation[]).map(
                (opt) => (
                  <label
                    key={opt}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${
                      donationType === opt
                        ? "border-medium-turquoise-meraki bg-medium-turquoise-meraki/10 text-medium-turquoise-meraki font-medium"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="donation_type"
                      value={opt}
                      checked={donationType === opt}
                      onChange={() => setDonationType(opt)}
                      className="accent-medium-turquoise-meraki"
                    />
                    {opt === "Monetaria" ? "Monetaria" : "En especie"}
                  </label>
                ),
              )}
            </div>
          </Field>

          {donationType === "Monetaria" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto (Q)">
                <Input type="number" name="amount" min="1" step="0.01" required />
              </Field>
              <Field label="Cuenta (opcional)">
                <Select
                  name="bank_account_id"
                  className="w-full"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="">Sin cuenta</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number}
                    </option>
                  ))}
                </Select>
              </Field>
              {bankAccountId && (
                <Field label="Número de referencia (opcional)">
                  <Input name="reference_number" maxLength={50} />
                </Field>
              )}
            </div>
          ) : (
            <Field label="Descripción de los artículos">
              <textarea
                name="item_description"
                rows={3}
                required
                className="w-full py-2 px-3 border border-gray-400 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              />
            </Field>
          )}

          <Field label="Comentario (opcional)">
            <textarea
              name="comment"
              rows={2}
              className="w-full py-2 px-3 border border-gray-400 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 border-t border-[#F0EDE5] pt-4">
            <p className="text-xs font-medium text-[#8A8577]">
              Datos del donante (opcional, si se conocen)
            </p>
            <Field label="Nombre">
              <Input name="donor_name" maxLength={100} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Correo">
                <Input type="email" name="donor_email" maxLength={100} />
              </Field>
              <Field label="Teléfono">
                <Input name="donor_phone" maxLength={25} />
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[#F0EDE5] pt-4">
            <label className="flex items-center gap-2 text-sm text-[#3A362E]">
              <input
                type="checkbox"
                name="is_public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-[#E4E0D6] text-[#1F1D1A]"
              />
              Mostrar en el listado público de transparencia
            </label>
            {isPublic && (
              <label className="flex items-center gap-2 text-sm text-[#3A362E] ml-6">
                <input
                  type="checkbox"
                  name="is_anonymous"
                  className="h-4 w-4 rounded border-[#E4E0D6] text-[#1F1D1A]"
                />
                Mostrar como donación anónima
              </label>
            )}
          </div>

          <div className="mt-2 flex gap-2 border-t border-[#F0EDE5] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-medium-turquoise-meraki py-2 text-sm font-medium text-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="flex-1 rounded-lg bg-medium-turquoise-meraki py-2 text-sm font-medium text-white hover:bg-medium-turquoise-meraki/80 disabled:opacity-60"
            >
              {fetcher.state !== "idle" ? "Guardando..." : "Registrar donación"}
            </button>
          </div>
        </fetcher.Form>
      </aside>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-[#3A362E]">{label}</span>
      {children}
    </label>
  );
}
