import { Prisma } from "@prisma/client";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

export type SessionRecordData = Record<string, unknown>;

// Espeja el maxAge de la cookie en sessions.service.ts (1 día); es el
// fallback por si Remix llamara a createData/updateData sin `expires`.
const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

function resolveExpiresAt(expires?: Date): Date {
  return expires ?? new Date(Date.now() + DEFAULT_SESSION_TTL_MS);
}

/**
 * Crea la fila de sesión en la base de datos y devuelve su id — el único
 * valor que Remix guarda en la cookie firmada del cliente.
 * @param data Datos de sesión (módulos, permisos, usuario, etc.)
 * @param expires Fecha de expiración calculada por Remix a partir del maxAge de la cookie
 * @returns Id de la sesión creada
 */
export async function createSessionDataDb(
  data: SessionRecordData,
  expires?: Date,
): Promise<string> {
  const session = await prisma.session.create({
    data: {
      data: data as Prisma.InputJsonValue,
      expires_at: resolveExpiresAt(expires),
    },
  });
  return session.id;
}

/**
 * Lee los datos de una sesión por id. Si ya expiró, la borra en el mismo
 * momento (limpieza perezosa) y devuelve null, igual que si no existiera.
 * @param id Id de la sesión
 * @returns Datos de la sesión, o null si no existe o ya expiró
 */
export async function readSessionDataDb(
  id: string,
): Promise<SessionRecordData | null> {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return null;

  if (session.expires_at.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  return session.data as SessionRecordData;
}

/**
 * Actualiza los datos de una sesión existente. Usa upsert porque la fila
 * pudo haber sido borrada entre el read y este commit (limpieza perezosa u
 * otro request) — en ese caso la vuelve a crear con el mismo id.
 * @param id Id de la sesión
 * @param data Datos de sesión actualizados
 * @param expires Fecha de expiración calculada por Remix
 */
export async function updateSessionDataDb(
  id: string,
  data: SessionRecordData,
  expires?: Date,
): Promise<void> {
  const expiresAt = resolveExpiresAt(expires);
  await prisma.session.upsert({
    where: { id },
    update: { data: data as Prisma.InputJsonValue, expires_at: expiresAt },
    create: { id, data: data as Prisma.InputJsonValue, expires_at: expiresAt },
  });
}

/**
 * Borra una sesión por id (logout explícito). Idempotente: si ya no existe,
 * no lanza error.
 * @param id Id de la sesión
 */
export async function deleteSessionDataDb(id: string): Promise<void> {
  await prisma.session.delete({ where: { id } }).catch(() => {});
}

/**
 * Barrido de sesiones expiradas, respaldo del borrado perezoso de
 * readSessionDataDb (cubre sesiones abandonadas que nunca se vuelven a
 * leer). Pensado para correr desde un cron diario.
 * @returns Cantidad de filas borradas
 */
export async function deleteExpiredSessionsDb(): Promise<
  PrismaUtilResponse<number>
> {
  return await handlePosiblePrismaError(async () => {
    const result = await prisma.session.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
    return result.count;
  });
}
