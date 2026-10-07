import type { V2_MetaDescriptor } from "@remix-run/node";
import { SITE_NAME } from "~/utils/story-meta";

// `meta` también corre en el cliente al navegar: solo usa datos que ya
// calculó el loader en el servidor (URLs absolutas con SITE_URL).

export const HOME_TITLE = "Adopta perros y gatos en Guatemala | Asociación Meraki";
export const HOME_DESCRIPTION =
  "Conoce a los perros y gatos rescatados que buscan un hogar en Guatemala. Mira sus fichas, guarda tus favoritos y solicita la adopción con la Asociación Meraki.";

/** Meta de la portada (catálogo de mascotas). */
export function homeMeta(canonicalUrl: string | undefined): V2_MetaDescriptor[] {
  const tags: V2_MetaDescriptor[] = [
    { title: HOME_TITLE },
    { name: "description", content: HOME_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:title", content: HOME_TITLE },
    { property: "og:description", content: HOME_DESCRIPTION },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "es_LA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: HOME_TITLE },
    { name: "twitter:description", content: HOME_DESCRIPTION },
  ];
  if (canonicalUrl) {
    tags.push(
      { property: "og:url", content: canonicalUrl },
      { tagName: "link", rel: "canonical", href: canonicalUrl },
    );
  }
  return tags;
}

type PetDetailData = {
  notFound: boolean;
  indexable: boolean;
  canonicalUrl: string;
  title: string;
  description: string;
  ogImage: string | null;
} | undefined;

/** Meta de la ficha de una mascota. Tolera `data` indefinido (error). */
export function petDetailMeta(data: PetDetailData): V2_MetaDescriptor[] {
  if (!data || data.notFound) {
    return [
      { title: `Mascota no encontrada | ${SITE_NAME}` },
      { name: "robots", content: "noindex" },
    ];
  }

  const title = `${data.title} | ${SITE_NAME}`;
  const tags: V2_MetaDescriptor[] = [
    { title },
    { name: "description", content: data.description },
    { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: data.description },
    { property: "og:url", content: data.canonicalUrl },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "es_LA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: data.description },
  ];
  // Mascotas ya adoptadas o no visibles: accesibles por enlace, pero fuera del buscador
  if (!data.indexable) tags.push({ name: "robots", content: "noindex" });
  if (data.ogImage) {
    tags.push(
      { property: "og:image", content: data.ogImage },
      { name: "twitter:image", content: data.ogImage },
    );
  }
  return tags;
}
