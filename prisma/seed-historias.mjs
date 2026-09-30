/**
 * Seed del módulo Historias (Finales felices / Camino al arcoíris).
 *
 * Independiente de `seed.mjs` (que es destructivo para donaciones: NO usarlo).
 * Completamente idempotente: no borra ni pisa nada; si un módulo, permiso o
 * asignación ya existe, lo reutiliza tal como está.
 *
 * Crea:
 *  - Módulos públicos "/finales-felices" y "/camino-al-arcoiris" (TOPBAR, ALL).
 *  - Módulo admin "/historias" (ADMIN_SIDEBAR, ADMIN_ONLY) con permisos
 *    Leer/Crear/Actualizar asignados al rol Administrador.
 *
 * Los módulos se crean INACTIVOS: el menú solo muestra `is_active = true`, y
 * activarlos antes de desplegar el código rompería el sidebar (ícono no
 * registrado) y mostraría enlaces públicos que dan 404. Al desplegar, correr
 * con `--activar` para encender los tres.
 *
 * Correr con:  node prisma/seed-historias.mjs            (crea/reutiliza, inactivos)
 *              node prisma/seed-historias.mjs --activar  (además los activa)
 *
 * Las sesiones abiertas no ven los cambios de menú hasta volver a iniciar sesión.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_ROLE_ID = 1; // Rol "Administrador"
const ACTIVATE = process.argv.includes("--activar");

/** Siguiente `order` disponible dentro de una zona de navegación. */
async function nextOrder(nav_zone) {
  const { _max } = await prisma.module.aggregate({
    where: { nav_zone },
    _max: { order: true },
  });
  return (_max.order ?? 0) + 1;
}

/** Crea (si falta) un módulo; si existe, lo reutiliza sin modificarlo. */
async function ensureModule({ key, name, icon, nav_zone, nav_audience }) {
  const existing = await prisma.module.findFirst({ where: { key } });
  if (existing) return { mod: existing, created: false };

  const mod = await prisma.module.create({
    data: {
      key,
      name,
      icon,
      order: await nextOrder(nav_zone),
      is_active: false,
      nav_zone,
      nav_audience,
    },
  });
  return { mod, created: true };
}

/**
 * Crea (si faltan) los permisos Leer/Crear/Actualizar del módulo y los asigna
 * al rol Administrador. Mismo patrón que `ensureAdminModule` en seed.mjs.
 */
async function ensureAdminPermissions(mod) {
  for (const action of ["Leer", "Crear", "Actualizar"]) {
    let perm = await prisma.permission.findFirst({
      where: { module_id: mod.id, action },
    });
    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: `${action} ${mod.name}`,
          description: `Permite ${action.toLowerCase()} en ${mod.name}`,
          module_id: mod.id,
          action,
          created_in: new Date(),
        },
      });
    }

    const link = await prisma.permission_role.findFirst({
      where: { role_id: ADMIN_ROLE_ID, permission_id: perm.id },
    });
    if (!link) {
      await prisma.permission_role.create({
        data: {
          role_id: ADMIN_ROLE_ID,
          permission_id: perm.id,
          created_in: new Date(),
        },
      });
    }
  }
}

async function main() {
  const finales = await ensureModule({
    key: "/finales-felices",
    name: "Finales felices",
    icon: "LuHeart",
    nav_zone: "TOPBAR",
    nav_audience: "ALL",
  });
  const arcoiris = await ensureModule({
    key: "/camino-al-arcoiris",
    name: "Camino al arcoíris",
    icon: "LuRainbow",
    nav_zone: "TOPBAR",
    nav_audience: "ALL",
  });
  const historias = await ensureModule({
    key: "/historias",
    name: "Historias",
    icon: "LuBookHeart",
    nav_zone: "ADMIN_SIDEBAR",
    nav_audience: "ADMIN_ONLY",
  });
  await ensureAdminPermissions(historias.mod);

  const all = [finales, arcoiris, historias];

  if (ACTIVATE) {
    await prisma.module.updateMany({
      where: { id: { in: all.map(({ mod }) => mod.id) } },
      data: { is_active: true },
    });
  }

  const rows = await prisma.module.findMany({
    where: { id: { in: all.map(({ mod }) => mod.id) } },
    select: { id: true, key: true, name: true, order: true, is_active: true },
    orderBy: { id: "asc" },
  });
  const perms = await prisma.permission.findMany({
    where: { module_id: historias.mod.id },
    select: { id: true, action: true },
    orderBy: { id: "asc" },
  });

  console.log("\n✔ Seed de Historias");
  for (const r of rows) {
    const src = all.find(({ mod }) => mod.id === r.id);
    console.log(
      `  [${src.created ? "creado    " : "reutilizado"}] id=${r.id}  ${r.key}  ` +
        `"${r.name}"  order=${r.order}  activo=${r.is_active}`
    );
  }
  console.log(
    `  Permisos /historias: ${perms.map((p) => `${p.action}(${p.id})`).join(", ")}`
  );
  console.log(`\n  HISTORIAS_MODULE_ID = ${historias.mod.id}`);
  if (!ACTIVATE) {
    console.log("  (módulos sin activar; usar --activar al desplegar)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
