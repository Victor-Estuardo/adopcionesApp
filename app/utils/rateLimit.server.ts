import { checkRateLimitDb } from "~/services/db/rateLimit.service";

/**
 * Extrae la IP del cliente de los headers que reenvía el proxy (Vercel).
 * Mismo criterio de fallback ya usado para el registro de IP en
 * commitmentAgreement (solicitar_adopcion).
 * @param request Request entrante
 * @returns IP del cliente, o "unknown" si ningún header trae una
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export interface RateLimitCheck {
  /** Prefijo de la acción protegida, p. ej. "login" o "recuperar-clave" */
  action: string;
  /** Valor a limitar dentro de esa acción, p. ej. una IP o un correo normalizado */
  identifier: string;
  /** Cantidad máxima de intentos permitidos dentro de la ventana */
  limit: number;
  /** Duración de la ventana en milisegundos */
  windowMs: number;
}

/**
 * Verifica uno o más límites (p. ej. por IP y por correo a la vez) y
 * devuelve el mensaje genérico a mostrar si alguno se excedió. No indica
 * cuál de los límites falló, para no dar pistas de enumeración a un
 * atacante.
 * @param checks Límites a verificar; basta con que uno falle para bloquear
 * @returns Null si todos los límites lo permiten, o el mensaje de error a mostrar
 */
export async function enforceRateLimits(
  checks: RateLimitCheck[],
): Promise<string | null> {
  let maxRetryAfterSeconds = 0;

  for (const { action, identifier, limit, windowMs } of checks) {
    const result = await checkRateLimitDb(
      `${action}:${identifier}`,
      limit,
      windowMs,
    );

    // Si falla la verificación misma (p. ej. la BD no respondió), no
    // bloqueamos por eso — un rate limiter que se cae no debe tumbar la
    // funcionalidad que protege.
    if (!result.success) continue;

    if (!result.data.allowed) {
      maxRetryAfterSeconds = Math.max(
        maxRetryAfterSeconds,
        result.data.retryAfterSeconds,
      );
    }
  }

  if (maxRetryAfterSeconds === 0) return null;

  const minutes = Math.ceil(maxRetryAfterSeconds / 60);
  return `Demasiados intentos. Por favor intenta de nuevo en ${minutes} minuto${minutes === 1 ? "" : "s"}.`;
}
