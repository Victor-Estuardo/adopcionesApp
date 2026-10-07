import { json, LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import SearchInput from "~/components/Input/SearchInput";
import { IoCheckmark, IoCloseOutline, IoFilterOutline } from "react-icons/io5";
import Pagination from "~/components/Pagination";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";
import { RiArrowDropDownLine } from "react-icons/ri";
import ListWithChek from "~/components/List/ListWithChek";
import { listPetSpeciesDb } from "~/services/db/petSpecies.service";
import { PetCard } from "~/components/Card/PetCard";
import { PrimaryButton } from "~/components/Button/primary";
import { config } from "~/config";
import { useFocusTrap } from "~/hooks/useFocusTrap";
import { PUBLIC_PET_STATUSES } from "~/utils/pet-helpers";
import type { PetWithImage } from "~/services/db/pet.service";
import { listPublicPets } from "~/utils/pet-routes.server";
import { absoluteUrl } from "~/utils/site.server";
import { homeMeta } from "~/utils/pet-meta";

/*==============================| Types |==============================*/
interface FilterOption {
  value: string;
  label: string;
}

/*==============================| Loader Function |==============================*/
// La lista llega renderizada en el HTML (los buscadores no ejecutan el
// fetch del cliente) y se vuelve a ejecutar al cambiar filtros o página.
export const loader = async ({ request }: LoaderArgs) => {
  const { searchParams } = new URL(request.url);

  const [petSpeciesResponse, list] = await Promise.all([
    listPetSpeciesDb({ active: true }),
    listPublicPets(searchParams),
  ]);

  // Siempre la portada sin parámetros: los filtros y la paginación no se
  // indexan por separado
  const base = {
    cloudName: config.cloudinaryCloudName,
    canonicalUrl: absoluteUrl("/"),
  };

  if (!petSpeciesResponse.success || !list) {
    return json(
      {
        ...base,
        errorMsg: "Ocurrió un error al cargar la página",
        species_filter: [] as FilterOption[],
        petList: [],
        totalPages: 0,
      },
      { status: 500 },
    );
  }

  return json({
    ...base,
    errorMsg: null,
    species_filter: petSpeciesResponse.data.map(
      (specie): FilterOption => ({
        value: specie.id.toString(),
        label: specie.name,
      }),
    ),
    petList: list.petList,
    totalPages: list.totalPages,
  });
};

export const meta: V2_MetaFunction<typeof loader> = ({ data }) =>
  homeMeta(data?.canonicalUrl);

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados de la pagina
  const [showFilters, setShowFilters] = useState(false);

  // Para vista de filtros
  const [filterView, setFilterView] = useState("");

  // Cerrar el drawer de filtros (Escape, fondo, botón X o "Ver resultados")
  const closeFilters = () => {
    setShowFilters(false);
    setFilterView("");
  };
  const filtersPanelRef = useFocusTrap<HTMLDivElement>(showFilters, closeFilters);

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
  const speciesFilter = data.species_filter;
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

  // Lista de mascotas (vienen del loader; cambian al cambiar la URL)
  const { petList, cloudName, totalPages } = data;
  // Solo mientras se recarga la propia portada (filtros/página), no al salir de ella
  const loadingPets =
    navigation.state === "loading" &&
    (navigation.location?.pathname ?? "/") === "/";

  // Paginación
  const page = Number(searchParams.get("page") || "1");

  // Cantidad total de filtros activos (para el badge del botón "Filtro")
  const activeFiltersCount =
    seGenderFilter.length + seSpeciesFilter.length + seStatusFilter.length;

  const hasActiveFilters = activeFiltersCount > 0;

  /*------------------------------ERRORES DEL LOADER------------------------------*/
  useEffect(() => {
    if (data.errorMsg) toast.error(data.errorMsg);
  }, [data.errorMsg]);

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

  // Función que maneja la carga de mascotas: actualiza la URL y el loader
  // vuelve a traer la lista
  const handleLoadPets = (params: Record<string, string>) => {
    setSearchParams(
      (prev) => {
        for (const [key, value] of Object.entries(params)) {
          if (!value) prev.delete(key);
          else prev.set(key, value);
        }
        return prev;
      },
      { preventScrollReset: true },
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
    const isFiltered = hasActiveFilters || searchText.trim() !== "";
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E4E0D6] py-16 text-center">
        <p className="font-medium text-[#1F1D1A]">
          {isFiltered
            ? "Ningún resultado con esta búsqueda o estos filtros"
            : "Todavía no hay mascotas registradas"}
        </p>
        <p className="max-w-xs text-sm text-[#8A8577]">
          {isFiltered
            ? "Prueba con otro nombre o limpia la búsqueda y los filtros."
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
                key={pet.id}
                // El JSON del loader trae las fechas como string; PetCard solo las formatea
                pet={pet as unknown as PetWithImage}
                href={`/mascota/${pet.id}`}
                cloudName={cloudName}
                petTagNub
              >
                <div className="flex justify-center items-center border-t border-[#F0EDE5] pt-3">
                  <span
                    aria-hidden
                    className="w-[80%] rounded-full border border-blue-meraki px-4 md:px-6 py-2 text-center text-sm md:text-base"
                  >
                    Ver
                  </span>
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
          onClick={closeFilters}
        >
          <div
            ref={filtersPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            tabIndex={-1}
            className="h-full w-3/4 md:w-[20%] flex flex-col gap-y-3 bg-white p-3 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-blue-meraki">Filtros</h2>
              <button
                aria-label="Cerrar filtros"
                onClick={closeFilters}
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
                onClick={closeFilters}
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
