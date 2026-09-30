import type { story_category, story_status } from "@prisma/client";
import {
  ActionArgs,
  json,
  LoaderArgs,
  SerializeFrom,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import SearchInput from "~/components/Input/SearchInput";
import { Select } from "~/components/Input/Select";
import Pagination from "~/components/Pagination";
import {
  StoryPanel,
  StoryStatusBadge,
} from "~/components/Panel/StoryPanel";
import { DataEmptyState, DataErrorState } from "~/components/State/DataStates";
import { config } from "~/config";
import { PermissionSession } from "~/services/auth/login.service";
import { deleteCloudinaryImage } from "~/services/cloudinary/delete";
import { STORY_MAX_IMAGES } from "~/services/cloudinary/fileConstraints";
import { uploadStoryImage } from "~/services/cloudinary/upload";
import prisma, { handlePosiblePrismaError } from "~/services/db/prisma";
import {
  addStoryImagesDb,
  changeStoryStatusDb,
  createStoryDb,
  getStoryAdminDb,
  isStoryCategory,
  isStoryStatus,
  listStoriesAdminDb,
  parseStoryInput,
  removeStoryImageDb,
  reorderStoryImagesDb,
  setStoryCoverDb,
  StoryFieldErrors,
  StoryStatusAction,
  toPositiveInt,
  updateStoryDb,
  updateStoryImageAltDb,
} from "~/services/db/story.service";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";
import { storyImageUrl } from "~/utils/image";
import { sanitizeLimit, sanitizeText } from "~/utils/sanitize";
import {
  formatStoryDate,
  STORY_ALT_MAX,
  STORY_CATEGORY_CONFIG,
  STORY_CATEGORY_OPTIONS,
  STORY_STATUS_OPTIONS,
} from "~/utils/story-helpers";

export const meta = () => {
  return [{ title: "HISTORIAS" }];
};

const HISTORIAS_MODULE_ID = 18;

const INTENTS = [
  "create",
  "update",
  "publish",
  "unpublish",
  "archive",
  "restore",
  "add-images",
  "remove-image",
  "reorder-images",
  "set-cover",
] as const;
type Intent = (typeof INTENTS)[number];

const STATUS_INTENTS: Partial<Record<Intent, StoryStatusAction>> = {
  publish: "publish",
  unpublish: "unpublish",
  archive: "archive",
  restore: "restore",
};

export type StoryActionData =
  | { ok: true; intent: Intent; storyId?: number }
  | { ok: false; errorMsg: string; fieldErrors?: StoryFieldErrors };

function hasPermission(
  permissions: PermissionSession[],
  action: "Leer" | "Crear" | "Actualizar",
) {
  return permissions.some(
    (p) => p.module_id === HISTORIAS_MODULE_ID && p.action === action,
  );
}

/*==============================| Loader |==============================*/
export async function loader({ request }: LoaderArgs) {
  const session = await getSession(request.headers.get("cookie"));

  const validateRequest = validatePermission(
    session,
    HISTORIAS_MODULE_ID,
    "Leer",
  );
  if (validateRequest) throw validateRequest;

  const permissions: PermissionSession[] = session.get("permissions") || [];
  const allowedToCreate = hasPermission(permissions, "Crear");
  const allowedToUpdate = hasPermission(permissions, "Actualizar");

  // Filtros de la URL: valores inválidos se ignoran (SEG-03).
  const params = new URL(request.url).searchParams;
  const rawCategory = params.get("category");
  const rawStatus = params.get("status");
  const category: story_category | "" = isStoryCategory(rawCategory)
    ? rawCategory
    : "";
  const status: story_status | "" = isStoryStatus(rawStatus) ? rawStatus : "";
  const search = sanitizeText(params.get("search"), 100);
  const page = sanitizeLimit(params.get("page"), { min: 1, max: 10000 }) ?? 1;
  const editId = allowedToUpdate ? toPositiveInt(params.get("edit")) : null;

  const [listRes, editRes, petsRes] = await Promise.all([
    listStoriesAdminDb({ category, status, search }, { page }),
    editId ? getStoryAdminDb(editId) : Promise.resolve(null),
    allowedToCreate || allowedToUpdate
      ? handlePosiblePrismaError(() =>
          prisma.pet.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, status: true },
          }),
        )
      : Promise.resolve(null),
  ]);

  if (petsRes && !petsRes.success) {
    console.error("[historias] Error al listar mascotas:", petsRes.error);
  }

  return json({
    stories: listRes.success ? listRes.data.items : [],
    total: listRes.success ? listRes.data.total : 0,
    page: listRes.success ? listRes.data.page : 1,
    totalPages: listRes.success ? listRes.data.totalPages : 1,
    errorMsg: listRes.success ? null : "Ocurrió un error al cargar las historias",
    editingStory: editRes?.success ? editRes.data : null,
    editRequested: editId,
    pets: petsRes?.success ? petsRes.data : [],
    filters: { category, status, search },
    allowedToCreate,
    allowedToUpdate,
    cloudName: config.cloudinaryCloudName,
  });
}

export type HistoriasLoaderData = SerializeFrom<typeof loader>;

/*==============================| Action |==============================*/
export async function action({ request }: ActionArgs) {
  const session = await getSession(request.headers.get("cookie"));
  const permissions: PermissionSession[] = session.get("permissions") || [];

  // Sin ningún permiso de escritura no se procesa ni el cuerpo (que puede
  // traer archivos): 404, igual que validatePermission.
  if (
    !hasPermission(permissions, "Crear") &&
    !hasPermission(permissions, "Actualizar")
  ) {
    const denied = validatePermission(session, HISTORIAS_MODULE_ID, "Actualizar");
    if (denied) throw denied;
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "") as Intent;

  if (!INTENTS.includes(intent)) {
    return json<StoryActionData>(
      { ok: false, errorMsg: "Acción no reconocida." },
      { status: 400 },
    );
  }

  // Cada intent valida su propio permiso en el servidor (SEG-01).
  const denied = validatePermission(
    session,
    HISTORIAS_MODULE_ID,
    intent === "create" ? "Crear" : "Actualizar",
  );
  if (denied) throw denied;

  const userId = Number(session.get("dbUserId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    return json<StoryActionData>(
      { ok: false, errorMsg: "No se pudo identificar al usuario." },
      { status: 401 },
    );
  }

  const fail = (errorMsg: string, fieldErrors?: StoryFieldErrors) =>
    json<StoryActionData>({ ok: false, errorMsg, fieldErrors }, { status: 400 });
  const done = (storyId?: number) =>
    json<StoryActionData>({ ok: true, intent, storyId });

  const readStoryFields = () =>
    parseStoryInput({
      title: formData.get("title"),
      category: formData.get("category"),
      summary: formData.get("summary"),
      body: formData.get("body"),
      event_date: formData.get("event_date"),
      pet_id: formData.get("pet_id"),
      slug: formData.get("slug"),
    });

  // ── Crear ────────────────────────────────────────────────────────
  if (intent === "create") {
    const parsed = readStoryFields();
    if (!parsed.success) {
      return fail("Revisa los campos marcados.", parsed.fieldErrors);
    }
    const res = await createStoryDb(parsed.data, userId);
    if (!res.success) return fail(res.error);
    return done(res.data.id);
  }

  // A partir de aquí todas las acciones son sobre una historia existente.
  const storyId = toPositiveInt(formData.get("story_id"));
  if (!storyId) return fail("La historia no existe.");

  // ── Editar ───────────────────────────────────────────────────────
  if (intent === "update") {
    const parsed = readStoryFields();
    if (!parsed.success) {
      return fail("Revisa los campos marcados.", parsed.fieldErrors);
    }

    const imageIds = formData.getAll("image_id");
    const imageAlts = formData.getAll("image_alt");
    if (
      imageIds.length !== imageAlts.length ||
      imageIds.length > STORY_MAX_IMAGES
    ) {
      return fail("Datos de fotos no válidos.");
    }

    const res = await updateStoryDb(storyId, parsed.data, userId);
    if (!res.success) return fail(res.error);

    for (const [index, rawId] of imageIds.entries()) {
      const altRes = await updateStoryImageAltDb(
        storyId,
        toPositiveInt(rawId) ?? 0,
        sanitizeText(imageAlts[index], STORY_ALT_MAX),
        userId,
      );
      if (!altRes.success) return fail(altRes.error);
    }
    return done(storyId);
  }

  // ── Cambios de estado ────────────────────────────────────────────
  const statusAction = STATUS_INTENTS[intent];
  if (statusAction) {
    const res = await changeStoryStatusDb(storyId, statusAction, userId);
    if (!res.success) return fail(res.error);
    return done(storyId);
  }

  // ── Fotos: agregar ───────────────────────────────────────────────
  if (intent === "add-images") {
    const files = formData
      .getAll("images")
      .filter((entry): entry is File => typeof entry !== "string" && entry.size > 0);
    const alts = formData.getAll("alt_text");
    if (files.length === 0) return fail("No se recibieron fotos.");

    // Se comprueba el tope ANTES de subir, para no dejar archivos huérfanos.
    const current = await getStoryAdminDb(storyId);
    if (!current.success) return fail(current.error);
    if (!current.data) return fail("La historia no existe.");
    if (current.data.images.length + files.length > STORY_MAX_IMAGES) {
      return fail(
        `Una historia puede tener como máximo ${STORY_MAX_IMAGES} fotos (ya tiene ${current.data.images.length}).`,
      );
    }

    const uploaded: { path: string; alt_text: string }[] = [];
    const cleanup = () =>
      Promise.allSettled(uploaded.map((img) => deleteCloudinaryImage(img.path)));

    for (const [index, file] of files.entries()) {
      const up = await uploadStoryImage(file, storyId);
      if (!up.success) {
        await cleanup();
        return fail(up.error);
      }
      uploaded.push({
        path: up.data.public_id,
        alt_text: sanitizeText(alts[index], STORY_ALT_MAX),
      });
    }

    const res = await addStoryImagesDb(storyId, uploaded, userId);
    if (!res.success) {
      await cleanup();
      return fail(res.error);
    }
    return done(storyId);
  }

  // ── Fotos: eliminar ──────────────────────────────────────────────
  if (intent === "remove-image") {
    const imageId = toPositiveInt(formData.get("image_id"));
    if (!imageId) return fail("La foto no existe.");
    const res = await removeStoryImageDb(storyId, imageId, userId);
    if (!res.success) return fail(res.error);
    try {
      await deleteCloudinaryImage(res.data.path);
    } catch (error) {
      // La fila ya no existe; un asset huérfano no afecta al usuario.
      console.error("[historias] No se pudo borrar el asset:", error);
    }
    return done(storyId);
  }

  // ── Fotos: reordenar ─────────────────────────────────────────────
  if (intent === "reorder-images") {
    const ids = formData.getAll("image_ids");
    if (ids.length === 0 || ids.length > STORY_MAX_IMAGES) {
      return fail("Orden de fotos no válido.");
    }
    const res = await reorderStoryImagesDb(storyId, ids, userId);
    if (!res.success) return fail(res.error);
    return done(storyId);
  }

  // ── Fotos: portada ───────────────────────────────────────────────
  if (intent === "set-cover") {
    const imageId = toPositiveInt(formData.get("image_id"));
    if (!imageId) return fail("La foto no existe.");
    const res = await setStoryCoverDb(storyId, imageId, userId);
    if (!res.success) return fail(res.error);
    return done(storyId);
  }

  return fail("Acción no reconocida.");
}

/*==============================| Component |==============================*/
export default function HistoriasAdmin() {
  const {
    stories,
    total,
    page,
    totalPages,
    errorMsg,
    editingStory,
    editRequested,
    pets,
    filters,
    allowedToCreate,
    allowedToUpdate,
    cloudName,
  } = useLoaderData<typeof loader>();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const [q, setQ] = useState(filters.search);
  const [creating, setCreating] = useState(false);
  const firstRender = useRef(true);

  const hasActiveFilters = Boolean(
    filters.category || filters.status || filters.search,
  );

  /*------------------------------EFECTOS------------------------------*/
  // Debounce de la búsqueda antes de reflejarla en la URL.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q.trim()) next.set("search", q.trim());
          else next.delete("search");
          next.delete("page");
          return next;
        },
        { preventScrollReset: true },
      );
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Se pidió editar una historia que no existe (o ya no): se avisa y se
  // limpia el parámetro.
  useEffect(() => {
    if (navigation.state === "idle" && editRequested && !editingStory) {
      toast.error("No se encontró la historia.");
      closeEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.state, editRequested, editingStory]);

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
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("page", String(next));
      return params;
    });
  }

  function openCreate() {
    setCreating(true);
  }

  function openEdit(id: number) {
    setCreating(false);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("edit", String(id));
        return next;
      },
      { preventScrollReset: true },
    );
  }

  function closeEdit() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        return next;
      },
      { preventScrollReset: true },
    );
  }

  function clearFilters() {
    setQ("");
    setSearchParams({}, { preventScrollReset: true });
  }

  const thumb = (path: string | undefined) =>
    path ? storyImageUrl(cloudName, path, "storyThumb") : null;

  return (
    <div className="flex h-full w-full flex-col gap-y-5 overflow-y-auto p-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 md:hidden">
            Historias
          </h1>
          <p className="text-sm text-[#6B665C]">
            Publica finales felices y homenajes del Camino al arcoíris.
          </p>
        </div>
        {allowedToCreate && (
          <PrimaryButton
            label="Nueva historia"
            Icon={LuPlus}
            onClick={openCreate}
            className="min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A]/40"
          />
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          aria-label="Buscar historias por título"
          placeholder="Buscar por título..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          isClearable
          onClearable={() => setQ("")}
        />
        <div className="grid grid-cols-2 gap-3 md:flex md:items-center">
          <Select
            aria-label="Filtrar por categoría"
            className="w-full md:w-auto"
            value={filters.category}
            onChange={(e) => updateParam("category", e.target.value)}
          >
            <option value="">Toda categoría</option>
            {STORY_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por estado"
            className="w-full md:w-auto"
            value={filters.status}
            onChange={(e) => updateParam("status", e.target.value)}
          >
            <option value="">Todo estado</option>
            {STORY_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-[44px] self-start rounded-lg px-3 text-sm font-medium text-[#1F6F66] hover:bg-[#EAF7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/50 md:self-auto"
          >
            Limpiar filtros
          </button>
        )}
        <span
          className="text-sm text-[#6B665C] md:ml-auto"
          aria-live="polite"
        >
          {total} {total === 1 ? "historia" : "historias"}
        </span>
      </div>

      {/* ── Listado ── */}
      {errorMsg ? (
        <DataErrorState message="No pudimos cargar las historias. Revisa tu conexión y vuelve a intentarlo." />
      ) : stories.length === 0 ? (
        hasActiveFilters ? (
          <DataEmptyState
            title="Ninguna historia con estos filtros"
            message="Ajusta o limpia los filtros para ver más historias."
          />
        ) : (
          <DataEmptyState
            title="Todavía no hay historias"
            message="Cuenta los finales felices de las adopciones y honra a quienes partieron en el Camino al arcoíris."
            action={
              allowedToCreate
                ? { label: "Crear la primera historia", onClick: openCreate }
                : undefined
            }
          />
        )
      ) : (
        <div
          aria-busy={isLoading}
          className={`flex flex-col gap-4 transition-opacity ${
            isLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#EAE6DC] bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Listado de historias</caption>
              <thead className="bg-[#F4F2EC] text-xs uppercase tracking-wide text-[#57534E]">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Portada</span>
                  </th>
                  <th scope="col" className="px-4 py-3">Título</th>
                  <th scope="col" className="px-4 py-3">Categoría</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Publicación</th>
                  <th scope="col" className="px-4 py-3 text-center">Fotos</th>
                  {allowedToUpdate && (
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {stories.map((story) => {
                  const src = thumb(story.cover?.path);
                  return (
                    <tr key={story.id} className="align-middle">
                      <td className="px-4 py-3">
                        <StoryThumb src={src} />
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-2 font-semibold text-[#1F1D1A]">
                          {story.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#3A362E]">
                        {STORY_CATEGORY_CONFIG[story.category].label}
                      </td>
                      <td className="px-4 py-3">
                        <StoryStatusBadge status={story.status} />
                      </td>
                      <td className="px-4 py-3 text-[#3A362E]">
                        <PublishedDate value={story.published_at} />
                      </td>
                      <td className="px-4 py-3 text-center text-[#3A362E]">
                        {story.imageCount}
                      </td>
                      {allowedToUpdate && (
                        <td className="px-4 py-3 text-right">
                          <EditButton
                            title={story.title}
                            onClick={() => openEdit(story.id)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-3 md:hidden">
            {stories.map((story) => (
              <li
                key={story.id}
                className="flex gap-3 rounded-2xl border border-[#EAE6DC] bg-white p-3 shadow-sm"
              >
                <StoryThumb src={thumb(story.cover?.path)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="line-clamp-2 font-semibold text-[#1F1D1A]">
                    {story.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                    <StoryStatusBadge status={story.status} />
                    <span>{STORY_CATEGORY_CONFIG[story.category].label}</span>
                  </div>
                  <p className="text-xs text-[#57534E]">
                    <PublishedDate value={story.published_at} /> ·{" "}
                    {story.imageCount}{" "}
                    {story.imageCount === 1 ? "foto" : "fotos"}
                  </p>
                  {allowedToUpdate && (
                    <EditButton
                      title={story.title}
                      onClick={() => openEdit(story.id)}
                      className="mt-1 w-full"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onChangePage={goToPage}
          />
        </div>
      )}

      {creating && (
        <StoryPanel
          key="new"
          story={null}
          pets={pets}
          cloudName={cloudName}
          allowedToUpdate={allowedToUpdate}
          onClose={() => setCreating(false)}
          onCreated={(id) => openEdit(id)}
        />
      )}

      {!creating && editingStory && (
        <StoryPanel
          key={`edit-${editingStory.id}`}
          story={editingStory}
          pets={pets}
          cloudName={cloudName}
          allowedToUpdate={allowedToUpdate}
          onClose={closeEdit}
          onCreated={openEdit}
        />
      )}
    </div>
  );
}

/*==============================| Piezas |==============================*/
function StoryThumb({ src }: { src: string | null }) {
  return src ? (
    <img
      src={src}
      alt=""
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
    />
  ) : (
    <div
      className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#F4F2EC] text-[10px] text-[#57534E]"
      aria-hidden
    >
      Sin foto
    </div>
  );
}

function PublishedDate({ value }: { value: string | null }) {
  if (!value) return <span>Sin publicar</span>;
  return <time dateTime={value}>{formatStoryDate(value)}</time>;
}

function EditButton({
  title,
  onClick,
  className = "",
}: {
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar «${title}»`}
      className={`min-h-[44px] rounded-lg border border-[#1F6F66] px-4 text-sm font-medium text-[#1F6F66] transition-colors hover:bg-[#EAF7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/50 md:min-h-[36px] ${className}`}
    >
      Editar
    </button>
  );
}
