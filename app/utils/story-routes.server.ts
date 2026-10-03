import type { story_category } from "@prisma/client";
import { json, redirect } from "@remix-run/node";
import { config } from "~/config";
import {
  getPublishedStoryBySlugDb,
  listPublishedStoriesDb,
  listRelatedStoriesDb,
} from "~/services/db/story.service";
import { STORY_IMAGE_SIZES, storyImageUrl } from "~/utils/image";
import { sanitizeLimit } from "~/utils/sanitize";
import { absoluteUrl } from "~/utils/site.server";
import { isValidSlug } from "~/utils/slug";
import { getStoryExcerpt, STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

/*
 * Lógica compartida de las rutas públicas de historias. Cada ruta es un
 * envoltorio delgado que fija la categoría. Sin Cache-Control público: el
 * loader del layout `__public` puede emitir Set-Cookie (SEG-12).
 */

function notFound(): never {
  throw new Response("No encontrada", { status: 404 });
}

/*==============================| Lista |==============================*/
export async function loadStoryList(request: Request, category: story_category) {
  const cfg = STORY_CATEGORY_CONFIG[category];
  const requested =
    sanitizeLimit(new URL(request.url).searchParams.get("page"), {
      min: 1,
      max: 10000,
    }) ?? 1;

  // El servicio corrige la página al rango válido (RF-P06).
  const res = await listPublishedStoriesDb(category, requested);
  if (!res.success) {
    console.error(`[${cfg.route}] Error al listar historias:`, res.error);
    return json({
      category,
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
      error: true,
      cloudName: config.cloudinaryCloudName,
      canonicalUrl: absoluteUrl(cfg.route),
    });
  }

  const { items, page, totalPages, total } = res.data;
  return json({
    category,
    items,
    page,
    totalPages,
    total,
    error: false,
    cloudName: config.cloudinaryCloudName,
    canonicalUrl: absoluteUrl(page > 1 ? `${cfg.route}?page=${page}` : cfg.route),
  });
}

/*==============================| Detalle |==============================*/
export async function loadStoryDetail(
  slugParam: string | undefined,
  category: story_category,
) {
  // SEG-06: slug validado antes de consultar; inválido → 404.
  if (!isValidSlug(slugParam)) notFound();

  const res = await getPublishedStoryBySlugDb(slugParam);
  if (!res.success) {
    console.error("[historias] Error al cargar la historia:", res.error);
    throw new Response("Ocurrió un error al cargar la historia", { status: 500 });
  }
  const story = res.data;
  // Borrador, archivada o inexistente: 404 sin revelar nada (RF-D02).
  if (!story) notFound();

  // Slug válido de la otra categoría → URL canónica (RF-D03).
  if (story.category !== category) {
    throw redirect(
      `${STORY_CATEGORY_CONFIG[story.category].route}/${story.slug}`,
      301,
    );
  }

  const cfg = STORY_CATEGORY_CONFIG[category];
  const cloudName = config.cloudinaryCloudName;
  const cover = story.images.find((img) => img.is_cover) ?? story.images[0] ?? null;
  const gallery = story.images.filter((img) => img.id !== cover?.id);

  const relatedRes = await listRelatedStoriesDb(category, story.id, 3);
  if (!relatedRes.success) {
    console.error("[historias] Error al listar relacionadas:", relatedRes.error);
  }

  return json({
    story: {
      id: story.id,
      title: story.title,
      slug: story.slug,
      category: story.category,
      body: story.body,
      published_at: story.published_at,
    },
    cover,
    gallery,
    related: relatedRes.success ? relatedRes.data : [],
    cloudName,
    description: getStoryExcerpt(story.summary, story.body, 160),
    canonicalUrl: absoluteUrl(`${cfg.route}/${story.slug}`),
    og: cover
      ? {
          image: storyImageUrl(cloudName, cover.path, "storyOg"),
          width: STORY_IMAGE_SIZES.storyOg.width,
          height: STORY_IMAGE_SIZES.storyOg.height,
          alt: cover.alt_text || story.title,
        }
      : null,
  });
}

export type StoryListLoader = typeof loadStoryList;
export type StoryDetailLoader = typeof loadStoryDetail;
