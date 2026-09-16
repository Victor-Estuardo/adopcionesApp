import { LoaderFunction, json } from "@remix-run/node";
import { deleteExpiredSessionsDb } from "~/services/db/session.service";

/**
 * Resource route pensada para un cron diario (Vercel Cron Jobs, ver
 * vercel.json): borra las sesiones ya expiradas de la tabla `session`.
 * Es un respaldo del borrado perezoso de readSessionDataDb — cubre
 * sesiones abandonadas que nunca se vuelven a leer, así la tabla no crece
 * indefinidamente.
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

  const result = await deleteExpiredSessionsDb();
  if (!result.success) {
    return json({ errorMsg: result.error }, { status: 500 });
  }

  return json({ deletedCount: result.data });
};
