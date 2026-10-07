import type { LoaderFunction } from "@remix-run/node";
import { absoluteUrl } from "~/utils/site.server";
import { ROBOTS_DISALLOW } from "~/utils/sitemap.server";

/** Resource route: /robots.txt */
export const loader: LoaderFunction = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
