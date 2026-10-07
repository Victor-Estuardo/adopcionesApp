import type { gender_pet, Prisma, status_pet } from "@prisma/client";
import { CountPetsDb, listPetsWithImagesDb } from "~/services/db/pet.service";
import { PUBLIC_PET_STATUSES } from "~/utils/pet-helpers";
import { sanitizeLimit } from "~/utils/sanitize";

/*
 * Consulta del catálogo público de mascotas. La usa el loader de la portada
 * para que la lista llegue ya renderizada en el HTML (SEO) y se vuelva a
 * ejecutar cada vez que cambian los filtros o la página en la URL.
 */

const PAGE_SIZE = 20;

function ids(value: string | null): number[] | undefined {
  const list = (value || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return list.length ? list : undefined;
}

export async function listPublicPets(searchParams: URLSearchParams) {
  const page =
    sanitizeLimit(searchParams.get("page"), { min: 1, max: 10000 }) ?? 1;
  const search = searchParams.get("search")?.trim() || undefined;
  const genders = searchParams.get("gender") || undefined;
  const species = ids(searchParams.get("species"));
  const status = searchParams.get("status") || undefined;

  // Solo se aceptan los estados visibles al público
  const statuses = status
    ? (status.split(",") as status_pet[]).filter((s) =>
        PUBLIC_PET_STATUSES.includes(s),
      )
    : PUBLIC_PET_STATUSES;

  const where: Prisma.petWhereInput = {
    status: { in: statuses.length ? statuses : PUBLIC_PET_STATUSES },
    name: { contains: search, mode: "insensitive" },
    gender: genders ? { in: genders.split(",") as gender_pet[] } : undefined,
    pet_species_id: species ? { in: species } : undefined,
  };

  const [petListResponse, totalPetsResponse] = await Promise.all([
    listPetsWithImagesDb(where, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    CountPetsDb(where),
  ]);

  if (!petListResponse.success || !totalPetsResponse.success) return null;

  return {
    petList: petListResponse.data || [],
    totalPages: Math.ceil(totalPetsResponse.data / PAGE_SIZE),
    page,
  };
}
