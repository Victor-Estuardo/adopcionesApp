import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Ventana fija de rate limiting con incremento atómico (INSERT ... ON
 * CONFLICT) en vez de un read-modify-write desde la app: bajo ráfagas
 * concurrentes (justo lo que este mecanismo tiene que soportar) un
 * read-modify-write perdería incrementos por condiciones de carrera; este
 * UPSERT es una sola sentencia protegida por el lock de fila de Postgres.
 *
 * Si la ventana de la fila existente ya venció, la resetea (count = 1) en
 * la misma sentencia en vez de solo incrementar.
 * @param key Identificador de la ventana, p. ej. "login:ip:1.2.3.4"
 * @param limit Cantidad máxima de intentos permitidos dentro de la ventana
 * @param windowMs Duración de la ventana en milisegundos
 * @returns Si el intento está permitido, cuántos quedan y en cuánto expira la ventana actual
 */
export async function checkRateLimitDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<PrismaUtilResponse<RateLimitResult>> {
  return await handlePosiblePrismaError(async () => {
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "rateLimitBucket" (key, window_start, count)
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN "rateLimitBucket".window_start = EXCLUDED.window_start
            THEN "rateLimitBucket".count + 1
          ELSE 1
        END,
        window_start = EXCLUDED.window_start
      RETURNING count;
    `;

    const count = rows[0].count;
    const windowEnd = windowStart.getTime() + windowMs;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(0, Math.ceil((windowEnd - now) / 1000)),
    };
  });
}

/**
 * Barrido de ventanas de rate limit ya vencidas hace tiempo (respaldo de
 * mantenimiento, análogo a deleteExpiredSessionsDb). Las filas son
 * minúsculas, pero sin esto se acumula una fila por cada combinación única
 * de ip/correo + ruta protegida que se haya visto alguna vez.
 * @param olderThanMs Antigüedad mínima (desde el inicio de su ventana) para considerarla eliminable
 * @returns Cantidad de filas borradas
 */
export async function deleteStaleRateLimitBucketsDb(
  olderThanMs: number,
): Promise<PrismaUtilResponse<number>> {
  return await handlePosiblePrismaError(async () => {
    const result = await prisma.rateLimitBucket.deleteMany({
      where: { window_start: { lt: new Date(Date.now() - olderThanMs) } },
    });
    return result.count;
  });
}
