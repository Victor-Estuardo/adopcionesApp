import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import { FaRegImage } from "react-icons/fa";
import { LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import { Field } from "~/components/Form/Field";
import { ImageUploadField } from "~/components/Form/ImageUploadField";
import Input from "~/components/Input";
import { Select } from "~/components/Input/Select";
import { Textarea } from "~/components/Input/Textarea";
import { Modal } from "~/components/Modal/Modal";
import { DataEmptyState, DataErrorState } from "~/components/State/DataStates";
import { deleteCloudinaryImage } from "~/services/cloudinary/delete";
import {
  PROYECTO_FOTO_MAX_MB,
  PROYECTO_FOTO_MIME_TYPES,
} from "~/services/cloudinary/fileConstraints";
import { uploadProjectPhoto } from "~/services/cloudinary/upload";
import {
  AdminProject,
  createProyectoDb,
  createProyectoFotoDb,
  deleteProyectoFotosDb,
  getProyectoDb,
  listProyectosAdminDb,
  PROYECTO_FOTO_CATEGORIES,
  updateProyectoDb,
} from "~/services/db/project.service";
import { getSession } from "~/services/sessions/sessions.service";
import { PermissionSession } from "~/services/auth/login.service";
import { validatePermission } from "~/utils/common";
import { sanitizeLimit, sanitizeText } from "~/utils/sanitize";

const FOTO_ACCEPT = PROYECTO_FOTO_MIME_TYPES.join(",");

export const meta = () => {
  return [{ title: "PROYECTOS" }];
};

const PROYECTOS_MODULE_ID = 14;
const PROJECT_STATUSES = ["Activo", "Finalizado"] as const;
type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

/*==============================| Loader |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));

  const validateRequest = validatePermission(
    session,
    PROYECTOS_MODULE_ID,
    "Leer",
  );
  if (validateRequest) throw validateRequest;

  const permissions: PermissionSession[] = session.get("permissions") || [];
  const allowedToCreate = !!permissions.find(
    (p) => p.module_id === PROYECTOS_MODULE_ID && p.action === "Crear",
  );
  const allowedToUpdate = !!permissions.find(
    (p) => p.module_id === PROYECTOS_MODULE_ID && p.action === "Actualizar",
  );

  const res = await listProyectosAdminDb();
  if (!res.success) {
    return json({
      proyectos: [],
      errorMsg: "Ocurrió un error al cargar los proyectos",
      allowedToCreate,
      allowedToUpdate,
    });
  }
  return json({ proyectos: res.data, allowedToCreate, allowedToUpdate });
};

/*==============================| Action |==============================*/
/* Guarda/reemplaza/quita la foto de cada etapa. El public_id en Cloudinary es
   determinista por (proyecto, etapa), así que "reemplazar" pisa el asset y solo
   hay que rehacer la fila en la BD. */
async function saveProjectPhotos(
  proyectoId: number,
  formData: FormData,
  userId: number,
) {
  for (const { category, slug } of PROYECTO_FOTO_CATEGORIES) {
    const entry = formData.get(`photo-${slug}`);
    const file =
      entry && typeof entry !== "string" && entry.size > 0 ? entry : null;
    const remove = formData.get(`remove-${slug}`) === "true";

    if (file) {
      const uploadRes = await uploadProjectPhoto(file, proyectoId, slug);
      if (uploadRes.success) {
        await deleteProyectoFotosDb({ proyecto_id: proyectoId, category });
        await createProyectoFotoDb({
          proyecto_id: proyectoId,
          url: uploadRes.data.secure_url,
          category,
          creator_id: userId,
          updater_id: userId,
        });
      }
    } else if (remove) {
      await deleteProyectoFotosDb({ proyecto_id: proyectoId, category });
      await deleteCloudinaryImage(`proyecto/${proyectoId}/${slug}`);
    }
  }
}

export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const userId = Number(session.get("dbUserId"));
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "create" && intent !== "update") {
    return json({ errorMsg: "Acción no reconocida." }, { status: 400 });
  }

  const validateRequest = validatePermission(
    session,
    PROYECTOS_MODULE_ID,
    intent === "create" ? "Crear" : "Actualizar",
  );
  if (validateRequest) throw validateRequest;

  if (!userId) {
    return json({ errorMsg: "No se pudo identificar al usuario." });
  }

  // ── Campos ────────────────────────────────────────────────────────
  const name = sanitizeText(formData.get("name"), 150);
  if (!name) {
    return json({ errorMsg: "El nombre del proyecto es obligatorio." });
  }

  const description = sanitizeText(formData.get("description"), 2000);
  if (!description) {
    return json({ errorMsg: "La descripción del proyecto es obligatoria." });
  }

  const goal = sanitizeText(formData.get("goal"), 150) || null;

  // Avance: opcional, entero 0–100.
  const progressRaw = formData.get("progress");
  const progress =
    progressRaw === null || progressRaw === ""
      ? null
      : sanitizeLimit(progressRaw, { min: 0, max: 100 }) ?? null;

  const statusRaw = formData.get("status");
  const status = PROJECT_STATUSES.includes(statusRaw as ProjectStatusValue)
    ? (statusRaw as ProjectStatusValue)
    : null;
  if (!status) {
    return json({ errorMsg: "Selecciona un estado válido para el proyecto." });
  }

  // Validación de las fotos ANTES de tocar la base.
  for (const { slug, label } of PROYECTO_FOTO_CATEGORIES) {
    const entry = formData.get(`photo-${slug}`);
    if (entry && typeof entry !== "string" && entry.size > 0) {
      if (!PROYECTO_FOTO_MIME_TYPES.includes(entry.type)) {
        return json({
          errorMsg: `La foto "${label}" debe ser JPG, PNG o WEBP.`,
        });
      }
      if (entry.size > PROYECTO_FOTO_MAX_MB * 1024 * 1024) {
        return json({
          errorMsg: `La foto "${label}" no debe superar los ${PROYECTO_FOTO_MAX_MB}MB.`,
        });
      }
    }
  }

  const now = new Date();

  if (intent === "create") {
    const createRes = await createProyectoDb({
      name,
      description,
      goal,
      progress,
      status,
      creator_id: userId,
      updater_id: userId,
    });
    if (!createRes.success) {
      return json({ errorMsg: "Ocurrió un error al crear el proyecto." });
    }

    await saveProjectPhotos(createRes.data.id, formData, userId);
    return json({ created_proyecto: true });
  }

  // ── intent === "update" ───────────────────────────────────────────
  const id = Number(formData.get("id"));
  if (!id) {
    return json({ errorMsg: "Falta identificar el proyecto." });
  }

  const currentRes = await getProyectoDb({ id });
  if (!currentRes.success || !currentRes.data) {
    return json({ errorMsg: "No se encontró el proyecto." });
  }

  const updateRes = await updateProyectoDb(id, {
    name,
    description,
    goal,
    progress,
    status,
    updater_id: userId,
    update_date: now,
  });
  if (!updateRes.success) {
    return json({ errorMsg: "Ocurrió un error al actualizar el proyecto." });
  }

  await saveProjectPhotos(id, formData, userId);
  return json({ updated_proyecto: true });
};

/*==============================| Component |==============================*/
export default function AdminProyectosPage() {
  const { proyectos, errorMsg, allowedToCreate, allowedToUpdate } =
    useLoaderData<{
      proyectos: AdminProject[];
      errorMsg?: string;
      allowedToCreate: boolean;
      allowedToUpdate: boolean;
    }>();

  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<AdminProject | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const visible = proyectos.filter(
    (p) => !statusFilter || p.status === statusFilter,
  );

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (project: AdminProject) => {
    setEditing(project);
    setModalOpen(true);
  };

  return (
    <div className="flex h-full w-full flex-col gap-y-5 overflow-y-auto p-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="md:hidden text-xl font-bold text-gray-800">
            Proyectos
          </h1>
          <p className="text-sm text-gray-400">
            Gestiona los proyectos financiados con material o trabajo donado, y
            su galería de antes/durante/después.
          </p>
        </div>
        {allowedToCreate && (
          <PrimaryButton
            label="Nuevo proyecto"
            Icon={LuPlus}
            onClick={openCreate}
          />
        )}
      </div>

      {/* ── Filtro ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filtrar por estado"
          className="w-full sm:w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todo estado</option>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <span className="ml-auto whitespace-nowrap text-sm text-gray-400">
          {visible.length} {visible.length === 1 ? "proyecto" : "proyectos"}
        </span>
      </div>

      {/* ── Grid ── */}
      {errorMsg ? (
        <DataErrorState message="No pudimos cargar los proyectos. Revisa tu conexión y vuelve a intentarlo." />
      ) : visible.length === 0 ? (
        statusFilter ? (
          <DataEmptyState
            title="Ningún proyecto con ese estado"
            message="Cambia el filtro de estado para ver más proyectos."
          />
        ) : (
          <DataEmptyState
            title="Todavía no hay proyectos"
            message="Crea el primer proyecto financiado con material o trabajo donado y documenta su avance con fotos de antes, durante y después."
            action={
              allowedToCreate
                ? { label: "Crear proyecto", onClick: openCreate }
                : undefined
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <li
              key={project.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              {/* Previsualización antes / después */}
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                {(
                  [
                    ["Antes", project.photos.antes],
                    ["Después", project.photos.despues],
                  ] as const
                ).map(([label, photo]) => (
                  <div
                    key={label}
                    className="relative flex h-24 items-center justify-center bg-gray-50"
                  >
                    <span className="absolute left-1.5 top-1.5 z-10 rounded bg-gray-900/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      {label}
                    </span>
                    {photo ? (
                      <img
                        src={photo.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FaRegImage
                        className="h-5 w-5 text-gray-300"
                        aria-hidden
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-800">
                    {project.name}
                  </h2>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="line-clamp-2 text-sm text-gray-500">
                  {project.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <span className="truncate text-xs text-gray-400">
                    {project.sponsors.length > 0
                      ? project.sponsors.join(" · ")
                      : "Sin patrocinadores"}
                  </span>
                  {allowedToUpdate && (
                    <button
                      type="button"
                      onClick={() => openEdit(project)}
                      className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
                    >
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <ProjectModal onClose={() => setModalOpen(false)} project={editing} />
      )}
    </div>
  );
}

/*==============================| Subcomponentes |==============================*/
function ProjectStatusBadge({ status }: { status: "Activo" | "Finalizado" }) {
  const isActive = status === "Activo";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? "bg-blue-meraki/10 text-blue-meraki"
          : "bg-medium-turquoise-meraki/10 text-medium-turquoise-meraki"
      }`}
    >
      {status}
    </span>
  );
}

/*==============================| Modal de creación / edición |==============================*/
type ProjectErrors = {
  name?: string;
  description?: string;
  progress?: string;
};

function ProjectModal({
  onClose,
  project,
}: {
  onClose: () => void;
  project: AdminProject | null;
}) {
  const isEditing = project != null;
  const formId = useId();
  const fetcher = useFetcher<{
    created_proyecto?: boolean;
    updated_proyecto?: boolean;
    errorMsg?: string;
  }>();
  const isSubmitting = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [goal, setGoal] = useState(project?.goal ?? "");
  const [progress, setProgress] = useState(
    project?.progress != null ? String(project.progress) : "",
  );
  const [status, setStatus] = useState<"Activo" | "Finalizado">(
    project?.status ?? "Activo",
  );
  const [errors, setErrors] = useState<ProjectErrors>({});

  const serverError = fetcher.data?.errorMsg;

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current) {
      wasSubmitting.current = false;
      if (fetcher.data?.created_proyecto || fetcher.data?.updated_proyecto) {
        toast.success(
          fetcher.data.created_proyecto
            ? "Proyecto creado."
            : "Cambios guardados.",
        );
        onClose();
      }
      // El error del servidor (incluye errores de foto por etapa) se muestra
      // dentro del formulario, no como toast: queda visible al corregir.
    }
  }, [fetcher.state]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: ProjectErrors = {};
    if (!name.trim()) next.name = "El nombre del proyecto es obligatorio.";
    if (!description.trim())
      next.description = "La descripción es obligatoria.";
    if (progress !== "") {
      const value = Number(progress);
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        next.progress = "El avance debe ser un número entre 0 y 100.";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    fetcher.submit(new FormData(event.currentTarget), {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  const footer = (
    <>
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
        {isSubmitting
          ? "Guardando…"
          : isEditing
          ? "Guardar cambios"
          : "Guardar proyecto"}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      footer={footer}
      title={isEditing ? "Editar proyecto" : "Nuevo proyecto"}
    >
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
        {isEditing && <input type="hidden" name="id" value={project!.id} />}

        {serverError && (
          <p
            role="alert"
            className="rounded-lg border border-pink-meraki/30 bg-pink-meraki/5 px-3 py-2 text-sm text-pink-meraki"
          >
            {serverError}
          </p>
        )}

        <Field id="proj-name" label="Nombre del proyecto" error={errors.name}>
          <Input
            id="proj-name"
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: undefined }));
            }}
            placeholder="Ej. Reconstrucción del albergue"
            maxLength={150}
          />
        </Field>

        <Field
          id="proj-description"
          label="Descripción"
          error={errors.description}
        >
          <Textarea
            id="proj-description"
            name="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((p) => ({ ...p, description: undefined }));
            }}
            rows={3}
            placeholder="¿Qué se va a hacer y por qué?"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="proj-status" label="Estado">
            <Select
              id="proj-status"
              name="status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "Activo" | "Finalizado")
              }
              className="w-full"
            >
              {PROJECT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="proj-goal" label="Meta" optional>
            <Input
              id="proj-goal"
              name="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ej. Q8,000 en materiales"
              maxLength={150}
            />
          </Field>
        </div>

        <Field
          id="proj-progress"
          label="Avance (%)"
          optional
          hint="Porcentaje que se muestra en la barra de la vista pública."
          error={errors.progress}
        >
          <Input
            id="proj-progress"
            name="progress"
            type="number"
            min="0"
            max="100"
            step="1"
            value={progress}
            onChange={(e) => {
              setProgress(e.target.value);
              setErrors((p) => ({ ...p, progress: undefined }));
            }}
            placeholder="Ej. 65"
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-700">
            Fotografías del proyecto
          </legend>
          <p className="text-xs text-gray-400">
            Una foto por etapa. Se previsualiza antes de guardar.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PROYECTO_FOTO_CATEGORIES.map(({ slug, label }) => (
              <ImageUploadField
                key={slug}
                name={`photo-${slug}`}
                removeName={`remove-${slug}`}
                label={label}
                optional
                accept={FOTO_ACCEPT}
                maxMB={PROYECTO_FOTO_MAX_MB}
                hint="Subir foto"
                currentUrl={
                  project?.photos[slug as keyof AdminProject["photos"]]?.url
                }
              />
            ))}
          </div>
        </fieldset>
      </fetcher.Form>
    </Modal>
  );
}
