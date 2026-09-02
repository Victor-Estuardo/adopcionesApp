import { donation_type_donation, Prisma } from "@prisma/client";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { FaTimes } from "react-icons/fa";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import { DonationCard } from "~/components/Card/DonationCard";
import { Select } from "~/components/Input/Select";
import Pagination from "~/components/Pagination";
import { DonationPanel } from "~/components/Panel/DonationPanel";
import { PermissionSession } from "~/services/auth/login.service";
import {
  countDonationsDb,
  createDonationDb,
  DonationWithRelations,
  listDonationsAdminDb,
  updateDonationDb,
} from "~/services/db/donation.service";
import { listDonationBankAccountDb } from "~/services/db/donationBankAccount.service";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";

export const meta = () => {
  return [{ title: "DONACIONES" }];
};

const DONATION_MODULE_ID = 13;

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // Verificamos que tenga permiso de Leer "donaciones";
  //const validateRequest = validatePermission(session, DONATION_MODULE_ID, "Leer");
  //if (validateRequest) throw validateRequest;

  // Obtenemos los parametros de la url
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Información de paginación
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");

  // Información de filtros
  const type = searchParams.get("type") || undefined;
  const status = searchParams.get("status") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  // Filtro para la llamada de lista de donaciones
  const whereListDonations: Prisma.donationWhereInput = {
    donation_type: type ? (type as donation_type_donation) : undefined,
    status: status || undefined,
    submitted_at: {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(`${to}T23:59:59`) : undefined,
    },
  };

  const [donationsRes, totalDonationsRes, bankAccountsRes] = await Promise.all([
    listDonationsAdminDb(whereListDonations, (page - 1) * limit, limit),
    countDonationsDb(whereListDonations),
    listDonationBankAccountDb({ active: true }),
  ]);

  if (
    !donationsRes.success ||
    !totalDonationsRes.success ||
    !bankAccountsRes.success
  ) {
    return json({ errorMsg: "Ocurrió un error al cargar la página" });
  }

  // Obtenemos los permisos
  const permissions: PermissionSession[] = session.get("permissions") || [];

  return json({
    donations: donationsRes.data,
    totalDonations: totalDonationsRes.data,
    totalPages: Math.ceil(totalDonationsRes.data / limit),
    bankAccounts: bankAccountsRes.data,
    allowedToCreate: true /*!!permissions.find(
      (p) => p.module_id === DONATION_MODULE_ID && p.action === "Crear",
    )*/,
    allowedToUpdate: true /*!!permissions.find(
      (p) => p.module_id === DONATION_MODULE_ID && p.action === "Actualizar",
    )*/,
  });
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const userId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "confirm") {
    /*const validateRequest = validatePermission(
      session,
      DONATION_MODULE_ID,
      "Actualizar",
    );
    if (validateRequest) throw validateRequest;*/

    const id = String(formData.get("id"));

    const updateRes = await updateDonationDb(id, {
      status: "confirmada",
      reviewed_by: userId,
      updated_at: new Date(),
    });

    if (!updateRes.success) {
      return json({ errorMsg: "Ocurrió un error al confirmar la donación" });
    }

    return json({ confirmed: true });
  }

  if (intent === "reject") {
    const validateRequest = validatePermission(
      session,
      DONATION_MODULE_ID,
      "Actualizar",
    );
    if (validateRequest) throw validateRequest;

    const id = String(formData.get("id"));
    const rejectionReason = String(
      formData.get("rejection_reason") || "",
    ).trim();

    if (!rejectionReason) {
      return json({ errorMsg: "Debes indicar un motivo de rechazo" });
    }

    const updateRes = await updateDonationDb(id, {
      status: "rechazada",
      rejection_reason: rejectionReason,
      reviewed_by: userId,
      updated_at: new Date(),
    });

    if (!updateRes.success) {
      return json({ errorMsg: "Ocurrió un error al rechazar la donación" });
    }

    return json({ rejected: true });
  }

  if (intent === "create-manual") {
    const validateRequest = validatePermission(
      session,
      DONATION_MODULE_ID,
      "Crear",
    );
    if (validateRequest) throw validateRequest;

    const donationType = formData
      .get("donation_type")
      ?.toString() as donation_type_donation;
    const amount = formData.get("amount")?.toString().trim();
    const itemDescription = formData.get("item_description")?.toString().trim();
    const bankAccountId = formData.get("bank_account_id")?.toString();
    const referenceNumber = formData
      .get("reference_number")
      ?.toString()
      .trim();
    const comment = formData.get("comment")?.toString().trim();
    const donorName = formData.get("donor_name")?.toString().trim();
    const donorEmail = formData.get("donor_email")?.toString().trim();
    const donorPhone = formData.get("donor_phone")?.toString().trim();
    const isPublic = formData.get("is_public") === "on";
    const isAnonymous = isPublic && formData.get("is_anonymous") === "on";

    if (donationType === "Monetaria" && (!amount || Number(amount) <= 0)) {
      return json({ errorMsg: "Indica un monto válido" });
    }

    if (donationType === "Especie" && !itemDescription) {
      return json({ errorMsg: "Describe los artículos donados" });
    }

    const createRes = await createDonationDb({
      donor_name: donorName || undefined,
      donor_email: donorEmail || undefined,
      donor_phone: donorPhone || undefined,
      donation_type: donationType,
      amount: donationType === "Monetaria" ? Number(amount) : undefined,
      item_description:
        donationType === "Especie" ? itemDescription : undefined,
      bank_account_id: bankAccountId ? Number(bankAccountId) : undefined,
      reference_number: bankAccountId ? referenceNumber || undefined : undefined,
      comment: comment || undefined,
      is_public: isPublic,
      is_anonymous: isAnonymous,
      status: "confirmada",
      reviewed_by: userId,
      submitted_at: new Date(),
      updated_at: new Date(),
    });

    if (!createRes.success) {
      return json({ errorMsg: "Ocurrió un error al registrar la donación" });
    }

    return json({ created: true });
  }

  return json({ errorMsg: "Ocurrió un error al cargar la página" });
};

/*==============================| Component |==============================*/
export default function () {
  const {
    donations,
    totalDonations,
    totalPages,
    bankAccounts,
    allowedToCreate,
    allowedToUpdate,
  } = useLoaderData() as unknown as {
    donations: DonationWithRelations[];
    totalDonations: number;
    totalPages: number;
    bankAccounts: any[];
    allowedToCreate: boolean;
    allowedToUpdate: boolean;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const isProcessing = fetcher.state !== "idle";

  // Filtros
  const hasActiveFilters = Boolean(searchParams.toString());
  const page = Number(searchParams.get("page") || "1");

  // Banderas
  const [panelOpen, setPanelOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setProcessingId(null);
    }

    if (fetcher.data?.confirmed) {
      toast.success("Donación confirmada correctamente");
      setProcessingId(null);
    }

    if (fetcher.data?.rejected) {
      toast.success("Donación rechazada correctamente");
      setProcessingId(null);
      setRejectingId(null);
      setRejectionReason("");
    }

    if (fetcher.data?.created) {
      toast.success("Donación registrada correctamente");
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  function updateParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { preventScrollReset: true },
    );
  }

  function goToPage(next: number) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("page", String(next));
        return params;
      },
      { preventScrollReset: false },
    );
  }

  function handleConfirm(id: string) {
    setProcessingId(id);
    const fd = new FormData();
    fd.set("intent", "confirm");
    fd.set("id", id);
    fetcher.submit(fd, { method: "post" });
  }

  function handleOpenReject(id: string) {
    setRejectingId(id);
    setRejectionReason("");
  }

  function handleConfirmReject() {
    if (!rejectionReason.trim()) {
      toast.error("Debes indicar un motivo de rechazo");
      return;
    }
    if (!rejectingId) return;

    setProcessingId(rejectingId);
    const fd = new FormData();
    fd.set("intent", "reject");
    fd.set("id", rejectingId);
    fd.set("rejection_reason", rejectionReason);
    fetcher.submit(fd, { method: "post" });
  }

  // Si esta vacia la lista
  function EmptyState({ hasFilters }: { hasFilters: boolean }) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E4E0D6] py-16 text-center">
        <p className="font-medium text-[#1F1D1A]">
          {hasFilters
            ? "Ningún resultado con estos filtros"
            : "Todavía no hay donaciones registradas"}
        </p>
        <p className="max-w-xs text-sm text-[#8A8577]">
          {hasFilters
            ? "Ajusta o limpia los filtros para ver más resultados."
            : "Las donaciones registradas desde /donacion aparecerán aquí."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-6 md:gap-3">
        <h1 className="order-1 md:hidden text-xl font-bold">Donaciones</h1>
        <h2 className="hidden md:block order-3 md:order-1 text-gray-400">
          Gestiona las donaciones registradas por adoptantes y donantes.
        </h2>
        {allowedToCreate && (
          <PrimaryButton
            className="order-2 md:order-2"
            label="Registrar donación manual"
            Icon={LuPlus}
            onClick={() => setPanelOpen(true)}
          />
        )}
      </div>

      <div className="flex flex-col gap-6 md:gap-3 pb-3 md:flex-row md:items-center">
        <div className="grid grid-cols-2 md:flex md:items-center gap-x-6 gap-y-4">
          <Select
            id="type"
            name="type"
            className="w-full md:w-auto"
            value={searchParams.get("type") ?? ""}
            onChange={(e) => updateParam("type", e.target.value)}
          >
            <option value="">Todo tipo</option>
            <option value="Monetaria">Monetaria</option>
            <option value="Especie">En especie</option>
          </Select>
          <Select
            id="status"
            name="status"
            className="w-full md:w-auto"
            value={searchParams.get("status") ?? ""}
            onChange={(e) => updateParam("status", e.target.value)}
          >
            <option value="">Todo estado</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="rechazada">Rechazada</option>
          </Select>
          <input
            type="date"
            value={searchParams.get("from") ?? ""}
            onChange={(e) => updateParam("from", e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600"
          />
          <input
            type="date"
            value={searchParams.get("to") ?? ""}
            onChange={(e) => updateParam("to", e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600"
          />
          {hasActiveFilters && (
            <div className="md:ml-auto flex justify-center items-center">
              <button
                className="text-sm px-3 py-1 text-emerald-600 hover:text-emerald-700"
                onClick={() =>
                  setSearchParams({}, { preventScrollReset: true })
                }
              >
                Limpiar
              </button>
            </div>
          )}
          <span className="col-span-2 px-1 md:px-0 text-sm text-gray-400 whitespace-nowrap">
            {totalDonations} {totalDonations === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onChangePage={goToPage}
      />

      {donations.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} />
      ) : (
        <div className="flex flex-col gap-3">
          {donations.map((donation) => (
            <DonationCard
              key={donation.id}
              donation={donation}
              allowedToUpdate={allowedToUpdate}
              isProcessing={isProcessing && processingId === donation.id}
              onConfirm={handleConfirm}
              onReject={handleOpenReject}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onChangePage={goToPage}
      />

      <DonationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        bankAccounts={bankAccounts}
      />

      {/* ── Modal de rechazo ── */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                Rechazar donación
              </h3>
              <button
                onClick={() => setRejectingId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Indica el motivo del rechazo. Este texto es de uso interno.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Ej. No se pudo verificar el depósito..."
              className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F2768C]/30 resize-none"
            />

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                disabled={isProcessing || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 bg-[#F2768C] hover:bg-[#F2768C]/90"
              >
                {isProcessing ? "Procesando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
