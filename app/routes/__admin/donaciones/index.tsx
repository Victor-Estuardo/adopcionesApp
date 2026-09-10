import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useState } from "react";
import { LuPlus, LuSettings } from "react-icons/lu";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { PrimaryButton } from "~/components/Button/primary";
import { SecondaryButton } from "~/components/Button/secondary";
import { DONATION_STATUSES, DonationRow } from "~/components/Card/DonationRow";
import { Select } from "~/components/Input/Select";
import Pagination from "~/components/Pagination";
import { DonationDetailDrawer } from "~/components/Panel/DonationDetailDrawer";
import { DonationPanel } from "~/components/Panel/DonationPanel";
import { DonationSettingsDrawer } from "~/components/Panel/DonationSettingsDrawer";
import { DataEmptyState, DataErrorState } from "~/components/State/DataStates";
import { Prisma } from "@prisma/client";
import {
  AdminDonationBankAccount,
  createDonationBankAccountDb,
  getDonationBankAccountDb,
  listDonationBankAccountDb,
  listDonationBankAccountsAdminDb,
  updateDonationBankAccountDb,
} from "~/services/db/donationBankAccount.service";
import {
  AdminDonation,
  countDonationsDb,
  createDonationDb,
  getDonationDb,
  listDonationsAdminDb,
  reviewDonationDb,
  REVIEWABLE_DONATION_STATUSES,
} from "~/services/db/donation.service";
import {
  AdminNeededSupply,
  createNeededSupplyDb,
  getNeededSupplyDb,
  listNeededSuppliesAdminDb,
  updateNeededSupplyDb,
} from "~/services/db/needSupplies.service";
import {
  createSponsorDb,
  getSponsorDb,
  listActiveSponsorDb,
} from "~/services/db/sponsor.service";
import {
  getProyectoDb,
  listProjectOptionsDb,
} from "~/services/db/project.service";
import { getSession } from "~/services/sessions/sessions.service";
import {
  sanitizeAmount,
  sanitizeEmail,
  sanitizeLimit,
  sanitizePhone,
  sanitizeText,
} from "~/utils/sanitize";
import { validatePermission } from "~/utils/common";
import { PermissionSession } from "~/services/auth/login.service";

const DONATIONS_PER_PAGE = 25;

/* Identificadores del enum account_type_donationBankAccount de Prisma (el
   cliente devuelve el identificador, no el valor @map). */
const BANK_ACCOUNT_TYPES = [
  "Monetaria",
  "Ahorro",
  "Pr_stamo",
  "Tarjeta_de_cr_dito",
] as const;
type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

export const meta = () => {
  return [{ title: "DONACIONES" }];
};

/*==============================| Loader |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const permissions: PermissionSession[] = session.get("permissions");

  const validateRequest = validatePermission(session, 15, "Leer");
  if (validateRequest) throw validateRequest;

  // Verificamos que tenga el permiso de creación y edición
  const allowedToCreate = !!permissions.find(
    (p) => p.module_id === 15 && p.action === "Crear",
  );

  const allowedToUpdate = !!permissions.find(
    (p) => p.module_id === 15 && p.action === "Actualizar",
  );

  const params = new URL(request.url).searchParams;
  const type = params.get("type") || undefined;
  const status = params.get("status") || undefined;
  const origin = params.get("origin") || undefined;
  const project = params.get("project") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  // El filtrado va en la propia query, no en memoria.
  const where: Prisma.donationWhereInput = {};
  if (type === "Monetaria" || type === "Especie") where.donation_type = type;
  if (status) where.status = status;
  if (origin === "patrocinador") where.patrocinador_id = { not: null };
  else if (origin === "individual") where.patrocinador_id = null;

  const projectId = sanitizeLimit(project, { max: 1_000_000 });
  if (projectId !== undefined) where.proyecto_id = projectId;

  if (from || to) {
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.submitted_at = range;
  }

  const [
    suppliesRes,
    bankAccountsRes,
    donationsRes,
    countRes,
    projectOptsRes,
    sponsorOptsRes,
  ] = await Promise.all([
    listNeededSuppliesAdminDb(),
    listDonationBankAccountsAdminDb(),
    listDonationsAdminDb(
      where,
      (page - 1) * DONATIONS_PER_PAGE,
      DONATIONS_PER_PAGE,
    ),
    countDonationsDb(where),
    listProjectOptionsDb(),
    listActiveSponsorDb(),
  ]);

  if (
    !suppliesRes.success ||
    !bankAccountsRes.success ||
    !donationsRes.success ||
    !countRes.success ||
    !projectOptsRes.success ||
    !sponsorOptsRes.success
  ) {
    return json({
      donations: [],
      total: 0,
      page: 1,
      totalPages: 1,
      projectOptions: [],
      patrocinadorOptions: [],
      bankAccountOptions: [],
      insumos: [],
      bankAccounts: [],
      errorMsg: "Ocurrió un error al cargar las donaciones",
      allowedToCreate,
      allowedToUpdate,
    });
  }

  // Opciones para el modal "Registrar donación": solo patrocinadores y cuentas
  // activas (registrar contra uno inactivo lo rechazaría el servidor).
  const bankAccountOptions = bankAccountsRes.data
    .filter((account) => account.active)
    .map((account) => ({
      id: account.id,
      label: `${account.bank_name} · No. …${account.account_number.slice(-4)}`,
    }));

  return json({
    donations: donationsRes.data,
    total: countRes.data,
    page,
    totalPages: Math.max(1, Math.ceil(countRes.data / DONATIONS_PER_PAGE)),
    projectOptions: projectOptsRes.data,
    patrocinadorOptions: sponsorOptsRes.data.map((p) => ({
      id: p.id,
      name: p.name,
    })),
    bankAccountOptions,
    insumos: suppliesRes.data,
    bankAccounts: bankAccountsRes.data,
    allowedToCreate,
    allowedToUpdate,
  });
};

type LoaderData = {
  donations: AdminDonation[];
  total: number;
  page: number;
  totalPages: number;
  projectOptions: { id: number; name: string }[];
  patrocinadorOptions: { id: number; name: string }[];
  bankAccountOptions: { id: number; label: string }[];
  insumos: AdminNeededSupply[];
  bankAccounts: AdminDonationBankAccount[];
  errorMsg?: string;
  allowedToCreate: boolean;
  allowedToUpdate: boolean;
};

/*==============================| Action |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const reviewerId = Number(session.get("dbUserId")) || null;

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const intent = formData.get("intent");

  /* ── gestión: administración confirma o rechaza una donación ── */
  if (intent === "confirm" || intent === "reject") {
    const validateRequest = validatePermission(session, 15, "Actualizar");
    if (validateRequest) throw validateRequest;

    const donationId = sanitizeText(formData.get("donationId"), 40);
    if (!donationId) {
      return json({ errorMsg: "Falta identificar la donación." });
    }

    const donationRes = await getDonationDb({ id: donationId });
    if (!donationRes.success || !donationRes.data) {
      return json({ errorMsg: "No se encontró la donación." });
    }
    const donation = donationRes.data;

    if (!REVIEWABLE_DONATION_STATUSES.includes(donation.status)) {
      return json({
        errorMsg: "Esta donación ya fue procesada; no admite cambios.",
      });
    }

    const now = new Date();

    if (intent === "confirm") {
      // El monto confirmado solo aplica a donaciones monetarias y puede diferir
      // del declarado. Si administración no ajusta el campo, se toma el monto
      // declarado como confirmado.
      let confirmedAmount: string | null = null;
      if (donation.donation_type === "Monetaria") {
        confirmedAmount =
          sanitizeAmount(formData.get("confirmedAmount")) ??
          sanitizeAmount(donation.declared_amount?.toString());
        if (!confirmedAmount) {
          return json({
            errorMsg: "Indica un monto confirmado válido mayor a cero.",
          });
        }
      }

      const updated = await reviewDonationDb(donationId, {
        status: "confirmada",
        reviewed_by: reviewerId,
        confirmed_amount: confirmedAmount,
        updated_at: now,
      });

      if (!updated.success || updated.data === 0) {
        return json({
          errorMsg: "No se pudo confirmar la donación. Actualiza y reintenta.",
        });
      }
      return json({ ok: true, intent: "confirm" });
    }

    // intent === "reject": el motivo se guarda en la columna existente
    // rejection_reason (uso interno).
    const rejectionReason = sanitizeText(formData.get("rejectionReason"), 500);
    if (!rejectionReason) {
      return json({ errorMsg: "Escribe el motivo del rechazo." });
    }

    const updated = await reviewDonationDb(donationId, {
      status: "rechazada",
      reviewed_by: reviewerId,
      rejection_reason: rejectionReason,
      updated_at: now,
    });
    if (!updated.success || updated.data === 0) {
      return json({
        errorMsg: "No se pudo rechazar la donación. Actualiza y reintenta.",
      });
    }
    return json({ ok: true, intent: "reject" });
  }

  if (intent === "create-manual") {
    const validateRequest = validatePermission(session, 15, "Crear");
    if (validateRequest) throw validateRequest;

    const origin = formData.get("md-origin");
    if (origin !== "individual" && origin !== "patrocinador") {
      return json({ errorMsg: "Indica el origen de la donación." });
    }

    const donationType = formData.get("md-type");
    if (donationType !== "Monetaria" && donationType !== "Especie") {
      return json({ errorMsg: "Indica el tipo de donación." });
    }

    // Origen: exactamente uno de los dos.
    let patrocinadorId: number | null = null;
    let donorName: string | null = null;
    let donorEmail: string | null = null;
    let donorPhone: string | null = null;

    if (origin === "patrocinador") {
      const rawSponsorId = sanitizeLimit(formData.get("md-patrocinador"), {
        max: 1_000_000,
      });
      if (rawSponsorId === undefined) {
        return json({ errorMsg: "Selecciona el patrocinador." });
      }
      const sponsorRes = await getSponsorDb({
        id: rawSponsorId,
        active: true,
      });
      if (!sponsorRes.success || !sponsorRes.data) {
        return json({ errorMsg: "El patrocinador seleccionado no es válido." });
      }
      patrocinadorId = rawSponsorId;
      // Origen patrocinador ⇒ no se guardan datos de donante individual.
    } else {
      // Origen individual: los datos del donante son opcionales ("si se
      // conocen"); patrocinador_id queda en null.
      donorName = sanitizeText(formData.get("md-donor-name"), 100) || null;
      donorEmail = sanitizeEmail(formData.get("md-donor-email"));
      donorPhone = sanitizePhone(formData.get("md-donor-phone"));
    }

    // Monto (monetaria) o descripción del bien (especie): uno u otro, obligatorio.
    let declaredAmount: string | null = null;
    let itemDescription: string | null = null;
    let bankAccountId: number | null = null;
    let referenceNumber: string | null = null;

    if (donationType === "Monetaria") {
      const rawAmount = Number(formData.get("md-amount"));
      if (Number.isFinite(rawAmount) && rawAmount > 9_999_999.99) {
        return json({ errorMsg: "El monto es demasiado alto; verifícalo." });
      }
      declaredAmount = sanitizeAmount(formData.get("md-amount"));
      if (!declaredAmount) {
        return json({ errorMsg: "Indica un monto válido mayor a cero." });
      }

      // Cuenta bancaria + referencia: opcionales; si se indica cuenta, debe
      // existir y estar activa.
      const rawBankId = sanitizeLimit(formData.get("md-bank"), {
        max: 1_000_000,
      });
      if (rawBankId !== undefined) {
        const accRes = await listDonationBankAccountDb({
          id: rawBankId,
          active: true,
        });
        if (!accRes.success || accRes.data.length === 0) {
          return json({ errorMsg: "La cuenta seleccionada no es válida." });
        }
        bankAccountId = rawBankId;
        referenceNumber =
          sanitizeText(formData.get("md-reference"), 50) || null;
      }
    } else {
      itemDescription = sanitizeText(formData.get("md-item"), 500) || null;
      if (!itemDescription) {
        return json({ errorMsg: "Describe el bien donado." });
      }
    }

    // Proyecto asociado: si se indica, debe existir.
    let proyectoId: number | null = null;
    const rawProyectoId = sanitizeLimit(formData.get("md-project"), {
      max: 1_000_000,
    });
    if (rawProyectoId !== undefined) {
      const projRes = await getProyectoDb({ id: rawProyectoId });
      if (!projRes.success || !projRes.data) {
        return json({ errorMsg: "El proyecto seleccionado no es válido." });
      }
      proyectoId = rawProyectoId;
    }

    const isPublic = formData.get("md-public") === "on";
    const isAnonymous = isPublic && formData.get("md-anonymous") === "on";
    const comment = sanitizeText(formData.get("md-comment"), 1000) || null;

    // Estado inicial "en coordinación": las donaciones que registra
    // administración se coordinan por un canal externo y quedan pendientes de
    // concretar/confirmar la entrega. El monto confirmado se fija
    // después con el intent "confirm".
    const now = new Date();
    const createRes = await createDonationDb({
      user_id: null,
      donor_name: donorName,
      donor_email: donorEmail,
      donor_phone: donorPhone,
      patrocinador_id: patrocinadorId,
      proyecto_id: proyectoId,
      donation_type: donationType,
      declared_amount: declaredAmount,
      item_description: itemDescription,
      bank_account_id: bankAccountId,
      reference_number: referenceNumber,
      status: "coordinacion",
      is_public: isPublic,
      is_anonymous: isAnonymous,
      comment,
      submitted_at: now,
      updated_at: now,
    });

    if (!createRes.success) {
      return json({ errorMsg: "Ocurrió un error al registrar la donación." });
    }

    return json({ ok: true, intent: "create-manual" });
  }

  const catalogEditorId = Number(session.get("dbUserId"));
  if (!catalogEditorId) {
    return json({ errorMsg: "No se pudo identificar al usuario." });
  }

  if (intent === "create-patrocinador") {
    const validateRequest = validatePermission(session, 13, "Crear");
    if (validateRequest) throw validateRequest;

    const name = sanitizeText(formData.get("name"), 100);
    if (!name) {
      return json({ errorMsg: "Escribe el nombre del patrocinador." });
    }
    const res = await createSponsorDb({
      name,
      active: true,
      creator_id: catalogEditorId,
      updater_id: catalogEditorId,
    });
    if (!res.success) {
      return json({ errorMsg: "No se pudo crear el patrocinador." });
    }
    return json({
      newPatrocinador: { id: res.data.id, name: res.data.name },
    });
  }

  /* ──────────────────────| insumos necesitados |────────────────────── */
  if (intent === "insumo-create") {
    const validateRequest = validatePermission(session, 15, "Crear");
    if (validateRequest) throw validateRequest;

    const description = sanitizeText(formData.get("description"), 150);
    if (!description) {
      return json({ errorMsg: "Escribe la descripción del insumo." });
    }
    const res = await createNeededSupplyDb({
      description,
      active: true,
      creator_id: catalogEditorId,
      updater_id: catalogEditorId,
    });
    if (!res.success) {
      return json({ errorMsg: "No se pudo registrar el insumo." });
    }
    return json({ ok: true, intent: "insumo-create" });
  }

  if (intent === "insumo-update") {
    const validateRequest = validatePermission(session, 15, "Actualizar");
    if (validateRequest) throw validateRequest;

    const insumoId = sanitizeLimit(formData.get("insumoId"), {
      max: 1_000_000,
    });
    if (insumoId === undefined) {
      return json({ errorMsg: "Falta identificar el insumo." });
    }
    const currentRes = await getNeededSupplyDb({ id: insumoId });
    if (!currentRes.success || !currentRes.data) {
      return json({ errorMsg: "No se encontró el insumo." });
    }

    const description = sanitizeText(formData.get("description"), 150);
    if (!description) {
      return json({ errorMsg: "Escribe la descripción del insumo." });
    }

    const res = await updateNeededSupplyDb(insumoId, {
      description,
      updater_id: catalogEditorId,
      update_date: new Date(),
    });
    if (!res.success) {
      return json({ errorMsg: "No se pudo actualizar el insumo." });
    }
    return json({ ok: true, intent: "insumo-update" });
  }

  // "Quitar" = desactivar (reversible); "Reactivar" = volver a activar. No se
  // borra la fila. El estado deseado llega explícito para ser idempotente,
  // igual que bank-account-toggle.
  if (intent === "insumo-toggle") {
    const validateRequest = validatePermission(session, 15, "Actualizar");
    if (validateRequest) throw validateRequest;

    const insumoId = sanitizeLimit(formData.get("insumoId"), {
      max: 1_000_000,
    });
    if (insumoId === undefined) {
      return json({ errorMsg: "Falta identificar el insumo." });
    }
    const currentRes = await getNeededSupplyDb({ id: insumoId });
    if (!currentRes.success || !currentRes.data) {
      return json({ errorMsg: "No se encontró el insumo." });
    }
    const active = formData.get("active") === "true";
    const res = await updateNeededSupplyDb(insumoId, {
      active,
      updater_id: catalogEditorId,
      update_date: new Date(),
    });
    if (!res.success) {
      return json({ errorMsg: "No se pudo cambiar el estado del insumo." });
    }
    return json({ ok: true, intent: "insumo-toggle" });
  }

  /* ────────────────────| cuentas bancarias de donación |──────────────────── */
  if (intent === "bank-account-create" || intent === "bank-account-update") {
    const bankName = sanitizeText(formData.get("bankName"), 100);
    const accountNumber = sanitizeText(formData.get("accountNumber"), 50);
    const accountHolder =
      sanitizeText(formData.get("accountHolder"), 100) || null;
    const accountTypeRaw = formData.get("accountType");
    const accountType = BANK_ACCOUNT_TYPES.includes(
      accountTypeRaw as BankAccountType,
    )
      ? (accountTypeRaw as BankAccountType)
      : null;

    if (!bankName) return json({ errorMsg: "Escribe el nombre del banco." });
    if (!accountType) {
      return json({ errorMsg: "Selecciona el tipo de cuenta." });
    }
    if (!accountNumber) {
      return json({ errorMsg: "Escribe el número de cuenta." });
    }

    if (intent === "bank-account-create") {
      const validateRequest = validatePermission(session, 15, "Crear");
      if (validateRequest) throw validateRequest;

      const res = await createDonationBankAccountDb({
        bank_name: bankName,
        account_type: accountType,
        account_number: accountNumber,
        account_holder: accountHolder,
        active: true,
        creator_id: catalogEditorId,
        updater_id: catalogEditorId,
      });
      if (!res.success) {
        return json({ errorMsg: "No se pudo registrar la cuenta." });
      }
      return json({ ok: true, intent: "bank-account-create" });
    }

    const validateRequest = validatePermission(session, 15, "Actualizar");
    if (validateRequest) throw validateRequest;

    const bankAccountId = sanitizeLimit(formData.get("bankAccountId"), {
      max: 1_000_000,
    });
    if (bankAccountId === undefined) {
      return json({ errorMsg: "Falta identificar la cuenta." });
    }
    const currentRes = await getDonationBankAccountDb({ id: bankAccountId });
    if (!currentRes.success || !currentRes.data) {
      return json({ errorMsg: "No se encontró la cuenta." });
    }
    const res = await updateDonationBankAccountDb(bankAccountId, {
      bank_name: bankName,
      account_type: accountType,
      account_number: accountNumber,
      account_holder: accountHolder,
      updater_id: catalogEditorId,
      update_date: new Date(),
    });
    if (!res.success) {
      return json({ errorMsg: "No se pudo actualizar la cuenta." });
    }
    return json({ ok: true, intent: "bank-account-update" });
  }

  if (intent === "bank-account-toggle") {
    const validateRequest = validatePermission(session, 15, "Actualizar");
    if (validateRequest) throw validateRequest;

    const bankAccountId = sanitizeLimit(formData.get("bankAccountId"), {
      max: 1_000_000,
    });
    if (bankAccountId === undefined) {
      return json({ errorMsg: "Falta identificar la cuenta." });
    }
    const currentRes = await getDonationBankAccountDb({ id: bankAccountId });
    if (!currentRes.success || !currentRes.data) {
      return json({ errorMsg: "No se encontró la cuenta." });
    }
    // El estado deseado llega explícito para que la acción sea idempotente y no
    // dependa de leer-y-alternar.
    const active = formData.get("active") === "true";
    const res = await updateDonationBankAccountDb(bankAccountId, {
      active,
      updater_id: catalogEditorId,
      update_date: new Date(),
    });
    if (!res.success) {
      return json({ errorMsg: "No se pudo cambiar el estado de la cuenta." });
    }
    return json({ ok: true, intent: "bank-account-toggle" });
  }

  return json({ errorMsg: "Acción no reconocida." }, { status: 400 });
};

const FILTER_KEYS = [
  "type",
  "status",
  "origin",
  "project",
  "from",
  "to",
] as const;

/*==============================| Component |==============================*/
export default function AdminDonacionesPage() {
  const {
    donations,
    total,
    page,
    totalPages,
    projectOptions,
    patrocinadorOptions,
    bankAccountOptions,
    insumos,
    bankAccounts,
    errorMsg,
    allowedToCreate,
    allowedToUpdate,
  } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // El listado se refresca solo tras confirmar/rechazar (revalidación de
  // Remix), así que `selectedId` siempre se resuelve contra los datos frescos.
  const selectedDonation = donations.find((d) => d.id === selectedId) ?? null;

  const isListLoading =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/donaciones";
  const hasActiveFilters = FILTER_KEYS.some((k) => searchParams.get(k));

  // Filtros y paginación viven en la URL (searchParams); cambiarlos navega y
  // el loader vuelve a consultar con el nuevo `where`.
  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        return next;
      },
      { preventScrollReset: true },
    );
  };

  return (
    <div className="flex h-full w-full flex-col gap-y-5 overflow-y-auto p-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="md:hidden text-xl font-bold text-gray-800">
            Donaciones
          </h1>
          <p className="text-sm text-gray-400">
            Gestiona las donaciones registradas por adoptantes, donantes y
            patrocinadores.
          </p>
        </div>
        {(allowedToCreate || allowedToUpdate) && (
          <div className="flex flex-wrap items-center gap-3">
            {(allowedToCreate || allowedToUpdate) && (
              <SecondaryButton
                label="Medios e insumos"
                Icon={LuSettings}
                onClick={() => setSettingsOpen(true)}
              />
            )}
            {allowedToCreate && (
              <PrimaryButton
                label="Registrar donación"
                Icon={LuPlus}
                onClick={() => setManualFormOpen(true)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Barra de filtros ── */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-2 md:flex md:flex-wrap items-center gap-3">
        <Select
          aria-label="Filtrar por tipo de donación"
          className="w-full sm:w-auto"
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
        >
          <option value="">Todo tipo</option>
          <option value="Monetaria">Monetaria</option>
          <option value="Especie">En especie</option>
        </Select>

        <Select
          aria-label="Filtrar por estado"
          className="w-full sm:w-auto"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">Todo estado</option>
          {DONATION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filtrar por origen"
          className="w-full sm:w-auto"
          value={searchParams.get("origin") ?? ""}
          onChange={(e) => updateParam("origin", e.target.value)}
        >
          <option value="">Todo origen</option>
          <option value="individual">Individual</option>
          <option value="patrocinador">Patrocinador</option>
        </Select>

        <Select
          aria-label="Filtrar por proyecto"
          className="w-full sm:w-auto"
          value={searchParams.get("project") ?? ""}
          onChange={(e) => updateParam("project", e.target.value)}
        >
          <option value="">Todo proyecto</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <input
          type="date"
          aria-label="Desde la fecha"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => updateParam("from", e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600"
        />
        <input
          type="date"
          aria-label="Hasta la fecha"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => updateParam("to", e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setSearchParams({}, { preventScrollReset: true })}
            className="px-2 py-1 text-sm text-medium-turquoise-meraki hover:underline"
          >
            Limpiar
          </button>
        )}

        <span
          className={`${
            hasActiveFilters ? "" : "col-span-2"
          } text-center md:ml-auto whitespace-nowrap text-sm text-gray-400`}
        >
          {total} {total === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/* ── Listado ── */}
      {errorMsg ? (
        <DataErrorState message="No pudimos cargar el listado de donaciones. Revisa tu conexión y vuelve a intentarlo." />
      ) : isListLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <AiOutlineLoading3Quarters className="h-10 w-10 animate-spin text-medium-turquoise-meraki" />
        </div>
      ) : donations.length === 0 ? (
        hasActiveFilters ? (
          <DataEmptyState
            title="Ninguna donación con estos filtros"
            message="Ajusta o limpia los filtros para ver más donaciones."
          />
        ) : (
          <DataEmptyState
            title="Todavía no hay donaciones registradas"
            message="Las donaciones que los donantes notifiquen y las que registres manualmente aparecerán aquí."
            action={
              allowedToCreate
                ? {
                    label: "Registrar la primera donación",
                    onClick: () => setManualFormOpen(true),
                  }
                : undefined
            }
          />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {donations.map((donation) => (
              <DonationRow
                key={donation.id}
                donation={donation}
                onSelect={(d) => setSelectedId(d.id)}
              />
            ))}
          </ul>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onChangePage={(next) => updateParam("page", String(next))}
          />
        </>
      )}

      <DonationDetailDrawer
        donation={selectedDonation}
        allowedToUpdate={allowedToUpdate}
        onClose={() => setSelectedId(null)}
      />

      {manualFormOpen && (
        <DonationPanel
          onClose={() => setManualFormOpen(false)}
          patrocinadores={patrocinadorOptions}
          projects={projectOptions}
          bankAccounts={bankAccountOptions}
        />
      )}

      {settingsOpen && (
        <DonationSettingsDrawer
          onClose={() => setSettingsOpen(false)}
          bankAccounts={bankAccounts}
          insumos={insumos}
          allowedToCreate={allowedToCreate}
          allowedToUpdate={allowedToUpdate}
        />
      )}
    </div>
  );
}
