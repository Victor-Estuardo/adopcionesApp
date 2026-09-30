import { config } from "~/config";

/**
 * Construye una URL absoluta y canónica del sitio (Open Graph, enlaces de
 * compartir). Usa SIEMPRE `SITE_URL`, nunca el header `Host` de la petición.
 *
 * Si `SITE_URL` no está configurada: en producción lanza un error (mejor
 * fallar visible que publicar enlaces rotos); en desarrollo usa localhost.
 * Solo servidor (`.server.ts`): calcularla en el `loader` y pasarla a `meta`
 * y a los componentes por los datos del loader.
 */
export function absoluteUrl(path = "/"): string {
  let base = config.siteUrl;
  if (!base) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SITE_URL no está configurada: define la variable de entorno con la URL pública del sitio (p. ej. https://merakigt.org).",
      );
    }
    base = `http://localhost:${process.env.PORT || 3000}`;
  }
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  return `${base}${normalizedPath}`;
}
