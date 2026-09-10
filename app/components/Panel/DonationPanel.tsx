import { useFetcher } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "sonner";
import { Field } from "~/components/Form/Field";
import Input from "~/components/Input";
import { PatrocinadorCombobox } from "~/components/Input/PatrocinadorCombobox";
import { Select } from "~/components/Input/Select";
import { Textarea } from "~/components/Input/Textarea";
import { useFocusTrap } from "~/hooks/useFocusTrap";

interface NamedOption {
  id: number;
  name: string;
}

interface BankOption {
  id: number;
  label: string;
}

interface DonationPanelProps {
  onClose: () => void;
  patrocinadores: NamedOption[];
  projects: NamedOption[];
  bankAccounts: BankOption[];
}

type Origin = "individual" | "patrocinador";
type DonationType = "Monetaria" | "Especie";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Errors = {
  patrocinador?: string;
  amount?: string;
  item?: string;
  donorEmail?: string;
  donorPhone?: string;
};

export function DonationPanel({
  onClose,
  patrocinadores,
  projects,
  bankAccounts,
}: DonationPanelProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const formId = useId();
  const fetcher = useFetcher<{ ok?: boolean; errorMsg?: string }>();
  const isSubmitting = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  const [origin, setOrigin] = useState<Origin>("individual");
  const [donationType, setDonationType] = useState<DonationType>("Monetaria");
  const [bankAccountId, setBankAccountId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const isMoney = donationType === "Monetaria";
  const serverError = fetcher.data?.errorMsg;

  const clearError = (key: keyof Errors) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // Al terminar: éxito → aviso + cerrar (el listado se revalida solo);
  // error → aviso y se deja el modal abierto.
  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (fetcher.data?.ok) {
        toast.success("Donación registrada.");
        onClose();
      }
      // El error del servidor se muestra dentro del formulario (alerta arriba),
      // no como toast: queda visible mientras se corrige.
    }
  }, [fetcher.state]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next: Errors = {};

    if (origin === "patrocinador" && !formData.get("md-patrocinador")) {
      next.patrocinador = "Selecciona el patrocinador.";
    }
    if (donationType === "Monetaria") {
      const amount = Number(formData.get("md-amount"));
      if (!Number.isFinite(amount) || amount <= 0) {
        next.amount = "Indica un monto mayor a cero.";
      } else if (amount > 9_999_999.99) {
        next.amount = "El monto es demasiado alto; verifícalo.";
      }
    } else if (!String(formData.get("md-item") ?? "").trim()) {
      next.item = "Describe el bien donado.";
    }

    // Datos del donante (origen individual): opcionales, pero si se escriben
    // deben tener formato válido.
    if (origin === "individual") {
      const email = String(formData.get("md-donor-email") ?? "").trim();
      const phone = String(formData.get("md-donor-phone") ?? "").trim();
      if (email && !EMAIL_RE.test(email)) {
        next.donorEmail = "El correo no tiene un formato válido.";
      }
      if (phone && (phone.match(/\d/g) ?? []).length < 6) {
        next.donorPhone = "El teléfono no parece válido.";
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[#1F1D1A]/40"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="registrar-donacion-title"
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl animate-modal-pop focus:outline-none sm:max-h-[88vh] sm:max-w-lg sm:rounded-2xl"
      >
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2
            id="registrar-donacion-title"
            className="text-base font-bold text-gray-800"
          >
            Registrar donación manual
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        {/* ── Cuerpo ── */}
        <fetcher.Form
          id={formId}
          method="post"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
          onSubmit={handleSubmit}
          noValidate
        >
          <input type="hidden" name="intent" value="create-manual" />

          {serverError && (
            <p
              role="alert"
              className="rounded-lg border border-pink-meraki/30 bg-pink-meraki/5 px-3 py-2 text-sm text-pink-meraki"
            >
              {serverError}
            </p>
          )}

          <Segmented
            legend="Origen"
            name="md-origin"
            value={origin}
            onChange={(value) => {
              setOrigin(value as Origin);
              clearError("patrocinador");
            }}
            options={[
              { value: "individual", label: "Individual" },
              { value: "patrocinador", label: "Patrocinador" },
            ]}
          />

          {origin === "patrocinador" && (
            <PatrocinadorCombobox
              patrocinadores={patrocinadores}
              error={errors.patrocinador}
              onValueChange={() => clearError("patrocinador")}
            />
          )}

          <Segmented
            legend="Tipo de donación"
            name="md-type"
            value={donationType}
            onChange={(value) => {
              setDonationType(value as DonationType);
              setErrors({});
            }}
            options={[
              { value: "Monetaria", label: "Monetaria" },
              { value: "Especie", label: "En especie" },
            ]}
          />

          {isMoney ? (
            <>
              <Field id="md-amount" label="Monto (Q)" error={errors.amount}>
                <Input
                  id="md-amount"
                  name="md-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  onChange={() => clearError("amount")}
                />
              </Field>

              <Field
                id="md-bank"
                label="Cuenta"
                optional
                hint="Si el depósito entró a una cuenta de la asociación."
              >
                <Select
                  id="md-bank"
                  name="md-bank"
                  className="w-full"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="">Sin cuenta</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {bankAccountId && (
                <Field id="md-reference" label="Número de referencia" optional>
                  <Input
                    id="md-reference"
                    name="md-reference"
                    maxLength={50}
                    placeholder="Ej. 0123456789"
                  />
                </Field>
              )}
            </>
          ) : (
            <Field
              id="md-item"
              label="Descripción del bien donado"
              error={errors.item}
            >
              <Textarea
                id="md-item"
                name="md-item"
                rows={3}
                placeholder="Ej. 40 láminas de zinc y 15 sacos de cemento"
                onChange={() => clearError("item")}
              />
            </Field>
          )}

          <Field id="md-project" label="Proyecto asociado" optional>
            <Select
              id="md-project"
              name="md-project"
              defaultValue=""
              className="w-full"
            >
              <option value="">Ninguno — fondo general</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="md-comment"
            label="Comentario"
            optional
            hint="Notas internas sobre esta donación."
          >
            <Textarea id="md-comment" name="md-comment" rows={2} />
          </Field>

          {origin === "individual" && (
            <fieldset className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3">
              <legend className="px-1 text-xs font-semibold text-gray-500">
                Datos del donante (opcional, si se conocen)
              </legend>
              <Field id="md-donor-name" label="Nombre" optional>
                <Input
                  id="md-donor-name"
                  name="md-donor-name"
                  maxLength={100}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id="md-donor-email"
                  label="Correo"
                  optional
                  error={errors.donorEmail}
                >
                  <Input
                    id="md-donor-email"
                    name="md-donor-email"
                    type="email"
                    maxLength={100}
                    aria-invalid={Boolean(errors.donorEmail)}
                    onChange={() => clearError("donorEmail")}
                  />
                </Field>
                <Field
                  id="md-donor-phone"
                  label="Teléfono"
                  optional
                  error={errors.donorPhone}
                >
                  <Input
                    id="md-donor-phone"
                    name="md-donor-phone"
                    maxLength={25}
                    aria-invalid={Boolean(errors.donorPhone)}
                    onChange={() => clearError("donorPhone")}
                  />
                </Field>
              </div>
            </fieldset>
          )}

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="md-public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-medium-turquoise-meraki"
              />
              Mostrar en el listado público de transparencia
            </label>
            {isPublic && (
              <label className="ml-6 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="md-anonymous"
                  className="h-4 w-4 rounded border-gray-300 accent-medium-turquoise-meraki"
                />
                Mostrar como donación anónima
              </label>
            )}
          </div>
        </fetcher.Form>

        {/* ── Pie ── */}
        <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-medium-turquoise-meraki py-2 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Registrando…" : "Registrar donación"}
          </button>
        </div>
      </div>
    </div>
  );
}

/*==============================| Subcomponentes |==============================*/
/* Control segmentado (radio group) con label vía <fieldset>/<legend>. El radio
   real queda oculto pero sigue siendo enfocable y navegable con flechas. */
function Segmented({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-gray-700">{legend}</legend>
      <div className="flex gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-medium-turquoise-meraki/40 ${
                selected
                  ? "border-medium-turquoise-meraki bg-medium-turquoise-meraki/10 font-medium text-medium-turquoise-meraki"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
