/**
 * Siembra los datos de configuración (roles, módulos, permisos, especies y
 * preguntas del formulario) y el primer usuario administrador. Es idempotente:
 * se puede correr varias veces y la configuración queda igual a los JSON.
 *
 * Variables para el administrador (solo se usan si aún no existe el usuario 1):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
 *
 *   npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

function leer<T>(nombre: string): T[] {
  return JSON.parse(readFileSync(join(__dirname, "data", `${nombre}.json`), "utf8"));
}

const ADMIN_ROLE_ID = 1;
const ADMIN_USER_ID = 1;

async function sembrarAdmin() {
  if (await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } })) {
    console.log("user: el administrador ya existe, no se modifica");
    return;
  }
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Define ADMIN_EMAIL y ADMIN_PASSWORD para crear el administrador inicial");
  }
  const salt = await bcrypt.genSalt(Number(process.env.SALT_BCRYPT) || 10);
  await prisma.user.create({
    data: {
      id: ADMIN_USER_ID,
      first_name: ADMIN_FIRST_NAME || "Administrador",
      last_name: ADMIN_LAST_NAME || "Meraki",
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_PASSWORD, salt),
      role_id: ADMIN_ROLE_ID,
      it_is_verified: true,
      active: true,
    },
  });
  console.log(`user: administrador ${ADMIN_EMAIL} creado`);
}

async function main() {
  // Orden según llaves foráneas: role -> user -> module -> permission -> permission_role -> petSpecies
  const roles = leer<any>("role");
  for (const r of roles) {
    await prisma.role.upsert({ where: { id: r.id }, create: r, update: r });
  }
  console.log(`role: ${roles.length}`);

  await sembrarAdmin();

  const modulos = leer<any>("module");
  for (const m of modulos) {
    await prisma.module.upsert({ where: { id: m.id }, create: m, update: m });
  }
  console.log(`module: ${modulos.length}`);

  const permisos = leer<any>("permission");
  for (const p of permisos) {
    await prisma.permission.upsert({ where: { id: p.id }, create: p, update: p });
  }
  console.log(`permission: ${permisos.length}`);

  const permisosRol = leer<any>("permission_role");
  for (const pr of permisosRol) {
    await prisma.permission_role.upsert({ where: { id: pr.id }, create: pr, update: pr });
  }
  console.log(`permission_role: ${permisosRol.length}`);

  const especies = leer<any>("petSpecies");
  for (const e of especies) {
    await prisma.petSpecies.upsert({ where: { id: e.id }, create: e, update: e });
  }
  console.log(`petSpecies: ${especies.length}`);

  const preguntas = leer<any>("formQuestion");
  for (const q of preguntas) {
    await prisma.formQuestion.upsert({ where: { id: q.id }, create: q, update: q });
  }
  console.log(`formQuestion: ${preguntas.length}`);

  // Los ids se insertaron explícitos: alinear las secuencias para que los próximos inserts no choquen
  for (const tabla of ["role", "user", "module", "permission", "permission_role", "petSpecies"]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('public."${tabla}"', 'id'), COALESCE((SELECT MAX(id) FROM public."${tabla}"), 1), (SELECT COUNT(*) > 0 FROM public."${tabla}"))`,
    );
  }
  console.log("secuencias alineadas");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
