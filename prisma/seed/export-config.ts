/**
 * Exporta los datos de configuración de la BD apuntada por DATABASE_URL a
 * prisma/seed/data/*.json. Úsalo después de agregar módulos, permisos, roles,
 * especies o preguntas del formulario, y commitea los JSON junto con la migración.
 *
 *   npm run db:export-config
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const dir = join(__dirname, "data");

async function main() {
  mkdirSync(dir, { recursive: true });

  const tablas = {
    role: await prisma.role.findMany({ orderBy: { id: "asc" } }),
    module: await prisma.module.findMany({ orderBy: { id: "asc" } }),
    permission: await prisma.permission.findMany({ orderBy: { id: "asc" } }),
    permission_role: await prisma.permission_role.findMany({ orderBy: { id: "asc" } }),
    petSpecies: await prisma.petSpecies.findMany({ orderBy: { id: "asc" } }),
    formQuestion: await prisma.formQuestion.findMany({
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    }),
  };

  for (const [nombre, filas] of Object.entries(tablas)) {
    writeFileSync(join(dir, `${nombre}.json`), JSON.stringify(filas, null, 2) + "\n");
    console.log(`${nombre}: ${filas.length} filas`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
