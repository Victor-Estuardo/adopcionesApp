import { ActionFunction, json } from "@remix-run/node";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import SearchInput from "~/components/Input/SearchInput";
import {
  CountPetsDb,
  listPetsWithImagesDb,
  PetWithImage,
} from "~/services/db/pet.service";
import { IoCheckmark, IoCloseOutline, IoFilterOutline } from "react-icons/io5";
import Pagination from "~/components/Pagination";
import { gender_pet, Prisma, status_pet } from "@prisma/client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";
import { RiArrowDropDownLine } from "react-icons/ri";
import ListWithChek from "~/components/List/ListWithChek";
import { listPetSpeciesDb } from "~/services/db/petSpecies.service";
import { SecondaryButton } from "~/components/Button/secondary";
import { PetCard } from "~/components/Card/PetCard";
import { config } from "~/config";
import { PUBLIC_PET_STATUSES } from "~/utils/pet-helpers";
import { PrimaryButton } from "~/components/Button/primary";

export const meta = () => {
  return [{ title: "MASCOTAS" }];
};

/*==============================| Types |==============================*/
interface FilterOption {
  value: string;
  label: string;
}

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    // Obtenemos la lista de categeorias de mascotas
    const petSpeciesResponse = await listPetSpeciesDb({ active: true });

    if (!petSpeciesResponse.success) {
      return json({
        errorMsg: "Ocurrió un error al cargar la pagina",
      });
    }

    // creamos el filtro de especies
    const speciesFilter: FilterOption[] = petSpeciesResponse.data.map(
      (specie) => ({
        value: specie.id.toString(),
        label: specie.name,
      }),
    );

    return json({
      species_filter: speciesFilter,
      cloudName: config.cloudinaryCloudName,
    });
  }

  if (action === "loadPets") {
    let data: {
      page?: number;
      search?: string;
      gender?: string;
      species?: string;
      status?: string;
    } | null = null;

    if (typeof payload === "string") data = JSON.parse(payload);

    // Obtenemos los parametros de la url
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Información de paginación
    const page = Number(data?.page || searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");

    // Información de filtros
    const search = (data?.search ?? searchParams.get("search")) || undefined;
    const genders = (data?.gender ?? searchParams.get("gender")) || undefined;
    const species = (data?.species ?? searchParams.get("species")) || undefined;
    const status = (data?.status ?? searchParams.get("status")) || undefined;

    // Filtro para la llamada de lista de mascotas
    const whereListPets: Prisma.petWhereInput = {
      status: {
        in: status ? (status.split(",") as status_pet[]) : PUBLIC_PET_STATUSES,
      },
      name: { contains: search, mode: "insensitive" },
      gender: genders ? { in: genders.split(",") as gender_pet[] } : undefined,
      pet_species_id: species
        ? { in: species.split(",").map(Number) }
        : undefined,
    };

    // Listar mascotas disponibles
    const [petListResponse, totalPetsResponse] = await Promise.all([
      listPetsWithImagesDb(whereListPets, (page - 1) * limit, limit),
      CountPetsDb(whereListPets),
    ]);

    if (!petListResponse.success || !totalPetsResponse.success) {
      return json({
        errorMsg: "Ocurrió un error al cargar la pagina",
      });
    }

    return json({
      petList: petListResponse.data || [],
      totalPages: Math.ceil(totalPetsResponse.data / limit),
    });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados de la pagina
  const [loadingPets, setLoadingPets] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Para vista de filtros
  const [filterView, setFilterView] = useState("");

  // Para filtros
  const [searchText, setSearchText] = useState(
    searchParams.get("search") || "",
  );
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const genderFilter = useMemo<FilterOption[]>(
    () => [
      { value: "Macho", label: "Macho" },
      { value: "Hembra", label: "Hembra" },
    ],
    [],
  );
  const [speciesFilter, setSpeciesFilter] = useState<FilterOption[]>([]);
  const statusFilter = useMemo(() => {
    return PUBLIC_PET_STATUSES.map((v) => ({
      label: v.replace("_", " "),
      value: v,
    }));
  }, []);

  // Para selecciones de filtros, se = selected
  const [seGenderFilter, setSeGenderFilter] = useState<string[]>(
    (searchParams.get("gender") || "").split(",").filter(Boolean),
  );
  const [seSpeciesFilter, setSeSpeciesFilter] = useState<string[]>(
    (searchParams.get("species") || "").split(",").filter(Boolean),
  );
  const [seStatusFilter, setSeStatusFilter] = useState<string[]>(
    (searchParams.get("status") || "").split(",").filter(Boolean),
  );

  // Lista de mascotas
  const [petList, setpetList] = useState<PetWithImage[]>([]);
  const [cloudName, setCloudName] = useState("");

  // Paginación
  const page = Number(searchParams.get("page") || "1");
  const [totalPages, setTotalPages] = useState(0);

  // Cantidad total de filtros activos (para el badge del botón "Filtro")
  const activeFiltersCount =
    seGenderFilter.length + seSpeciesFilter.length + seStatusFilter.length;

  const hasActiveFilters = activeFiltersCount > 0;

  /*------------------------------CARGA DE CATÁLOGOS------------------------------*/
  useEffect(() => {
    fetcher.submit(
      {
        action: "loadInformation",
      },
      { method: "post" },
    );
  }, []);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    // Mensaje de error durante algun proceso
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setLoadingPets(false);
    }

    // Filtros
    if (fetcher.data?.species_filter) {
      setSpeciesFilter(fetcher.data.species_filter);
      handleLoadPets({});
    }

    if (fetcher.data?.cloudName) {
      setCloudName(fetcher.data.cloudName);
    }

    if (fetcher.data?.petList) {
      const list = fetcher.data.petList;
      setpetList(list);
      setTotalPages(fetcher.data?.totalPages || 0);
      setLoadingPets(false);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función que maneja el cambio en el filtro de texto
  const handleChangeSearch = (search: string) => {
    // Guardamos los cambios
    setSearchText(search);

    // limpiamos y creamos el debounce para la busqueda
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    const timeoutId = setTimeout(() => {
      handleLoadPets({ search, page: "1" });
    }, 500);
    setDebounceTimeout(timeoutId);
  };

  // Función que maneja la carga de mascotas
  const handleLoadPets = (params: Record<string, string>) => {
    setSearchParams((prev) => {
      for (const [key, value] of Object.entries(params)) {
        if (!value) prev.delete(key);
        else prev.set(key, value);
      }
      return prev;
    });

    setLoadingPets(true);
    fetcher.submit(
      {
        action: "loadPets",
        payload: JSON.stringify({
          ...params,
        }),
      },
      { method: "post" },
    );
  };

  // Función que maneja el click de los filtros
  const handleClickFilter = (type: string, value: string | number) => {
    // Mapeamos los filtros internos
    const setFilterMaps: { [x: string]: Dispatch<SetStateAction<string[]>> } = {
      gender: setSeGenderFilter,
      species: setSeSpeciesFilter,
      status: setSeStatusFilter,
    };

    const val = String(value);

    //Obtenemos los filtros actuales
    let values = searchParams.get(type)?.split(",") || [];

    if (values.includes(val)) {
      values = values.filter((v) => v !== val);
    } else {
      values.push(val);
    }

    setFilterMaps[type](values);
    handleLoadPets({ [type]: values.join(","), page: "1" });
  };

  // Función que limpia un solo grupo de filtros (Género / Especie / Estado)
  const handleClearGroup = (type: string) => {
    const setFilterMaps: { [x: string]: Dispatch<SetStateAction<string[]>> } = {
      gender: setSeGenderFilter,
      species: setSeSpeciesFilter,
      status: setSeStatusFilter,
    };
    setFilterMaps[type]([]);
    handleLoadPets({ [type]: "", page: "1" });
  };

  // Función que limpia todos los filtros y la búsqueda de una sola vez
  const handleClearAllFilters = () => {
    setSeGenderFilter([]);
    setSeSpeciesFilter([]);
    setSeStatusFilter([]);
    setSearchText("");

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    handleLoadPets({
      gender: "",
      species: "",
      status: "",
      search: "",
      page: "1",
    });
  };

  // Si esta vacia la lista
  function EmptyState() {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E4E0D6] py-16 text-center">
        <p className="font-medium text-[#1F1D1A]">
          {hasActiveFilters
            ? "Ningún resultado con estos filtros"
            : "Todavía no hay mascotas registradas"}
        </p>
        <p className="max-w-xs text-sm text-[#8A8577]">
          {hasActiveFilters
            ? "Ajusta o limpia los filtros para ver más resultados."
            : "Pronto estará la primera mascota disponible en el catálogo de adopción."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-y-3 md:gap-y-0">
          <h1 className="justify-self-start text-blue-meraki text-xl md:text-3xl font-bold">
            Adopta una mascota
          </h1>
          <div className="w-full md:w-auto flex gap-x-3 justify-self-start md:justify-self-end">
            <SearchInput
              placeholder="Buscar por nombre..."
              value={searchText}
              onChange={(e) => handleChangeSearch(e.target.value)}
              isClearable
              onClearable={() => handleChangeSearch("")}
            />
            <button
              className={`flex justify-center items-center gap-x-2 px-2 py-1 border rounded-lg text-[.75rem] md:text-base font-medium transition-colors ${
                hasActiveFilters
                  ? "border-blue-meraki text-blue-meraki bg-blue-meraki/5"
                  : "border-gray-200 text-gray-700 hover:border-blue-meraki hover:bg-blue-meraki/5"
              }`}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <IoFilterOutline />
              Filtros
              {hasActiveFilters && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-meraki text-white text-[.7rem] font-semibold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {/* Acceso rápido para limpiar todo, visible solo si hay algo activo */}
            {(hasActiveFilters || searchText) && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="hidden md:flex items-center gap-x-1 text-xs md:text-base text-gray-500 hover:text-blue-meraki transition-colors hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onChangePage={(page) => handleLoadPets({ page: page.toString() })}
        />
        {loadingPets ? (
          <div className="flex-grow flex justify-center items-center">
            <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
          </div>
        ) : petList.length == 0 ? (
          <EmptyState />
        ) : (
          <div className="flex-grow grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(350px,1fr))] md:gap-x-16 gap-y-7 md:gap-y-11 justify-items-center">
            {petList.map((pet, index) => (
              <PetCard
                key={`${index}_${pet.name}`}
                pet={pet}
                onClickCard={() =>
                  (window.location.href = `/mascota/${pet.id}`)
                }
                cloudName={cloudName}
                petTagNub
              >
                <div className="flex justify-center items-center border-t border-[#F0EDE5] pt-3">
                  <SecondaryButton
                    label="Ver"
                    borderColor="border-blue-meraki"
                    textColor="white"
                    width="w-[80%]"
                  />
                </div>
              </PetCard>
            ))}
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onChangePage={(page) => handleLoadPets({ page: page.toString() })}
        />
      </div>
      {showFilters && (
        <aside
          className="fixed right-0 bottom-0 w-full h-[calc(100dvh-5rem)] bg-black/60 flex justify-end"
          onClick={() => {
            setShowFilters(false);
            setFilterView("");
          }}
        >
          <div
            className="h-full w-3/4 md:w-[20%] flex flex-col gap-y-3 bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-blue-meraki">Filtros</h2>
              <button
                aria-label="Cerrar filtros"
                onClick={() => {
                  setShowFilters(false);
                  setFilterView("");
                }}
                className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between px-5 py-3 bg-blue-meraki/5 border-b border-gray-100">
                <span className="text-xs text-gray-600">
                  {activeFiltersCount}{" "}
                  {activeFiltersCount === 1
                    ? "filtro activo"
                    : "filtros activos"}
                </span>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-blue-meraki hover:underline"
                >
                  Limpiar todo
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto md:px-5 py-3 flex flex-col gap-y-3">
              <FilterSection
                title="Género"
                isOpen={filterView === "gender"}
                onToggle={() =>
                  setFilterView(filterView === "gender" ? "" : "gender")
                }
                activeCount={seGenderFilter.length}
                onClear={() => handleClearGroup("gender")}
              >
                <ListWithChek
                  ulId="filter_gender"
                  list={genderFilter}
                  selections={seGenderFilter}
                  onClickLi={(v) => handleClickFilter("gender", v)}
                />
              </FilterSection>

              <FilterSection
                title="Especie"
                isOpen={filterView === "specie"}
                onToggle={() =>
                  setFilterView(filterView === "specie" ? "" : "specie")
                }
                activeCount={seSpeciesFilter.length}
                onClear={() => handleClearGroup("species")}
              >
                <ListWithChek
                  ulId="filter_species"
                  list={speciesFilter}
                  selections={seSpeciesFilter}
                  onClickLi={(v) => handleClickFilter("species", v)}
                />
              </FilterSection>

              <FilterSection
                title="Estado"
                isOpen={filterView === "status"}
                onToggle={() =>
                  setFilterView(filterView === "status" ? "" : "status")
                }
                activeCount={seStatusFilter.length}
                onClear={() => handleClearGroup("status")}
              >
                <ListWithChek
                  ulId="filter_status"
                  list={statusFilter}
                  selections={seStatusFilter}
                  onClickLi={(v) => handleClickFilter("status", v)}
                />
              </FilterSection>
            </div>

            {/* Pie con acciones */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-x-3">
              <PrimaryButton
                label="Ver resultados"
                onClick={() => {
                  setShowFilters(false);
                  setFilterView("");
                }}
              />
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

/*==============================| Subcomponentes de filtros |==============================*/

// Tarjeta acordeón de una sección de filtro (Género / Especie / Estado)
function FilterSection({
  title,
  isOpen,
  onToggle,
  activeCount,
  onClear,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  activeCount: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border transition-colors ${
        isOpen ? "border-blue-meraki/40 bg-blue-meraki/5" : "border-gray-200"
      }`}
    >
      <button
        type="button"
        className="w-full flex justify-between items-center px-4 py-3"
        onClick={onToggle}
      >
        <span className="flex items-center gap-x-2 font-semibold text-sm text-gray-800">
          {title}
          {activeCount > 0 && (
            <span className="flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-blue-meraki text-white text-[.65rem]">
              {activeCount}
            </span>
          )}
        </span>
        <RiArrowDropDownLine
          className={`w-7 h-7 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-4 pb-3">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mb-2 text-xs text-gray-500 hover:text-blue-meraki hover:underline"
            >
              Limpiar selección
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
