import type { LoaderFunction } from "@remix-run/node";
import { buildSitemapXml, listSitemapEntries } from "~/utils/sitemap.server";

/** Resource route: /sitemap.xml (mascotas visibles e historias publicadas). */
export const loader: LoaderFunction = async () => {
  try {
    const xml = buildSitemapXml(await listSitemapEntries());
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[sitemap] Error al generar el sitemap:", error);
    return new Response("Error al generar el sitemap", { status: 500 });
  }
};
