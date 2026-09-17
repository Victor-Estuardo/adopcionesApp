import { gender_pet, petSpecies, Prisma, status_pet } from "@prisma/client";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { PrimaryButton } from "~/components/Button/primary";
import { PetCard } from "~/components/Card/PetCard";
import SearchInput from "~/components/Input/SearchInput";
import { Select } from "~/components/Input/Select";
import Pagination from "~/components/Pagination";
import { PetFormPanel } from "~/components/Panel/PetPanel";
import { config } from "~/config";
import { PermissionSession } from "~/services/auth/login.service";
import { deletePetImage } from "~/services/cloudinary/delete";
import { uploadPetImage } from "~/services/cloudinary/upload";
import {
  CountPetsDb,
  createPetDb,
  listPetsWithImagesDb,
  PetWithImage,
} from "~/services/db/pet.service";
import {
  createManyPetImagesDb,
  deleteManyPetImagesDb,
  listPetImagesDb,
} from "~/services/db/petImages.service";
import { listPetSpeciesDb } from "~/services/db/petSpecies.service";
import prisma from "~/services/db/prisma";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";
import { getPetStatusConfig, PET_STATUS_OPTIONS } from "~/utils/pet-helpers";

export const meta = () => {
  return [{ title: "MASCOTAS" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // Verificamos que tenga permiso de Leer "mascotas";
  const validateRequest = validatePermission(session, 9, "Leer");
  if (validateRequest) throw validateRequest;

  // Obtenemos los parametros de la url
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Información de paginación
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");

  // Información de filtros
  const search = searchParams.get("search") || undefined;
  const gender = searchParams.get("gender") || undefined;
  const specie = searchParams.get("specie") || undefined;
  const status = searchParams.get("status") || undefined;

  // Filtro para la llamada de lista de mascotas
  const whereListPets: Prisma.petWhereInput = {
    status: status ? (status as status_pet) : undefined,
    name: { contains: search, mode: "insensitive" },
    gender: { equals: gender as gender_pet | undefined },
    pet_species_id: { equals: specie ? Number(specie) : undefined },
  };

  // Listar mascotas disponibles
  const [petListResponse, totalPetsResponse, speciesResponse] =
    await Promise.all([
      listPetsWithImagesDb(whereListPets, (page - 1) * limit, limit),
      CountPetsDb(whereListPets),
      listPetSpeciesDb({ active: true }),
    ]);

  if (
    !petListResponse.success ||
    !totalPetsResponse.success ||
    !speciesResponse.success
  ) {
    return json({
      errorMsg: "Ocurrió un error al cargar la pagina",
    });
  }

  // Obtenemos los permisos
  const permissions: PermissionSession[] = session.get("permissions") || [];

  return json({
    petList: petListResponse.data || [],
    totalPets: totalPetsResponse.data,
    totalPages: Math.ceil(totalPetsResponse.data / limit),
    allowedToCreate: !!permissions.find(
      (p) => p.module_id == 9 && p.action === "Crear",
    ),
    allowedToUpdate: !!permissions.find(
      (p) => p.module_id == 9 && p.action === "Actualizar",
    ),
    species: speciesResponse.data,
    cloudName: config.cloudinaryCloudName,
  });
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  //=============| Datos del POST |==============================//
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const userId = session.get("dbUserId");

  const formData = await request.formData();
  const intent = formData.get("intent");

  function parsePetFields(fd: FormData) {
    return {
      name: String(fd.get("name")),
      gender: fd.get("gender") as gender_pet,
      pet_species_id: Number(fd.get("pet_species_id")),
      birthdate: new Date(String(fd.get("birthdate"))),
      size: String(fd.get("size")),
      color: String(fd.get("color")),
      vaccinated: fd.get("vaccinated") === "on",
      sterilized: fd.get("sterilized") === "on",
      description: (fd.get("description") as string) || null,
      race: (fd.get("race") as string) || null,
    };
  }

  if (intent === "create") {
    // Verificamos que tenga permiso de Leer "mascotas";
    const validateRequest = validatePermission(session, 9, "Crear");
    if (validateRequest) throw validateRequest;

    // Creamos a la mascota
    const petData = parsePetFields(formData);

    const newPetRes = await createPetDb({
      ...petData,
      creation_date: new Date(),
      update_date: new Date(),
      creator_id: userId,
      updater_id: userId,
    });

    if (!newPetRes.success) {
      return json({
        errorMsg: "Ocurrió un error al crear la mascota",
      });
    }

    const newPet = newPetRes.data;

    // Guardamos imagenes
    const files = (formData.getAll("images") as File[]).filter(
      (f) => f.size > 0,
    );
    const uploaded = await Promise.all(
      files.map((file) => uploadPetImage(file, newPet.id)),
    );

    if (uploaded.length) {
      await createManyPetImagesDb(
        uploaded.map((img) => ({
          pet_id: newPet.id,
          path: img.success ? img.data.public_id : "",
          creation_date: new Date(),
          update_date: new Date(),
          creator_id: userId,
          updater_id: userId,
        })),
      );
    }

    return json({ create_pet: true });
  }

  if (intent === "update") {
    const validateRequest = validatePermission(session, 9, "Actualizar");
    if (validateRequest) throw validateRequest;

    const petId = Number(formData.get("id"));
    const petData = parsePetFields(formData);

    // 1. Borrar imágenes marcadas para eliminar (Cloudinary + BD)
    const deletedIds = formData.getAll("deleted_image_ids").map(Number);
    if (deletedIds.length) {
      const toDeleteRes = await listPetImagesDb({
        id: { in: deletedIds },
        pet_id: petId,
      });
      if (!toDeleteRes.success)
        return json({ errorMsg: "Ocurrió un error al actualizar los datos" });

      const toDelete = toDeleteRes.data;
      await Promise.all(toDelete.map((img) => deletePetImage(img.path)));
      await deleteManyPetImagesDb({ id: { in: deletedIds } });
    }

    // 2. Subir imágenes nuevas
    const files = (formData.getAll("images") as File[]).filter(
      (f) => f.size > 0,
    );
    const uploaded = await Promise.all(
      files.map((file) => uploadPetImage(file, petId)),
    );

    // 3. Actualizar datos de la mascota + insertar nuevas imágenes en una transacción
    try {
      await prisma.$transaction([
        prisma.pet.update({
          where: { id: petId },
          data: { ...petData, update_date: new Date(), updater_id: userId },
        }),
        ...(uploaded.length
          ? [
              prisma.pet_images.createMany({
                data: uploaded.map((img) => ({
                  pet_id: petId,
                  path: img.success ? img.data.public_id : "",
                  creation_date: new Date(),
                  update_date: new Date(),
                  creator_id: userId,
                  updater_id: userId,
                })),
              }),
            ]
          : []),
      ]);
    } catch (error) {
      console.error("Error al actualizar la mascota:", error);
      return json({ errorMsg: "Ocurrió un error al actualizar los datos" });
    }

    return json({ update_pet: true });
  }

  if (intent === "update-status") {
    const validateRequest = validatePermission(session, 9, "Actualizar");
    if (validateRequest) throw validateRequest;

    try {
      await prisma.pet.update({
        where: { id: Number(formData.get("id")) },
        data: {
          status: formData.get("status") as status_pet,
          update_date: new Date(),
          updater_id: userId,
        },
      });
    } catch (error) {
      console.error("Error al actualizar el estado de la mascota:", error);
      return json({
        errorMsg: "Ocurrió un error al actualizar el estado de la mascota",
      });
    }

    return json({ success: true });
  }
};

/*==============================| Component |==============================*/
export default function () {
  // Hooks...
  const {
    petList,
    totalPets,
    totalPages,
    allowedToCreate,
    allowedToUpdate,
    species,
    cloudName,
  } = useLoaderData();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const fetcher = useFetcher();

  // Para cambio de texto de busqueda
  const [q, setQ] = useState("");

  // Para filtros
  const hasActiveFilters = Boolean(searchParams.toString());

  // Paginación
  const page = Number(searchParams.get("page") || "1");

  // Banderas
  const [panelOpen, setPanelOpen] = useState(false);
  const isNavigating = navigation.state === "loading";

  // Para info de mascota
  const [editingPet, setEditingPet] = useState<PetWithImage | null>(null);

  /*------------------------------EFECTOS------------------------------*/
  // Debounce del texto de búsqueda antes de reflejarlo en la URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q) next.set("search", q);
          else next.delete("search");
          next.delete("page");
          return next;
        },
        { preventScrollReset: true },
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [q]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función para modificar los parametros
  function updateParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { preventScrollReset: true },
    );
  }

  // Cambiar de pagina
  function goToPage(next: number) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("page", String(next));
        return params;
      },
      { preventScrollReset: false },
    );
  }

  // Si esta vacia la lista
  function EmptyState({ hasFilters }: { hasFilters: boolean }) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E4E0D6] py-16 text-center">
        <p className="font-medium text-[#1F1D1A]">
          {hasFilters
            ? "Ningún resultado con estos filtros"
            : "Todavía no hay mascotas registradas"}
        </p>
        <p className="max-w-xs text-sm text-[#8A8577]">
          {hasFilters
            ? "Ajusta o limpia los filtros para ver más resultados."
            : "Crea la primera mascota para que aparezca en el catálogo de adopción."}
        </p>
        {!hasFilters && (
          <button
            onClick={openCreate}
            className="mt-1 rounded-xl bg-[#1F1D1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A362E]"
          >
            Nueva mascota
          </button>
        )}
      </div>
    );
  }

  // Función para abrir panel nueva mascota
  function openCreate() {
    setEditingPet(null);
    setPanelOpen(true);
  }

  //función para abrir panel de editar mascota
  function openEdit(id: number) {
    const found = petList.find((p: any) => p.id === id) ?? null;
    setEditingPet(found);
    setPanelOpen(true);
  }

  // Función para cambiar el estado de una mascota (Disponible, En tratamiento, etc.)
  function onChangeStatus(id: number, status: status_pet) {
    const fd = new FormData();
    fd.set("intent", "update-status");
    fd.set("id", String(id));
    fd.set("status", status);
    fetcher.submit(fd, { method: "POST", encType: "multipart/form-data" });
  }

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-6 md:gap-3">
        <h1 className="order-1 md:hidden text-xl font-bold">Mascotas</h1>
        <h2 className="hidden md:block order-3 md:order-1 text-gray-400">
          Gestiona el catálogo de mascotas disponibles para adopción.
        </h2>
        {allowedToCreate && (
          <PrimaryButton
            className="order-2 md:order-2"
            label="Nueva Mascota"
            Icon={LuPlus}
            onClick={openCreate}
          />
        )}
      </div>

      <div className="flex flex-col gap-6 md:gap-3 pb-3 md:flex-row md:items-center">
        <SearchInput
          placeholder="Buscar por nombre..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="grid grid-cols-2 md:flex md:items-center gap-x-6 gap-y-4">
          <Select
            id="specie"
            name="specie"
            className="w-full md:w-auto"
            value={searchParams.get("specie") ?? ""}
            onChange={(e) => updateParam("specie", e.target.value)}
          >
            <option value="">Toda especie</option>
            {species.map((s: petSpecies) => (
              <option value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select
            id="state"
            name="state"
            className="w-full md:w-auto"
            value={searchParams.get("status") ?? ""}
            onChange={(e) => updateParam("status", e.target.value)}
          >
            <option value="">Todo estado</option>
            {PET_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            id="gender"
            name="gender"
            className="w-full md:w-auto"
            value={searchParams.get("gender") ?? ""}
            onChange={(e) => updateParam("gender", e.target.value)}
          >
            <option value="">Todo género</option>
            <option value="Macho">Macho</option>
            <option value="Hembra">Hembra</option>
          </Select>
          {hasActiveFilters && (
            <div className="md:ml-auto flex justify-center items-center">
              <button
                className="text-sm px-3 py-1 text-emerald-600 hover:text-emerald-700"
                onClick={() => {
                  setQ("");
                  setSearchParams({}, { preventScrollReset: true });
                }}
              >
                Limpiar
              </button>
            </div>
          )}
          <span className="col-span-2 px-1 md:px-0 text-sm text-gray-400 whitespace-nowrap">
            {totalPets} {totalPets === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onChangePage={goToPage}
      />
      {petList.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} />
      ) : (
        <div
          className={`flex-grow grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(400px,1fr))] md:gap-x-16 gap-y-7 md:gap-y-11 justify-items-center ${
            isNavigating ? "opacity-60" : "opacity-100"
          }`}
        >
          {petList.map((pet: PetWithImage, index: number) => {
            const statusConfig = getPetStatusConfig(pet.status);
            return (
              <PetCard
                key={`${index}_${pet.name}`}
                pet={pet}
                healthStatus
                petTagNub
                cloudName={cloudName}
              >
                <div className="flex flex-col gap-2 border-t border-[#F0EDE5] pt-3">
                  {allowedToUpdate && (
                    <>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`status-${pet.id}`}
                          className="text-xs font-medium text-[#8A8577] whitespace-nowrap"
                        >
                          Estado
                        </label>
                        <select
                          id={`status-${pet.id}`}
                          value={pet.status}
                          onChange={(e) =>
                            onChangeStatus(pet.id, e.target.value as status_pet)
                          }
                          className={`flex-1 cursor-pointer rounded-lg border-0 px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-medium-turquoise-meraki/50 ${statusConfig.bg} ${statusConfig.color}`}
                        >
                          {PET_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(pet.id)}
                        className="w-full rounded-lg border border-medium-turquoise-meraki px-3 py-1.5 text-sm font-medium text-medium-turquoise-meraki transition-colors hover:bg-medium-turquoise-meraki/10"
                      >
                        Editar
                      </button>
                    </>
                  )}
                </div>
              </PetCard>
            );
          })}
        </div>
      )}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onChangePage={(page) => goToPage(page)}
      />

      <PetFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        species={species}
        pet={editingPet ?? undefined}
        cloudName={cloudName}
      />
    </div>
  );
}
