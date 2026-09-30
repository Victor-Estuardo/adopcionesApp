import {
  Prisma,
  story,
  story_category,
  story_image,
  story_status,
} from "@prisma/client";
import { STORY_MAX_IMAGES } from "~/services/cloudinary/fileConstraints";
import {
  sanitizeLimit,
  sanitizeMultilineText,
  sanitizeText,
} from "~/utils/sanitize";
import { isValidSlug, slugify, SLUG_MAX_LENGTH } from "~/utils/slug";
import {
  getStoryExcerpt,
  STORY_ALT_MAX,
  STORY_BODY_MAX,
  STORY_SUMMARY_MAX,
  STORY_TITLE_MAX,
} from "~/utils/story-helpers";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| CONSTANTES |==================================================*/
export const STORY_PUBLIC_PAGE_SIZE = 12;
export const STORY_ADMIN_PAGE_SIZE = 10;

const STORY_CATEGORIES: story_category[] = ["Finales_felices", "Camino_arcoiris"];
const STORY_STATUSES: story_status[] = ["Borrador", "Publicada", "Archivada"];

const GENERIC_ERROR =
  "Ocurrió un error inesperado. Intenta de nuevo en unos minutos.";

/*==================================================| TYPE |==================================================*/
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type StoryCover = { path: string; alt_text: string | null };

/** Fila del listado administrativo (sin `body`). */
export type AdminStoryListItem = Pick<
  story,
  "id" | "title" | "slug" | "category" | "status" | "published_at" | "update_date"
> & { cover: StoryCover | null; imageCount: number };

/** Historia completa para el panel de edición. */
export type AdminStory = story & {
  images: story_image[];
  pet: { id: number; name: string } | null;
};

/** Tarjeta pública: sin `body` ni datos de la mascota vinculada. */
export type PublicStoryCard = Pick<
  story,
  "id" | "title" | "slug" | "category" | "published_at"
> & { excerpt: string; cover: StoryCover | null };

/** Detalle público: nunca incluye `pet_id` ni datos internos. */
export type PublicStory = Pick<
  story,
  "id" | "title" | "slug" | "summary" | "body" | "category" | "published_at"
> & {
  images: Pick<story_image, "id" | "path" | "alt_text" | "is_cover">[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};

/** Datos ya sanitizados y validados de una historia (ver `parseStoryInput`). */
export type StoryInput = {
  title: string;
  category: story_category;
  summary: string | null;
  body: string;
  event_date: Date | null;
  pet_id: number | null;
  /** Slug manual opcional (solo se respeta si nunca se publicó). */
  slug: string | null;
};

export type StoryStatusAction = "publish" | "unpublish" | "archive" | "restore";

export type StoryFieldErrors = Partial<Record<keyof StoryInput, string>>;

/*==================================================| ERRORES |==================================================*/
/**
 * Error de regla de negocio: su mensaje es seguro para mostrar al usuario.
 * Cualquier otro error se registra en consola y se devuelve un mensaje
 * genérico (SEG-11).
 */
class StoryRuleError extends Error {}

async function runStory<T>(
  action: () => Promise<T>,
): Promise<PrismaUtilResponse<T>> {
  return handlePosiblePrismaError(async () => {
    try {
      return await action();
    } catch (error) {
      if (error instanceof StoryRuleError) throw error;
      console.error("[story.service]", error);
      throw new Error(GENERIC_ERROR);
    }
  });
}

/*==================================================| VALIDACIÓN |==================================================*/
/** Entero positivo o `null` (IDs que llegan del cliente). */
export function toPositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isStoryCategory(value: unknown): value is story_category {
  return STORY_CATEGORIES.includes(value as story_category);
}

export function isStoryStatus(value: unknown): value is story_status {
  return STORY_STATUSES.includes(value as story_status);
}

/** Convierte "AAAA-MM-DD" en `Date` a medianoche UTC (columna `@db.Date`). */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  // Rechaza fechas imposibles (31 de febrero) que Date "corrige" en silencio.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/**
 * Sanitiza y valida los campos de una historia que llegan del formulario.
 * Para guardar un borrador basta título y categoría; el resto de requisitos
 * (cuerpo, fotos, portada) se exige al publicar (RN-01).
 */
export function parseStoryInput(raw: {
  title?: unknown;
  category?: unknown;
  summary?: unknown;
  body?: unknown;
  event_date?: unknown;
  pet_id?: unknown;
  slug?: unknown;
}):
  | { success: true; data: StoryInput }
  | { success: false; fieldErrors: StoryFieldErrors } {
  const fieldErrors: StoryFieldErrors = {};

  const title = sanitizeText(raw.title, STORY_TITLE_MAX + 1);
  if (!title) fieldErrors.title = "Escribe un título.";
  else if (title.length > STORY_TITLE_MAX)
    fieldErrors.title = `El título no puede superar ${STORY_TITLE_MAX} caracteres.`;

  if (!isStoryCategory(raw.category))
    fieldErrors.category = "Selecciona una categoría.";

  const summary = sanitizeText(raw.summary, STORY_SUMMARY_MAX + 1);
  if (summary.length > STORY_SUMMARY_MAX)
    fieldErrors.summary = `El resumen no puede superar ${STORY_SUMMARY_MAX} caracteres.`;

  const body = sanitizeMultilineText(raw.body, STORY_BODY_MAX + 1);
  if (body.length > STORY_BODY_MAX)
    fieldErrors.body = `El texto no puede superar ${STORY_BODY_MAX} caracteres.`;

  let event_date: Date | null = null;
  const rawDate = sanitizeText(raw.event_date, 10);
  if (rawDate) {
    event_date = parseDateOnly(rawDate);
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    if (
      !event_date ||
      event_date.getUTCFullYear() < 1990 ||
      event_date.getTime() > tomorrow
    ) {
      fieldErrors.event_date = "La fecha del suceso no es válida.";
    }
  }

  let pet_id: number | null = null;
  if (raw.pet_id !== undefined && raw.pet_id !== null && raw.pet_id !== "") {
    pet_id = toPositiveInt(raw.pet_id);
    if (!pet_id) fieldErrors.pet_id = "La mascota seleccionada no es válida.";
  }

  let slug: string | null = null;
  const rawSlug = sanitizeText(raw.slug, SLUG_MAX_LENGTH + 1);
  if (rawSlug) {
    if (!isValidSlug(rawSlug)) {
      fieldErrors.slug =
        "El enlace solo puede tener minúsculas, números y guiones (sin tildes ni espacios).";
    } else {
      slug = rawSlug;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      title,
      category: raw.category as story_category,
      summary: summary || null,
      body,
      event_date,
      pet_id,
      slug,
    },
  };
}

/*==================================================| HELPERS INTERNOS |==================================================*/
const coverSelect = {
  orderBy: [{ is_cover: "desc" }, { sort_order: "asc" }, { id: "asc" }],
  take: 1,
  select: { path: true, alt_text: true },
} satisfies Prisma.story$story_imageArgs;

function clampPage(page: unknown, totalPages: number): number {
  return sanitizeLimit(page, { min: 1, max: Math.max(1, totalPages) }) ?? 1;
}

/** Marca la escritura en la historia (SEG-14). */
function touch(tx: Tx, storyId: number, userId: number) {
  return tx.story.update({
    where: { id: storyId },
    data: { updater_id: userId, update_date: new Date() },
  });
}

function assertUserId(userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new StoryRuleError("Sesión inválida.");
  }
}

async function getStoryOrFail(tx: Tx, storyId: number) {
  const current = await tx.story.findUnique({ where: { id: storyId } });
  if (!current) throw new StoryRuleError("La historia no existe.");
  return current;
}

async function assertPetExists(tx: Tx, petId: number | null) {
  if (petId === null) return;
  const pet = await tx.pet.findUnique({
    where: { id: petId },
    select: { id: true },
  });
  if (!pet) throw new StoryRuleError("La mascota seleccionada no existe.");
}

/**
 * Busca un slug libre a partir del título: `base`, `base-2`, `base-3`…
 * `excludeId` permite que una historia conserve su propio slug al editarse.
 */
async function findUniqueSlug(
  tx: Tx,
  title: string,
  excludeId?: number,
): Promise<string> {
  // Se reserva espacio para el sufijo numérico dentro de los 180 caracteres.
  const base =
    slugify(title).slice(0, SLUG_MAX_LENGTH - 5).replace(/-+$/, "") ||
    "historia";

  const taken = await tx.story.findMany({
    where: {
      OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });
  const takenSet = new Set(taken.map((row) => row.slug));
  if (!takenSet.has(base)) return base;

  let suffix = 2;
  while (takenSet.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/*==================================================| SLUG |==================================================*/
/**
 * Genera un slug único a partir del título (RF-A07).
 * @param excludeId Historia que se está editando (su propio slug no cuenta como ocupado)
 */
export const generateUniqueSlugDb = async (
  title: string,
  excludeId?: number,
): Promise<PrismaUtilResponse<string>> => {
  return runStory(() => findUniqueSlug(prisma, title, excludeId));
};

/*==================================================| ADMIN · LIST |==================================================*/
/**
 * Listado administrativo con filtros y paginación. No trae `body`.
 * Todos los parámetros se validan aquí: valores inválidos se ignoran.
 */
export const listStoriesAdminDb = async (
  filters: { category?: unknown; status?: unknown; search?: unknown },
  pagination: { page?: unknown; limit?: unknown } = {},
): Promise<PrismaUtilResponse<Paginated<AdminStoryListItem>>> => {
  const limit =
    sanitizeLimit(pagination.limit, { min: 1, max: 50 }) ??
    STORY_ADMIN_PAGE_SIZE;
  const search = sanitizeText(filters.search, 100);

  const where: Prisma.storyWhereInput = {
    ...(isStoryCategory(filters.category) ? { category: filters.category } : {}),
    ...(isStoryStatus(filters.status) ? { status: filters.status } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };

  return runStory(async () => {
    const total = await prisma.story.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = clampPage(pagination.page, totalPages);

    const rows = await prisma.story.findMany({
      where,
      orderBy: [{ update_date: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        status: true,
        published_at: true,
        update_date: true,
        story_image: coverSelect,
        _count: { select: { story_image: true } },
      },
    });

    const items = rows.map(
      ({ story_image, _count, ...row }): AdminStoryListItem => ({
        ...row,
        cover: story_image[0] ?? null,
        imageCount: _count.story_image,
      }),
    );

    return { items, total, page, totalPages };
  });
};

/*==================================================| ADMIN · GET |==================================================*/
/**
 * Historia completa para editar, con sus imágenes en orden y la mascota
 * vinculada (id y nombre). `null` si no existe.
 */
export const getStoryAdminDb = async (
  id: unknown,
): Promise<PrismaUtilResponse<AdminStory | null>> => {
  const storyId = toPositiveInt(id);
  if (!storyId) return { success: true, data: null };

  return runStory(async () => {
    const row = await prisma.story.findUnique({
      where: { id: storyId },
      include: {
        story_image: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] },
        pet: { select: { id: true, name: true } },
      },
    });
    if (!row) return null;
    const { story_image, pet, ...rest } = row;
    return { ...rest, images: story_image, pet };
  });
};

/*==================================================| ADMIN · CREATE |==================================================*/
/**
 * Crea una historia en Borrador con slug único generado del título (o el
 * manual, si viene y está libre).
 */
export const createStoryDb = async (
  input: StoryInput,
  userId: number,
): Promise<PrismaUtilResponse<story>> => {
  return runStory(async () => {
    assertUserId(userId);
    // Reintento ante una carrera por el mismo slug (índice único).
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertPetExists(tx, input.pet_id);

          let slug: string;
          if (input.slug) {
            const inUse = await tx.story.findUnique({
              where: { slug: input.slug },
              select: { id: true },
            });
            if (inUse) throw new StoryRuleError("Ese enlace ya está en uso.");
            slug = input.slug;
          } else {
            slug = await findUniqueSlug(tx, input.title);
          }

          const now = new Date();
          return tx.story.create({
            data: {
              title: input.title,
              slug,
              summary: input.summary,
              body: input.body,
              category: input.category,
              event_date: input.event_date,
              pet_id: input.pet_id,
              status: "Borrador",
              creator_id: userId,
              updater_id: userId,
              creation_date: now,
              update_date: now,
            },
          });
        });
      } catch (error) {
        if (!isUniqueViolation(error) || input.slug || attempt === 2) throw error;
      }
    }
    throw new Error("No se pudo generar un enlace único.");
  });
};

/*==================================================| ADMIN · UPDATE |==================================================*/
/**
 * Edita los campos de una historia. El slug solo cambia mientras la historia
 * nunca se haya publicado (RN-03): si viene uno manual se usa ese; si no y el
 * título cambió, se regenera. Una vez publicada, el slug queda fijo.
 */
export const updateStoryDb = async (
  id: number,
  input: StoryInput,
  userId: number,
): Promise<PrismaUtilResponse<story>> => {
  return runStory(async () => {
    assertUserId(userId);
    const storyId = toPositiveInt(id);
    if (!storyId) throw new StoryRuleError("La historia no existe.");

    return prisma.$transaction(async (tx) => {
      const current = await getStoryOrFail(tx, storyId);
      await assertPetExists(tx, input.pet_id);

      let slug = current.slug;
      const slugLocked = current.published_at !== null;

      if (slugLocked) {
        if (input.slug && input.slug !== current.slug) {
          throw new StoryRuleError(
            "El enlace no se puede cambiar porque la historia ya fue publicada.",
          );
        }
      } else if (input.slug && input.slug !== current.slug) {
        const inUse = await tx.story.findFirst({
          where: { slug: input.slug, NOT: { id: storyId } },
          select: { id: true },
        });
        if (inUse) throw new StoryRuleError("Ese enlace ya está en uso.");
        slug = input.slug;
      } else if (!input.slug && input.title !== current.title) {
        slug = await findUniqueSlug(tx, input.title, storyId);
      }

      return tx.story.update({
        where: { id: storyId },
        data: {
          title: input.title,
          slug,
          summary: input.summary,
          body: input.body,
          category: input.category,
          event_date: input.event_date,
          pet_id: input.pet_id,
          updater_id: userId,
          update_date: new Date(),
        },
      });
    });
  });
};

/*==================================================| ADMIN · ESTADO |==================================================*/
const STATUS_TRANSITIONS: Record<
  StoryStatusAction,
  { from: story_status[]; to: story_status; invalidMsg: string }
> = {
  publish: {
    from: ["Borrador"],
    to: "Publicada",
    invalidMsg: "Solo se puede publicar una historia en Borrador.",
  },
  unpublish: {
    from: ["Publicada"],
    to: "Borrador",
    invalidMsg: "Solo se puede despublicar una historia publicada.",
  },
  archive: {
    from: ["Borrador", "Publicada"],
    to: "Archivada",
    invalidMsg: "La historia ya está archivada.",
  },
  restore: {
    from: ["Archivada"],
    to: "Borrador",
    invalidMsg: "Solo se puede restaurar una historia archivada.",
  },
};

/**
 * Cambia el estado de una historia en una transacción (SEG-13).
 * - publish: Borrador → Publicada. Exige título, cuerpo, categoría, al menos
 *   una foto y exactamente una portada (RN-01). `published_at` se fija solo
 *   la primera vez (RN-02).
 * - unpublish: Publicada → Borrador (conserva `published_at`).
 * - archive: Borrador/Publicada → Archivada.
 * - restore: Archivada → Borrador.
 */
export const changeStoryStatusDb = async (
  id: number,
  action: StoryStatusAction,
  userId: number,
): Promise<PrismaUtilResponse<story>> => {
  return runStory(async () => {
    assertUserId(userId);
    const storyId = toPositiveInt(id);
    if (!storyId) throw new StoryRuleError("La historia no existe.");
    const transition = STATUS_TRANSITIONS[action];
    if (!transition) throw new StoryRuleError("Acción no válida.");

    return prisma.$transaction(async (tx) => {
      const current = await getStoryOrFail(tx, storyId);
      if (!transition.from.includes(current.status)) {
        throw new StoryRuleError(transition.invalidMsg);
      }

      if (action === "publish") {
        const missing: string[] = [];
        if (!current.title.trim()) missing.push("título");
        if (!current.body.trim()) missing.push("texto de la historia");
        if (!isStoryCategory(current.category)) missing.push("categoría");

        const [imageCount, coverCount] = await Promise.all([
          tx.story_image.count({ where: { story_id: storyId } }),
          tx.story_image.count({ where: { story_id: storyId, is_cover: true } }),
        ]);
        if (imageCount === 0) missing.push("al menos una foto");
        else if (coverCount !== 1) missing.push("una foto de portada");

        if (missing.length > 0) {
          throw new StoryRuleError(
            `No se puede publicar: falta ${missing.join(", ")}.`,
          );
        }
      }

      const now = new Date();
      // Condición sobre el estado leído: si otra petición lo cambió entre
      // la lectura y la escritura, no se actualiza nada.
      const { count } = await tx.story.updateMany({
        where: { id: storyId, status: current.status },
        data: {
          status: transition.to,
          ...(action === "publish" && current.published_at === null
            ? { published_at: now }
            : {}),
          updater_id: userId,
          update_date: now,
        },
      });
      if (count !== 1) {
        throw new StoryRuleError(
          "La historia cambió mientras la editabas. Recarga e intenta de nuevo.",
        );
      }

      return getStoryOrFail(tx, storyId);
    });
  });
};

/*==================================================| ADMIN · IMÁGENES |==================================================*/
/**
 * Registra imágenes ya subidas a Cloudinary. Respeta el tope de
 * `STORY_MAX_IMAGES` (RN-06); se agregan al final del orden y, si la
 * historia no tenía portada, la primera nueva pasa a serlo.
 * Cada `path` debe estar dentro de `story/{storyId}/` (SEG-07).
 */
export const addStoryImagesDb = async (
  storyId: number,
  images: { path: string; alt_text?: string | null }[],
  userId: number,
): Promise<PrismaUtilResponse<story_image[]>> => {
  return runStory(async () => {
    assertUserId(userId);
    const id = toPositiveInt(storyId);
    if (!id) throw new StoryRuleError("La historia no existe.");
    if (images.length === 0) throw new StoryRuleError("No se recibieron fotos.");

    const prefix = `story/${id}/`;
    const clean = images.map((image) => {
      const path = String(image.path ?? "");
      if (!path.startsWith(prefix) || path.length > 150) {
        throw new StoryRuleError("Ruta de imagen no válida.");
      }
      return {
        path,
        alt_text: sanitizeText(image.alt_text, STORY_ALT_MAX) || null,
      };
    });

    return prisma.$transaction(async (tx) => {
      await getStoryOrFail(tx, id);
      const [count, last, cover] = await Promise.all([
        tx.story_image.count({ where: { story_id: id } }),
        tx.story_image.findFirst({
          where: { story_id: id },
          orderBy: { sort_order: "desc" },
          select: { sort_order: true },
        }),
        tx.story_image.findFirst({
          where: { story_id: id, is_cover: true },
          select: { id: true },
        }),
      ]);

      if (count + clean.length > STORY_MAX_IMAGES) {
        throw new StoryRuleError(
          `Una historia puede tener como máximo ${STORY_MAX_IMAGES} fotos (ya tiene ${count}).`,
        );
      }

      const start = (last?.sort_order ?? -1) + 1;
      const created: story_image[] = [];
      for (const [index, image] of clean.entries()) {
        created.push(
          await tx.story_image.create({
            data: {
              story_id: id,
              path: image.path,
              alt_text: image.alt_text,
              sort_order: start + index,
              is_cover: !cover && index === 0,
              creator_id: userId,
            },
          }),
        );
      }

      await touch(tx, id, userId);
      return created;
    });
  });
};

/**
 * Elimina una imagen de la historia. Si era la portada, se promueve la
 * siguiente en orden (RN-05). No se permite dejar sin fotos una historia
 * Publicada. Devuelve el `path` borrado para que la ruta elimine el asset
 * de Cloudinary (RN-10).
 */
export const removeStoryImageDb = async (
  storyId: number,
  imageId: number,
  userId: number,
): Promise<PrismaUtilResponse<{ path: string }>> => {
  return runStory(async () => {
    assertUserId(userId);
    const sId = toPositiveInt(storyId);
    const iId = toPositiveInt(imageId);
    if (!sId || !iId) throw new StoryRuleError("La foto no existe.");

    return prisma.$transaction(async (tx) => {
      const current = await getStoryOrFail(tx, sId);
      const image = await tx.story_image.findFirst({
        where: { id: iId, story_id: sId },
      });
      if (!image) throw new StoryRuleError("La foto no existe.");

      const count = await tx.story_image.count({ where: { story_id: sId } });
      if (current.status === "Publicada" && count <= 1) {
        throw new StoryRuleError(
          "Una historia publicada debe tener al menos una foto. Despublícala antes de quitar la última.",
        );
      }

      await tx.story_image.delete({ where: { id: iId } });

      if (image.is_cover) {
        const next = await tx.story_image.findFirst({
          where: { story_id: sId },
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (next) {
          await tx.story_image.update({
            where: { id: next.id },
            data: { is_cover: true },
          });
        }
      }

      await touch(tx, sId, userId);
      return { path: image.path };
    });
  });
};

/**
 * Reordena las imágenes. `orderedIds` debe contener exactamente los ids de
 * todas las imágenes de la historia, en el orden deseado.
 */
export const reorderStoryImagesDb = async (
  storyId: number,
  orderedIds: unknown[],
  userId: number,
): Promise<PrismaUtilResponse<true>> => {
  return runStory(async () => {
    assertUserId(userId);
    const sId = toPositiveInt(storyId);
    if (!sId) throw new StoryRuleError("La historia no existe.");
    const ids = orderedIds.map(toPositiveInt);
    if (ids.some((value) => value === null) || new Set(ids).size !== ids.length) {
      throw new StoryRuleError("Orden de fotos no válido.");
    }

    return prisma.$transaction(async (tx) => {
      await getStoryOrFail(tx, sId);
      const existing = await tx.story_image.findMany({
        where: { story_id: sId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((row) => row.id));
      if (
        existingIds.size !== ids.length ||
        !ids.every((value) => existingIds.has(value as number))
      ) {
        throw new StoryRuleError(
          "Las fotos cambiaron mientras editabas. Recarga e intenta de nuevo.",
        );
      }

      for (const [index, imageId] of ids.entries()) {
        await tx.story_image.update({
          where: { id: imageId as number },
          data: { sort_order: index },
        });
      }
      await touch(tx, sId, userId);
      return true as const;
    });
  });
};

/**
 * Marca una imagen como portada: desmarca todas y marca una, en la misma
 * transacción (RN-05, SEG-13).
 */
export const setStoryCoverDb = async (
  storyId: number,
  imageId: number,
  userId: number,
): Promise<PrismaUtilResponse<true>> => {
  return runStory(async () => {
    assertUserId(userId);
    const sId = toPositiveInt(storyId);
    const iId = toPositiveInt(imageId);
    if (!sId || !iId) throw new StoryRuleError("La foto no existe.");

    return prisma.$transaction(async (tx) => {
      const image = await tx.story_image.findFirst({
        where: { id: iId, story_id: sId },
        select: { id: true },
      });
      if (!image) throw new StoryRuleError("La foto no existe.");

      await tx.story_image.updateMany({
        where: { story_id: sId, is_cover: true },
        data: { is_cover: false },
      });
      await tx.story_image.update({
        where: { id: iId },
        data: { is_cover: true },
      });
      await touch(tx, sId, userId);
      return true as const;
    });
  });
};

/** Actualiza el texto alternativo de una imagen (RF-A05). */
export const updateStoryImageAltDb = async (
  storyId: number,
  imageId: number,
  altText: unknown,
  userId: number,
): Promise<PrismaUtilResponse<true>> => {
  return runStory(async () => {
    assertUserId(userId);
    const sId = toPositiveInt(storyId);
    const iId = toPositiveInt(imageId);
    if (!sId || !iId) throw new StoryRuleError("La foto no existe.");
    const alt_text = sanitizeText(altText, STORY_ALT_MAX) || null;

    return prisma.$transaction(async (tx) => {
      const { count } = await tx.story_image.updateMany({
        where: { id: iId, story_id: sId },
        data: { alt_text },
      });
      if (count !== 1) throw new StoryRuleError("La foto no existe.");
      await touch(tx, sId, userId);
      return true as const;
    });
  });
};

/*==================================================| PÚBLICO |==================================================*/
// Todas las consultas públicas filtran `status = Publicada` AQUÍ, en el
// servicio, nunca en la ruta (SEG-10). No exponen `pet_id` ni datos internos.
const PUBLISHED = "Publicada" satisfies story_status;

const publicCardSelect = {
  id: true,
  title: true,
  slug: true,
  category: true,
  summary: true,
  published_at: true,
  story_image: coverSelect,
} satisfies Prisma.storySelect;

/**
 * Convierte filas en tarjetas. El `body` solo se consulta para las historias
 * sin `summary` (para calcular el extracto), no para todas.
 */
async function toPublicCards(
  rows: Prisma.storyGetPayload<{ select: typeof publicCardSelect }>[],
): Promise<PublicStoryCard[]> {
  const needBody = rows.filter((row) => !row.summary?.trim()).map((row) => row.id);
  const bodies = new Map<number, string>();
  if (needBody.length > 0) {
    const found = await prisma.story.findMany({
      where: { id: { in: needBody }, status: PUBLISHED },
      select: { id: true, body: true },
    });
    for (const row of found) bodies.set(row.id, row.body);
  }

  return rows.map(({ story_image, summary, ...row }) => ({
    ...row,
    excerpt: getStoryExcerpt(summary, bodies.get(row.id) ?? ""),
    cover: story_image[0] ?? null,
  }));
}

/**
 * Historias publicadas de una categoría, de la más reciente a la más
 * antigua. Una página fuera de rango se corrige al rango válido (RF-P06).
 */
export const listPublishedStoriesDb = async (
  category: story_category,
  page: unknown,
  limit: unknown = STORY_PUBLIC_PAGE_SIZE,
): Promise<PrismaUtilResponse<Paginated<PublicStoryCard>>> => {
  if (!isStoryCategory(category)) {
    return { success: false, error: "Categoría no válida." };
  }
  const take =
    sanitizeLimit(limit, { min: 1, max: 50 }) ?? STORY_PUBLIC_PAGE_SIZE;
  const where: Prisma.storyWhereInput = { category, status: PUBLISHED };

  return runStory(async () => {
    const total = await prisma.story.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / take));
    const currentPage = clampPage(page, totalPages);

    const rows = await prisma.story.findMany({
      where,
      orderBy: [{ published_at: "desc" }, { id: "desc" }],
      skip: (currentPage - 1) * take,
      take,
      select: publicCardSelect,
    });

    return {
      items: await toPublicCards(rows),
      total,
      page: currentPage,
      totalPages,
    };
  });
};

/**
 * Historia publicada por slug, con sus imágenes en orden. Incluye `category`
 * para que la ruta redirija a la URL canónica si no coincide (RF-D03).
 * `null` si el slug no es válido, no existe o no está publicada (→ 404).
 */
export const getPublishedStoryBySlugDb = async (
  slug: unknown,
): Promise<PrismaUtilResponse<PublicStory | null>> => {
  if (!isValidSlug(slug)) return { success: true, data: null };

  return runStory(async () => {
    const row = await prisma.story.findFirst({
      where: { slug, status: PUBLISHED },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        body: true,
        category: true,
        published_at: true,
        story_image: {
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
          select: { id: true, path: true, alt_text: true, is_cover: true },
        },
      },
    });
    if (!row) return null;
    const { story_image, ...rest } = row;
    return { ...rest, images: story_image };
  });
};

/** Hasta `take` historias publicadas de la misma categoría (RF-D06). */
export const listRelatedStoriesDb = async (
  category: story_category,
  excludeId: number,
  take: unknown = 3,
): Promise<PrismaUtilResponse<PublicStoryCard[]>> => {
  if (!isStoryCategory(category)) {
    return { success: false, error: "Categoría no válida." };
  }
  const limit = sanitizeLimit(take, { min: 1, max: 6 }) ?? 3;
  const exclude = toPositiveInt(excludeId);

  return runStory(async () => {
    const rows = await prisma.story.findMany({
      where: {
        category,
        status: PUBLISHED,
        ...(exclude ? { NOT: { id: exclude } } : {}),
      },
      orderBy: [{ published_at: "desc" }, { id: "desc" }],
      take: limit,
      select: publicCardSelect,
    });
    return toPublicCards(rows);
  });
};
