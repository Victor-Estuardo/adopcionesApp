import { LoaderFunction, json } from "@remix-run/node";
import { deleteExpiredSessionsDb } from "~/services/db/session.service";
import { deleteStaleRateLimitBucketsDb } from "~/services/db/rateLimit.service";

// Cualquier ventana de rate limit no tocada en más de un día ya no aporta
// nada (todas las ventanas configuradas son de 15 min a 1 hora).
const STALE_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

/**
 * Resource route de mantenimiento diario (Vercel Cron Jobs, ver
 * vercel.json):
 * - borra las sesiones ya expiradas de la tabla `session` (respaldo del
 *   borrado perezoso de readSessionDataDb, cubre sesiones abandonadas que
 *   nunca se vuelven a leer).
 * - borra las ventanas de rate limit ya vencidas hace más de un día
 *   (`rateLimitBucket`), que si no se acumularían para siempre.
 *
 * Protegida con CRON_SECRET: Vercel firma sus llamadas de cron con
 * `Authorization: Bearer <CRON_SECRET>`, así evitamos que cualquiera
 * dispare el borrado llamando a la URL directamente.
 */
export const loader: LoaderFunction = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const [sessionsResult, rateLimitResult] = await Promise.all([
    deleteExpiredSessionsDb(),
    deleteStaleRateLimitBucketsDb(STALE_RATE_LIMIT_MS),
  ]);

  if (!sessionsResult.success || !rateLimitResult.success) {
    // El detalle real (mensaje de Prisma) se loguea en servidor; al
    // cliente solo se le devuelve un mensaje genérico.
    console.error(
      "Error en el cron de limpieza:",
      (!sessionsResult.success && sessionsResult.error) ||
        (!rateLimitResult.success && rateLimitResult.error),
    );

    return json(
      { errorMsg: "Ocurrió un error al ejecutar la limpieza" },
      { status: 500 },
    );
  }

  return json({
    deletedSessions: sessionsResult.data,
    deletedRateLimitBuckets: rateLimitResult.data,
  });
};
