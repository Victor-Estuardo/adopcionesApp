/**
 * Seed del módulo de Donaciones.
 *
 * Reproduce los datos de ejemplo del mockup (`mockup/meraki-donaciones-mockup.html`):
 * mismos insumos, patrocinadores, proyectos y donaciones que se ven ahí, para poder
 * comparar visualmente el resultado real contra el mockup en las siguientes fases.
 *
 * Es idempotente para el módulo: borra y recrea patrocinadores, proyectos, fotos,
 * insumos y donaciones en cada corrida. NO toca usuarios, mascotas ni otros módulos.
 * Las cuentas bancarias solo se crean si la tabla está vacía (no se pisan las existentes).
 *
 * Correr con:  npx prisma db seed   ·   o:  node prisma/seed.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Usuarios ya existentes en la base de desarrollo
const ADMIN_ID = 1; // Admin Meraki (revisor / creador de catálogos)
const VICTOR_ID = 3; // Victor Lopez, vl40509@gmail.com (donante registrado)
const ADMIN_ROLE_ID = 1; // Rol "Administrador" (its_administrative = true)

/**
 * Crea (si falta) un módulo administrativo para una pantalla del módulo de
 * donaciones, con sus permisos Leer/Crear/Actualizar, y los asigna al rol
 * Administrador. Idempotente: no duplica módulo, permisos ni asignaciones.
 * El proyecto NO usa migraciones; los módulos admin (Mascotas=9, Roles=11...)
 * viven en la BD, así que las pantallas nuevas necesitan su fila aquí para que
 * `validatePermission` tenga contra qué validar.
 */
async function ensureAdminModule({ key, name, icon, order }) {
  let mod = await prisma.module.findFirst({ where: { key } });
  if (!mod) {
    mod = await prisma.module.create({
      data: {
        key,
        name,
        icon,
        order,
        is_active: true,
        nav_zone: "ADMIN_SIDEBAR",
        nav_audience: "ADMIN_ONLY",
      },
    });
  }

  for (const action of ["Leer", "Crear", "Actualizar"]) {
    let perm = await prisma.permission.findFirst({
      where: { module_id: mod.id, action },
    });
    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: `${action} ${name}`,
          description: `Permite ${action.toLowerCase()} en ${name}`,
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

  return mod;
}

async function main() {
  /*── 1. Limpiar datos del módulo (orden que respeta las FKs) ──────────────*/
  await prisma.project_photo.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.sponsor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.needSupplies.deleteMany();

  /*── 2. Cuentas bancarias (solo si no hay ninguna) ───────────────────────*/
  if ((await prisma.donationBankAccount.count()) === 0) {
    await prisma.donationBankAccount.createMany({
      data: [
        {
          bank_name: "Banrural",
          account_type: "Ahorro",
          account_number: "12345678901234",
          account_holder: "MERAKI",
          active: true,
          creator_id: ADMIN_ID,
          updater_id: ADMIN_ID,
        },
        {
          bank_name: "BI",
          account_type: "Monetaria",
          account_number: "12342372398579",
          account_holder: "MERAKI",
          active: true,
          creator_id: ADMIN_ID,
          updater_id: ADMIN_ID,
        },
      ],
    });
  }
  const accounts = await prisma.donationBankAccount.findMany();
  const banrural = accounts.find((a) => a.bank_name === "Banrural") ?? accounts[0];
  const bi = accounts.find((a) => a.bank_name === "BI") ?? accounts[0];

  /*── 3. Insumos necesitados (sección "¿Qué necesitamos ahora mismo?") ────*/
  await prisma.needSupplies.createMany({
    data: [
      "Alimento concentrado para gato",
      "Antipulgas y desparasitantes",
      "Cobijas y toallas",
      "Arena sanitaria",
    ].map((description) => ({
      description,
      active: true,
      creator_id: ADMIN_ID,
      updater_id: ADMIN_ID,
    })),
  });

  /*── 4. Patrocinadores ──────────────────────────────────────────────────*/
  const alfa = await prisma.sponsor.create({
    data: {
      name: "Constructora Alfa",
      website: "constructoraalfa.gt",
      contact: "proyectos@alfa.gt",
      active: true,
      creator_id: ADMIN_ID,
      updater_id: ADMIN_ID,
    },
  });
  const pilar = await prisma.sponsor.create({
    data: {
      name: "Ferretería El Pilar",
      website: "ferreteriaelpilar.com",
      contact: "contacto@elpilar.gt",
      active: true,
      creator_id: ADMIN_ID,
      updater_id: ADMIN_ID,
    },
  });
  const sanRoque = await prisma.sponsor.create({
    data: {
      name: "Veterinaria San Roque",
      website: "vetsanroque.gt",
      active: true,
      creator_id: ADMIN_ID,
      updater_id: ADMIN_ID,
    },
  });

  /*── 5. Proyectos + galería antes/después ───────────────────────────────*/
  const foto = (slug, category) => ({
    url: `https://picsum.photos/seed/${slug}/800/600`,
    category,
    creator_id: ADMIN_ID,
    updater_id: ADMIN_ID,
  });

  const albergue = await prisma.project.create({
    data: {
      name: "Reconstrucción del albergue",
      description:
        "Reparación del techo y muro perimetral dañados por las lluvias de este año.",
      goal: "Q8,000 en materiales",
      progress: 65,
      status: "Activo",
      creator_id: ADMIN_ID,
      updater_id: ADMIN_ID,
      project_photo: {
        create: [
          foto("albergue-antes", "Antes"),
          foto("albergue-despues", "Despu_s"),
        ],
      },
    },
  });
  const caniles = await prisma.project.create({
    data: {
      name: "Ampliación de caniles",
      description:
        "Construcción de 6 caniles adicionales para reducir el hacinamiento del refugio.",
      status: "Finalizado",
      creator_id: ADMIN_ID,
      updater_id: ADMIN_ID,
      project_photo: {
        create: [
          foto("caniles-antes", "Antes"),
          foto("caniles-despues", "Despu_s"),
        ],
      },
    },
  });

  /*── 6. Donaciones (equivalentes al array `donations` del mockup) ────────*/
  const donations = [
    // 1 · Donante registrado, en especie, pública con nombre
    {
      user_id: VICTOR_ID,
      donor_name: "Victor",
      donor_email: "vl40509@gmail.com",
      donation_type: "Especie",
      item_description: "2 arrobas de alimento para gato",
      status: "confirmada",
      is_public: true,
      comment: "Espero que ayude en algo",
      reviewed_by: ADMIN_ID,
      submitted_at: new Date("2026-07-25T15:00:00Z"),
      updated_at: new Date("2026-07-26T15:00:00Z"),
    },
    // 2 · Monetaria confirmada, pública pero anónima
    {
      donor_name: "Lucía Herrera",
      donor_email: "lucia.herrera@example.com",
      donation_type: "Monetaria",
      declared_amount: 1000,
      confirmed_amount: 1000,
      bank_account_id: banrural.id,
      status: "confirmada",
      is_public: true,
      is_anonymous: true,
      comment: "Para que los animalitos sean felices",
      reviewed_by: ADMIN_ID,
      submitted_at: new Date("2026-07-23T15:00:00Z"),
      updated_at: new Date("2026-07-24T15:00:00Z"),
    },
    // 3 · Monetaria notificada por el donante, pendiente de revisión
    {
      donor_name: "María Reyes",
      donor_email: "maria@example.com",
      donation_type: "Monetaria",
      declared_amount: 250,
      bank_account_id: bi.id,
      reference_number: "REF-20260830-0250",
      status: "pendiente",
      submitted_at: new Date("2026-08-30T15:00:00Z"),
      updated_at: new Date("2026-08-30T15:00:00Z"),
    },
    // 4 · Patrocinador, en especie, en coordinación de entrega
    {
      patrocinador_id: pilar.id,
      proyecto_id: albergue.id,
      donation_type: "Especie",
      item_description: "40 láminas de zinc y 15 sacos de cemento",
      status: "coordinacion",
      is_public: true,
      submitted_at: new Date("2026-08-28T15:00:00Z"),
      updated_at: new Date("2026-08-28T15:00:00Z"),
    },
    // 5 · Patrocinador, en especie, confirmada
    {
      patrocinador_id: alfa.id,
      proyecto_id: albergue.id,
      donation_type: "Especie",
      item_description: "Mano de obra y block para muro perimetral",
      status: "confirmada",
      is_public: true,
      reviewed_by: ADMIN_ID,
      submitted_at: new Date("2026-08-10T15:00:00Z"),
      updated_at: new Date("2026-08-11T15:00:00Z"),
    },
    // 6 · Monetaria rechazada con motivo
    {
      donor_name: "Josué Marroquín",
      donor_email: "josue.m@example.com",
      donation_type: "Monetaria",
      declared_amount: 500,
      bank_account_id: banrural.id,
      status: "rechazada",
      rejection_reason: "No se identificó el depósito en el estado de cuenta",
      reviewed_by: ADMIN_ID,
      submitted_at: new Date("2026-08-18T15:00:00Z"),
      updated_at: new Date("2026-08-19T15:00:00Z"),
    },
    // 7 · Añadida: da respaldo al patrocinador que el mockup muestra en
    //     "Ampliación de caniles" pero deja sin donación de ejemplo.
    {
      patrocinador_id: sanRoque.id,
      proyecto_id: caniles.id,
      donation_type: "Especie",
      item_description: "Jornada de esterilización y vacunación",
      status: "confirmada",
      is_public: true,
      reviewed_by: ADMIN_ID,
      submitted_at: new Date("2026-07-15T15:00:00Z"),
      updated_at: new Date("2026-07-16T15:00:00Z"),
    },
  ];

  for (const data of donations) {
    await prisma.donation.create({ data });
  }

  /*── 7. Módulos admin del dominio de donaciones (para validatePermission) ─*/
  const patrocinadoresMod = await ensureAdminModule({
    key: "/patrocinadores",
    name: "Patrocinadores",
    icon: "LuBuilding",
    order: 13,
  });
  const proyectosMod = await ensureAdminModule({
    key: "/proyectos",
    name: "Proyectos",
    icon: "LuImage",
    order: 14,
  });
  const donacionesMod = await ensureAdminModule({
    key: "/donaciones",
    name: "Donaciones",
    icon: "BiSolidDonateHeart",
    order: 15,
  });
  const estadisticasMod = await ensureAdminModule({
    key: "/estadisticas",
    name: "Estadísticas",
    icon: "MdBarChart",
    order: 16,
  });

  /*── Resumen ────────────────────────────────────────────────────────────*/
  const [nBanks, nInsumos, nSponsors, nProjects, nPhotos, nDonations] =
    await Promise.all([
      prisma.donationBankAccount.count(),
      prisma.needSupplies.count(),
      prisma.sponsor.count(),
      prisma.project.count(),
      prisma.project_photo.count(),
      prisma.donation.count(),
    ]);
  console.log("Seed de donaciones aplicado:");
  console.table({
    cuentasBancarias: nBanks,
    insumosNecesitados: nInsumos,
    patrocinadores: nSponsors,
    proyectos: nProjects,
    fotosProyecto: nPhotos,
    donaciones: nDonations,
  });
  console.log(`Módulo admin "Patrocinadores" -> id ${patrocinadoresMod.id}`);
  console.log(`Módulo admin "Proyectos" -> id ${proyectosMod.id}`);
  console.log(`Módulo admin "Donaciones" -> id ${donacionesMod.id}`);
  console.log(`Módulo admin "Estadísticas" -> id ${estadisticasMod.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
