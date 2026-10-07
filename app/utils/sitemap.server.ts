import prisma from "~/services/db/prisma";
import { PUBLIC_PET_STATUSES } from "~/utils/pet-helpers";
import { STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";
import { absoluteUrl } from "~/utils/site.server";

export type SitemapEntry = { loc: string; lastmod?: Date };

/** Rutas privadas o sin valor para un buscador (robots.txt). */
export const ROBOTS_DISALLOW = [
  "/mi-cuenta",
  "/iniciar-sesion",
  "/crear-cuenta",
  "/recuperar-clave",
  "/restablecer-clave",
  "/verificar-cuenta",
  "/account",
  "/cron",
  "/logout",
  "/mascota/*/solicitar_adopcion",
];

/** URLs públicas indexables: portada, donación, listas y detalles dinámicos. */
export async function listSitemapEntries(): Promise<SitemapEntry[]> {
  const [pets, stories] = await Promise.all([
    prisma.pet.findMany({
      where: { status: { in: PUBLIC_PET_STATUSES } },
      select: { id: true },
      orderBy: { id: "desc" },
    }),
    prisma.story.findMany({
      where: { status: "Publicada" },
      select: { slug: true, category: true, published_at: true },
      orderBy: { id: "desc" },
    }),
  ]);

  const entries: SitemapEntry[] = [
    { loc: absoluteUrl("/") },
    { loc: absoluteUrl("/donacion") },
    ...Object.values(STORY_CATEGORY_CONFIG).map((cfg) => ({
      loc: absoluteUrl(cfg.route),
    })),
    ...pets.map((pet) => ({ loc: absoluteUrl(`/mascota/${pet.id}`) })),
    ...stories.map((story) => ({
      loc: absoluteUrl(`${STORY_CATEGORY_CONFIG[story.category].route}/${story.slug}`),
      lastmod: story.published_at ?? undefined,
    })),
  ];
  return entries;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemapXml(entries: SitemapEntry[]) {
  const urls = entries
    .map(
      (e) =>
        `  <url><loc>${escapeXml(e.loc)}</loc>${
          e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ""
        }</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
