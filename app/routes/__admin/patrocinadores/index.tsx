import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import { Field } from "~/components/Form/Field";
import { ImageUploadField } from "~/components/Form/ImageUploadField";
import Input from "~/components/Input";
import { Modal } from "~/components/Modal/Modal";
import { DataEmptyState, DataErrorState } from "~/components/State/DataStates";
import {
  PATROCINADOR_LOGO_MAX_MB,
  PATROCINADOR_LOGO_MIME_TYPES,
} from "~/services/cloudinary/fileConstraints";
import { uploadSponsorLogo } from "~/services/cloudinary/upload";
import {
  AdminSponsor,
  createSponsorDb,
  getSponsorDb,
  listSponsorAdminDb,
  updateSponsorDb,
} from "~/services/db/sponsor.service";
import { getSession } from "~/services/sessions/sessions.service";
import { PermissionSession } from "~/services/auth/login.service";
import { getInitials, validatePermission } from "~/utils/common";
import { sanitizeText, sanitizeWebsite } from "~/utils/sanitize";

const LOGO_ACCEPT = PATROCINADOR_LOGO_MIME_TYPES.join(",");

/* Chequeo de forma de URL para feedback inmediato en el cliente (con o sin
   esquema). El servidor vuelve a validar y normaliza con `sanitizeWebsite`. */
const WEBSITE_RE =
  /^(https?:\/\/)?([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}(:\d{2,5})?(\/\S*)?$/i;

export const meta = () => {
  return [{ title: "PATROCINADORES" }];
};

const PATROCINADORES_MODULE_ID = 13;

/*==============================| Loader |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));

  const validateRequest = validatePermission(
    session,
    PATROCINADORES_MODULE_ID,
    "Leer",
  );
  if (validateRequest) throw validateRequest;

  const permissions: PermissionSession[] = session.get("permissions") || [];
  const allowedToCreate = !!permissions.find(
    (p) => p.module_id === PATROCINADORES_MODULE_ID && p.action === "Crear",
  );
  const allowedToUpdate = !!permissions.find(
    (p) => p.module_id === PATROCINADORES_MODULE_ID && p.action === "Actualizar",
  );

  const res = await listSponsorAdminDb();
  if (!res.success) {
    return json({
      patrocinadores: [],
      errorMsg: "Ocurrió un error al cargar los patrocinadores",
      allowedToCreate,
      allowedToUpdate,
    });
  }
  return json({ patrocinadores: res.data, allowedToCreate, allowedToUpdate });
};

/*==============================| Action |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const userId = Number(session.get("dbUserId"));

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "create" && intent !== "update") {
    return json({ errorMsg: "Acción no reconocida." }, { status: 400 });
  }

  const validateRequest = validatePermission(
    session,
    PATROCINADORES_MODULE_ID,
    intent === "create" ? "Crear" : "Actualizar",
  );
  if (validateRequest) throw validateRequest;

  if (!userId) {
    return json({ errorMsg: "No se pudo identificar al usuario." });
  }

  // ── Campos comunes ─────────────────────────────────────────────────
  const name = sanitizeText(formData.get("name"), 100);
  if (!name) {
    return json({ errorMsg: "El nombre del patrocinador es obligatorio." });
  }

  const contact = sanitizeText(formData.get("contact"), 150) || null;

  // Sitio web opcional; si viene algo, debe tener forma de URL válida.
  let website: string | null = null;
  const rawWebsite = sanitizeText(formData.get("website"), 160);
  if (rawWebsite) {
    website = sanitizeWebsite(rawWebsite);
    if (!website) {
      return json({
        errorMsg: "El sitio web no tiene un formato válido (ej. empresa.com).",
      });
    }
  }

  // Logotipo opcional: se valida tipo y tamaño ANTES de tocar la base.
  const logoEntry = formData.get("logo");
  const logo =
    logoEntry && typeof logoEntry !== "string" && logoEntry.size > 0
      ? logoEntry
      : null;
  if (logo) {
    if (!PATROCINADOR_LOGO_MIME_TYPES.includes(logo.type)) {
      return json({ errorMsg: "El logotipo debe ser PNG, SVG, WEBP o JPG." });
    }
    if (logo.size > PATROCINADOR_LOGO_MAX_MB * 1024 * 1024) {
      return json({
        errorMsg: `El logotipo no debe superar los ${PATROCINADOR_LOGO_MAX_MB}MB.`,
      });
    }
  }

  const now = new Date();

  if (intent === "create") {
    const createRes = await createSponsorDb({
      name,
      website,
      contact,
      active: true,
      creator_id: userId,
      updater_id: userId,
    });
    if (!createRes.success) {
      return json({
        errorMsg: "Ocurrió un error al registrar el patrocinador.",
      });
    }

    // Se sube el logo con el id ya conocido; si falla, el patrocinador queda
    // igual registrado (mismo criterio que mascotas con sus imágenes).
    if (logo) {
      const uploadRes = await uploadSponsorLogo(logo, createRes.data.id);
      if (uploadRes.success) {
        await updateSponsorDb(createRes.data.id, {
          logo_url: uploadRes.data.secure_url,
          updater_id: userId,
          update_date: now,
        });
      }
    }

    return json({ created_patrocinador: true });
  }

  // ── intent === "update" ────────────────────────────────────────────
  const id = Number(formData.get("id"));
  if (!id) {
    return json({ errorMsg: "Falta identificar el patrocinador." });
  }

  const currentRes = await getSponsorDb({ id });
  if (!currentRes.success || !currentRes.data) {
    return json({ errorMsg: "No se encontró el patrocinador." });
  }

  // `active` llega explícito para soportar dar de baja / reactivar;
  // si no viene, se conserva el estado actual.
  const activeRaw = formData.get("active");
  const active =
    activeRaw === "true"
      ? true
      : activeRaw === "false"
      ? false
      : currentRes.data.active;

  const updateRes = await updateSponsorDb(id, {
    name,
    website,
    contact,
    active,
    updater_id: userId,
    update_date: now,
  });
  if (!updateRes.success) {
    return json({
      errorMsg: "Ocurrió un error al actualizar el patrocinador.",
    });
  }

  if (logo) {
    const uploadRes = await uploadSponsorLogo(logo, id);
    if (uploadRes.success) {
      await updateSponsorDb(id, {
        logo_url: uploadRes.data.secure_url,
        updater_id: userId,
        update_date: now,
      });
    }
  }

  return json({ updated_patrocinador: true });
};

/*==============================| Component |==============================*/
export default function () {
  const { patrocinadores, errorMsg, allowedToCreate, allowedToUpdate } =
    useLoaderData<{
      patrocinadores: AdminSponsor[];
      errorMsg?: string;
      allowedToCreate: boolean;
      allowedToUpdate: boolean;
    }>();

  const [editing, setEditing] = useState<AdminSponsor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (patrocinador: AdminSponsor) => {
    setEditing(patrocinador);
    setModalOpen(true);
  };

  return (
    <div className="flex h-full w-full flex-col gap-y-5 overflow-y-auto p-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="md:hidden text-xl font-bold text-gray-800">
            Patrocinadores
          </h1>
          <p className="text-sm text-gray-400">
            Gestiona las empresas y negocios que apoyan a la asociación.
          </p>
        </div>
        {allowedToCreate && (
          <PrimaryButton
            label="Nuevo patrocinador"
            Icon={LuPlus}
            onClick={openCreate}
          />
        )}
      </div>

      {/* ── Grid ── */}
      {errorMsg ? (
        <DataErrorState message="No pudimos cargar los patrocinadores. Revisa tu conexión y vuelve a intentarlo." />
      ) : patrocinadores.length === 0 ? (
        <DataEmptyState
          title="Todavía no hay patrocinadores registrados"
          message="Registra la primera empresa o negocio que apoya a la asociación; aparecerá aquí y en la vista pública de donaciones."
          action={
            allowedToCreate
              ? { label: "Registrar patrocinador", onClick: openCreate }
              : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patrocinadores.map((patrocinador) => (
            <li
              key={patrocinador.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-sm font-bold text-gray-500"
                  aria-hidden
                >
                  {patrocinador.logo_url ? (
                    <img
                      src={patrocinador.logo_url}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    getInitials(patrocinador.name)
                  )}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    patrocinador.active
                      ? "bg-teal-50 text-teal-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {patrocinador.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="min-w-0">
                <h2 className="truncate font-semibold text-gray-800">
                  {patrocinador.name}
                </h2>
                <p className="truncate text-xs text-gray-400">
                  {patrocinador.website ?? "Sin sitio web"}
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-400">
                  {patrocinador.projectsCount}{" "}
                  {patrocinador.projectsCount === 1
                    ? "proyecto apoyado"
                    : "proyectos apoyados"}
                </span>
                {allowedToUpdate && (
                  <button
                    type="button"
                    onClick={() => openEdit(patrocinador)}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
                  >
                    Editar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <PatrocinadorModal
          onClose={() => setModalOpen(false)}
          patrocinador={editing}
        />
      )}
    </div>
  );
}

/*==============================| Modal de creación / edición |==============================*/
function PatrocinadorModal({
  onClose,
  patrocinador,
}: {
  onClose: () => void;
  patrocinador: AdminSponsor | null;
}) {
  const isEditing = patrocinador != null;
  const isActive = patrocinador?.active ?? true;
  const formId = useId();
  const fetcher = useFetcher<{
    created_patrocinador?: boolean;
    updated_patrocinador?: boolean;
    errorMsg?: string;
  }>();
  const isSubmitting = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  const [mode, setMode] = useState<"form" | "confirmToggle">("form");
  const [name, setName] = useState(patrocinador?.name ?? "");
  const [website, setWebsite] = useState(patrocinador?.website ?? "");
  const [contact, setContact] = useState(patrocinador?.contact ?? "");
  const [errors, setErrors] = useState<{ name?: string; website?: string }>({});

  const serverError = fetcher.data?.errorMsg;

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (
        fetcher.data?.created_patrocinador ||
        fetcher.data?.updated_patrocinador
      ) {
        toast.success(
          fetcher.data.created_patrocinador
            ? "Patrocinador registrado."
            : "Cambios guardados.",
        );
        onClose();
      }
      // El error del servidor se muestra dentro del formulario (ver más abajo),
      // no como toast: así queda visible mientras el usuario lo corrige.
    }
  }, [fetcher.state]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: { name?: string; website?: string } = {};
    if (!name.trim()) {
      next.name = "El nombre de la empresa es obligatorio.";
    }
    if (website.trim() && !WEBSITE_RE.test(website.trim())) {
      next.website =
        "El sitio web no tiene un formato válido (ej. empresa.com).";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    fetcher.submit(new FormData(event.currentTarget), {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  const submitToggle = () => {
    fetcher.submit(
      {
        intent: "update",
        id: String(patrocinador!.id),
        name: patrocinador!.name,
        website: patrocinador!.website ?? "",
        contact: patrocinador!.contact ?? "",
        active: String(!isActive),
      },
      { method: "post" },
    );
  };

  const cancelButton = (
    <button
      type="button"
      onClick={mode === "form" ? onClose : () => setMode("form")}
      disabled={isSubmitting}
      className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
    >
      Cancelar
    </button>
  );

  const footer =
    mode === "form" ? (
      <>
        {cancelButton}
        <button
          type="submit"
          form={formId}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-medium-turquoise-meraki py-2 text-sm font-semibold text-white hover:bg-medium-turquoise-meraki/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Guardando…"
            : isEditing
            ? "Guardar cambios"
            : "Guardar patrocinador"}
        </button>
      </>
    ) : (
      <>
        {cancelButton}
        <button
          type="button"
          onClick={submitToggle}
          disabled={isSubmitting}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 ${
            isActive
              ? "bg-pink-meraki hover:bg-pink-meraki/90 focus-visible:ring-pink-meraki/40"
              : "bg-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/90 focus-visible:ring-medium-turquoise-meraki/40"
          }`}
        >
          {isSubmitting ? "Guardando…" : isActive ? "Dar de baja" : "Reactivar"}
        </button>
      </>
    );

  return (
    <Modal
      open
      onClose={onClose}
      footer={footer}
      title={
        mode === "confirmToggle"
          ? isActive
            ? "Dar de baja patrocinador"
            : "Reactivar patrocinador"
          : isEditing
          ? "Editar patrocinador"
          : "Nuevo patrocinador"
      }
    >
      {mode === "form" ? (
        <fetcher.Form
          id={formId}
          method="post"
          encType="multipart/form-data"
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
        >
          <input
            type="hidden"
            name="intent"
            value={isEditing ? "update" : "create"}
          />
          {isEditing && (
            <input type="hidden" name="id" value={patrocinador!.id} />
          )}

          {serverError && (
            <p
              role="alert"
              className="rounded-lg border border-pink-meraki/30 bg-pink-meraki/5 px-3 py-2 text-sm text-pink-meraki"
            >
              {serverError}
            </p>
          )}

          <Field id="pat-name" label="Nombre de la empresa" error={errors.name}>
            <Input
              id="pat-name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder="Ej. Constructora Alfa"
              maxLength={100}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>

          <ImageUploadField
            name="logo"
            label="Logotipo"
            optional
            accept={LOGO_ACCEPT}
            maxMB={PATROCINADOR_LOGO_MAX_MB}
            hint="PNG, SVG, WEBP o JPG"
            currentUrl={patrocinador?.logo_url}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="pat-website"
              label="Sitio web"
              optional
              error={errors.website}
            >
              <Input
                id="pat-website"
                name="website"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  setErrors((p) => ({ ...p, website: undefined }));
                }}
                placeholder="empresa.com"
                maxLength={150}
                aria-invalid={Boolean(errors.website)}
              />
            </Field>
            <Field id="pat-contact" label="Contacto" optional>
              <Input
                id="pat-contact"
                name="contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Nombre o correo"
                maxLength={150}
              />
            </Field>
          </div>

          {isEditing && (
            <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <span className="text-xs text-gray-500">
                {isActive
                  ? "Aparece en la vista pública de patrocinadores."
                  : "No aparece en la vista pública."}
              </span>
              <button
                type="button"
                onClick={() => setMode("confirmToggle")}
                className="shrink-0 text-xs font-semibold text-pink-meraki hover:underline"
              >
                {isActive ? "Dar de baja" : "Reactivar"}
              </button>
            </div>
          )}
        </fetcher.Form>
      ) : (
        <p className="text-sm text-gray-600">
          {isActive
            ? `¿Dar de baja a “${patrocinador?.name}”? Dejará de aparecer en la vista pública de patrocinadores. Podrás reactivarlo después.`
            : `¿Reactivar a “${patrocinador?.name}”? Volverá a aparecer en la vista pública.`}
        </p>
      )}
    </Modal>
  );
}
