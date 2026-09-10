import { useFetcher } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import { FaExclamationTriangle, FaPlus, FaTimes } from "react-icons/fa";
import { toast } from "sonner";
import { Field } from "~/components/Form/Field";
import Input from "~/components/Input";
import { Select } from "~/components/Input/Select";
import { useFocusTrap } from "~/hooks/useFocusTrap";
import type { AdminDonationBankAccount } from "~/services/db/donationBankAccount.service";
import type { AdminNeededSupply } from "~/services/db/needSupplies.service";

/* Identificadores del enum account_type_donationBankAccount (el cliente de
   Prisma devuelve el identificador, no el valor @map) + su etiqueta legible. */
const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: "Monetaria", label: "Cuenta monetaria" },
  { value: "Ahorro", label: "Cuenta de ahorro" },
  { value: "Pr_stamo", label: "Préstamo" },
  { value: "Tarjeta_de_cr_dito", label: "Tarjeta de crédito" },
];
const accountTypeLabel = (value: string) =>
  ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value;

type ActionResponse = { ok?: boolean; intent?: string; errorMsg?: string };

interface DonationSettingsDrawerProps {
  onClose: () => void;
  bankAccounts: AdminDonationBankAccount[];
  insumos: AdminNeededSupply[];
  allowedToCreate?: boolean;
  allowedToUpdate?: boolean;
}

export function DonationSettingsDrawer({
  onClose,
  bankAccounts,
  insumos,
  allowedToCreate,
  allowedToUpdate,
}: DonationSettingsDrawerProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);

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
        aria-labelledby="donation-settings-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl animate-slide-in-right focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2
            id="donation-settings-title"
            className="text-base font-bold text-gray-800"
          >
            Medios e insumos
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

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-5 py-5">
          <BankAccountsSection
            accounts={bankAccounts}
            allowedToCreate={allowedToCreate}
            allowedToUpdate={allowedToUpdate}
          />
          <InsumosSection
            insumos={insumos}
            allowedToCreate={allowedToCreate}
            allowedToUpdate={allowedToUpdate}
          />
        </div>
      </div>
    </div>
  );
}

/*========================| Sección: medios de depósito |========================*/
function BankAccountsSection({
  accounts,
  allowedToCreate,
  allowedToUpdate,
}: {
  accounts: AdminDonationBankAccount[];
  allowedToCreate?: boolean;
  allowedToUpdate?: boolean;
}) {
  const fetcher = useFetcher<ActionResponse>();
  const busy = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<number | null>(null);

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (fetcher.data?.ok) {
        setCreating(false);
        setEditingId(null);
        setConfirmToggleId(null);
        toast.success("Medio de depósito actualizado.");
      } else if (fetcher.data?.errorMsg) {
        toast.error(fetcher.data.errorMsg);
      }
    }
  }, [fetcher.state]);

  const submit = (values: Record<string, string>) =>
    fetcher.submit(values, { method: "post" });

  return (
    <section
      aria-labelledby="settings-bank-title"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="settings-bank-title"
          className="text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          Medios de depósito
        </h3>
        {allowedToCreate && !creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
          >
            <FaPlus className="h-2.5 w-2.5" aria-hidden />
            Agregar
          </button>
        )}
      </div>

      {creating && (
        <BankAccountForm
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(fields) =>
            submit({ intent: "bank-account-create", ...fields })
          }
        />
      )}

      {accounts.length === 0 && !creating ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          Aún no hay cuentas registradas. Agrega la primera para que aparezca en
          la sección «Cómo apoyar» de la vista pública.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) =>
            editingId === account.id ? (
              <li key={account.id}>
                <BankAccountForm
                  account={account}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(fields) =>
                    submit({
                      intent: "bank-account-update",
                      bankAccountId: String(account.id),
                      ...fields,
                    })
                  }
                />
              </li>
            ) : (
              <li
                key={account.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {account.bank_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {accountTypeLabel(account.account_type)} · No. …
                      {account.account_number.slice(-4)}
                    </p>
                    {account.account_holder && (
                      <p className="truncate text-xs text-gray-400">
                        A nombre de {account.account_holder}
                      </p>
                    )}
                  </div>
                  <StatusBadge active={account.active} />
                </div>

                {confirmToggleId === account.id ? (
                  <InlineConfirm
                    message={
                      account.active
                        ? "¿Desactivar esta cuenta? Dejará de mostrarse en la vista pública."
                        : "¿Reactivar esta cuenta? Volverá a mostrarse públicamente."
                    }
                    confirmLabel={account.active ? "Desactivar" : "Reactivar"}
                    busy={busy}
                    onConfirm={() =>
                      submit({
                        intent: "bank-account-toggle",
                        bankAccountId: String(account.id),
                        active: String(!account.active),
                      })
                    }
                    onCancel={() => setConfirmToggleId(null)}
                  />
                ) : (
                  <div className="flex gap-3">
                    {allowedToUpdate && (
                      <>
                        <RowAction
                          onClick={() => {
                            setEditingId(account.id);
                            setCreating(false);
                          }}
                        >
                          Editar
                        </RowAction>
                        <RowAction
                          danger={account.active}
                          onClick={() => setConfirmToggleId(account.id)}
                        >
                          {account.active ? "Desactivar" : "Reactivar"}
                        </RowAction>
                      </>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function BankAccountForm({
  account,
  busy,
  onSubmit,
  onCancel,
}: {
  account?: AdminDonationBankAccount;
  busy: boolean;
  onSubmit: (fields: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountType, setAccountType] = useState(account?.account_type ?? "");
  const [accountNumber, setAccountNumber] = useState(
    account?.account_number ?? "",
  );
  const [accountHolder, setAccountHolder] = useState(
    account?.account_holder ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const uid = useId();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!bankName.trim()) next.bankName = "Escribe el nombre del banco.";
    if (!accountType) next.accountType = "Selecciona el tipo de cuenta.";
    if (!accountNumber.trim())
      next.accountNumber = "Escribe el número de cuenta.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({
      bankName: bankName.trim(),
      accountType,
      accountNumber: accountNumber.trim(),
      accountHolder: accountHolder.trim(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-medium-turquoise-meraki/40 bg-medium-turquoise-meraki/5 p-3"
    >
      <p className="text-xs font-semibold text-gray-600">
        {account ? "Editar cuenta" : "Nueva cuenta"}
      </p>

      <Field id={`${uid}-bank`} label="Banco" error={errors.bankName}>
        <Input
          id={`${uid}-bank`}
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          maxLength={100}
          placeholder="Ej. Banco Industrial"
          aria-invalid={Boolean(errors.bankName)}
        />
      </Field>

      <Field
        id={`${uid}-type`}
        label="Tipo de cuenta"
        error={errors.accountType}
      >
        <Select
          id={`${uid}-type`}
          className="w-full"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          aria-invalid={Boolean(errors.accountType)}
        >
          <option value="">Selecciona…</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id={`${uid}-number`}
        label="Número de cuenta"
        error={errors.accountNumber}
      >
        <Input
          id={`${uid}-number`}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          maxLength={50}
          placeholder="Ej. 000-000000-0"
          aria-invalid={Boolean(errors.accountNumber)}
        />
      </Field>

      <Field id={`${uid}-holder`} label="A nombre de" optional>
        <Input
          id={`${uid}-holder`}
          value={accountHolder}
          onChange={(e) => setAccountHolder(e.target.value)}
          maxLength={100}
          placeholder="Titular de la cuenta"
        />
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-medium-turquoise-meraki py-1.5 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

/*========================| Sección: insumos necesitados |========================*/
function InsumosSection({
  insumos,
  allowedToCreate,
  allowedToUpdate,
}: {
  insumos: AdminNeededSupply[];
  allowedToCreate?: boolean;
  allowedToUpdate?: boolean;
}) {
  const fetcher = useFetcher<ActionResponse>();
  const busy = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (fetcher.data?.ok) {
        setCreating(false);
        setEditingId(null);
        setConfirmRemoveId(null);
        toast.success("Lista de insumos actualizada.");
      } else if (fetcher.data?.errorMsg) {
        toast.error(fetcher.data.errorMsg);
      }
    }
  }, [fetcher.state]);

  const submit = (values: Record<string, string>) =>
    fetcher.submit(values, { method: "post" });

  return (
    <section
      aria-labelledby="settings-insumos-title"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="settings-insumos-title"
          className="text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          Insumos necesitados
        </h3>
        {allowedToCreate && !creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
          >
            <FaPlus className="h-2.5 w-2.5" aria-hidden />
            Agregar
          </button>
        )}
      </div>

      {creating && (
        <InsumoForm
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(description) =>
            submit({ intent: "insumo-create", description })
          }
        />
      )}

      {insumos.length === 0 && !creating ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          Aún no hay insumos en la lista. Agrega lo que la asociación necesita
          ahora mismo (alimento, medicinas, material).
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {insumos.map((insumo) =>
            editingId === insumo.id ? (
              <li key={insumo.id}>
                <InsumoForm
                  insumo={insumo}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(description) =>
                    submit({
                      intent: "insumo-update",
                      insumoId: String(insumo.id),
                      description,
                    })
                  }
                />
              </li>
            ) : (
              <li
                key={insumo.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm text-gray-800">
                    {insumo.description}
                  </p>
                  <StatusBadge active={insumo.active} />
                </div>

                {confirmRemoveId === insumo.id ? (
                  <InlineConfirm
                    message={
                      insumo.active
                        ? `¿Quitar «${insumo.description}» de la lista? Puedes reactivarlo después.`
                        : `¿Reactivar «${insumo.description}»? Volverá a aparecer en la vista pública.`
                    }
                    confirmLabel={insumo.active ? "Quitar" : "Reactivar"}
                    busy={busy}
                    onConfirm={() =>
                      submit({
                        intent: "insumo-toggle",
                        insumoId: String(insumo.id),
                        active: String(!insumo.active),
                      })
                    }
                    onCancel={() => setConfirmRemoveId(null)}
                  />
                ) : (
                  <div className="flex gap-3">
                    {allowedToUpdate && (
                      <>
                        <RowAction
                          onClick={() => {
                            setEditingId(insumo.id);
                            setCreating(false);
                          }}
                        >
                          Editar
                        </RowAction>
                        <RowAction
                          danger={insumo.active}
                          onClick={() => setConfirmRemoveId(insumo.id)}
                        >
                          {insumo.active ? "Quitar" : "Reactivar"}
                        </RowAction>
                      </>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function InsumoForm({
  insumo,
  busy,
  onSubmit,
  onCancel,
}: {
  insumo?: AdminNeededSupply;
  busy: boolean;
  onSubmit: (description: string) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(insumo?.description ?? "");
  const [error, setError] = useState<string | undefined>();
  const uid = useId();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim()) {
      setError("Escribe la descripción del insumo.");
      return;
    }
    onSubmit(description.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-medium-turquoise-meraki/40 bg-medium-turquoise-meraki/5 p-3"
    >
      <Field
        id={`${uid}-desc`}
        label={insumo ? "Editar insumo" : "Nuevo insumo"}
        error={error}
      >
        <Input
          id={`${uid}-desc`}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError(undefined);
          }}
          maxLength={150}
          placeholder="Ej. Alimento para cachorro"
          aria-invalid={Boolean(error)}
        />
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-medium-turquoise-meraki py-1.5 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

/*==============================| Subcomponentes |==============================*/
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-500"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function RowAction({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded ${
        danger
          ? "text-pink-meraki focus-visible:ring-pink-meraki/40"
          : "text-medium-turquoise-meraki focus-visible:ring-medium-turquoise-meraki/40"
      }`}
    >
      {children}
    </button>
  );
}

function InlineConfirm({
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-2.5">
      <p className="flex items-start gap-1.5 text-xs text-gray-600">
        <FaExclamationTriangle
          className="mt-0.5 h-3 w-3 shrink-0 text-amber-500"
          aria-hidden
        />
        {message}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-lg border border-gray-200 py-1 text-xs font-medium text-gray-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-lg bg-pink-meraki py-1 text-xs font-semibold text-white hover:bg-pink-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Guardando…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
