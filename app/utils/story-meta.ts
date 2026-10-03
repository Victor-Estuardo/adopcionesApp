import type { story_category } from "@prisma/client";
import type { SerializeFrom, V2_MetaDescriptor } from "@remix-run/node";
import type {
  StoryDetailLoader,
  StoryListLoader,
} from "~/utils/story-routes.server";
import { STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

// `meta` también corre en el cliente al navegar: aquí solo hay datos que ya
// calculó el loader en el servidor (URLs absolutas con SITE_URL, SEG-08).
// React escapa los valores de los atributos.

export const SITE_NAME = "Asociación Meraki";

/** Meta de una lista pública (RF-P08). */
export function storyListMeta(
  category: story_category,
  data: SerializeFrom<StoryListLoader> | undefined,
): V2_MetaDescriptor[] {
  const cfg = STORY_CATEGORY_CONFIG[category];
  const title = `${cfg.sectionTitle} | ${SITE_NAME}`;
  const tags: V2_MetaDescriptor[] = [
    { title },
    { name: "description", content: cfg.sectionDescription },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: cfg.sectionDescription },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "es_LA" },
  ];
  if (data?.canonicalUrl) {
    tags.push(
      { property: "og:url", content: data.canonicalUrl },
      { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    );
  }
  return tags;
}

/**
 * Meta del detalle (RF-D07, RF-C03). Tolerante a `data` indefinido (404 o
 * error): título genérico y `noindex`.
 */
export function storyDetailMeta(
  data: SerializeFrom<StoryDetailLoader> | undefined,
): V2_MetaDescriptor[] {
  if (!data?.story) {
    return [
      { title: `Historia no encontrada | ${SITE_NAME}` },
      { name: "robots", content: "noindex" },
    ];
  }

  const { story, description, canonicalUrl, og } = data;
  const title = `${story.title} | ${SITE_NAME}`;
  const tags: V2_MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:type", content: "article" },
    { property: "og:title", content: story.title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "es_LA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: story.title },
    { name: "twitter:description", content: description },
  ];
  if (story.published_at) {
    tags.push({ property: "article:published_time", content: story.published_at });
  }
  if (og) {
    tags.push(
      { property: "og:image", content: og.image },
      { property: "og:image:width", content: String(og.width) },
      { property: "og:image:height", content: String(og.height) },
      { property: "og:image:alt", content: og.alt },
      { name: "twitter:image", content: og.image },
      { name: "twitter:image:alt", content: og.alt },
    );
  }
  return tags;
}
