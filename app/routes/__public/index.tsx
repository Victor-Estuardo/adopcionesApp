import { ActionFunction, json } from "@remix-run/node";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import SearchInput from "~/components/Input/SearchInput";
import {
  CountPetsDb,
  listPetsWithImagesDb,
  PetWithImage,
} from "~/services/db/pet.service";
import { IoFilterOutline } from "react-icons/io5";
import Pagination from "~/components/Pagination";
import { gender_pet, Prisma } from "@prisma/client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";
import { RiArrowDropDownLine } from "react-icons/ri";
import ListWithChek from "~/components/List/ListWithChek";
import { listPetSpeciesDb } from "~/services/db/petSpecies.service";
import { SecondaryButton } from "~/components/Button/secondary";
import { PetCard } from "~/components/Card/PetCard";
import { config } from "~/config";

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

    // Filtro para la llamada de lista de mascotas
    const whereListPets: Prisma.petWhereInput = {
      adopted: false,
      name: search ? { contains: search, mode: "insensitive" } : undefined,
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
  const [showGenderFilter, setShowGenderFilter] = useState(false);
  const [showSpeciesFilter, setShowSpeciesFilter] = useState(false);

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

  // Para selecciones de filtros, se = selected
  const [seGenderFilter, setSeGenderFilter] = useState<string[]>(
    (searchParams.get("gender") || "").split(","),
  );
  const [seSpeciesFilter, setSeSpeciesFilter] = useState<string[]>(
    (searchParams.get("species") || "").split(","),
  );

  // Lista de mascotas
  const [petList, setpetList] = useState<PetWithImage[]>([]);
  const [cloudName, setCloudName] = useState("");

  // Paginación
  const page = Number(searchParams.get("page") || "1");
  const [totalPages, setTotalPages] = useState(0);

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

  return (
    <>
      <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-y-3 md:gap-y-0">
          <h1 className="justify-self-start text-blue-meraki text-xl md:text-3xl font-bold">
            Adopta una mascota
          </h1>
          <div className="flex gap-x-3 justify-self-start md:justify-self-end">
            <SearchInput
              value={searchText}
              onChange={(e) => handleChangeSearch(e.target.value)}
            />
            <button
              className="flex order-1 md:order-2 justify-center items-center gap-x-2 px-2 py-1 border border-peach-meraki rounded-lg text-[.75rem] md:text-base"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <IoFilterOutline />
              Filtro
            </button>
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
          <p>No se encontraron mascotas disponibles...</p>
        ) : (
          <div className="flex-grow grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] md:gap-x-16 gap-y-7 md:gap-y-11 justify-items-center">
            {petList.map((pet, index) => (
              <PetCard
                key={`${index}_${pet.name}`}
                pet={pet}
                onClickCard={() =>
                  (window.location.href = `/mascota/${pet.id}`)
                }
                cloudName={cloudName}
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
        <div
          className="absolute right-0 bottom-0 w-full h-[calc(100dvh-5rem)] z-10 bg-black/60 flex justify-end items-center"
          onClick={() => {
            setShowFilters(false);
            setShowGenderFilter(false);
            setShowSpeciesFilter(false);
          }}
        >
          <div
            className="h-full w-3/4 sm:w-1/4 flex flex-col gap-y-3 bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-end cursor-pointer"
              onClick={() => {
                setShowFilters(false);
                setShowGenderFilter(false);
                setShowSpeciesFilter(false);
              }}
            >
              X
            </p>
            <h2 className="text-center border-b border-gray-300 pb-2">
              Filtros
            </h2>
            <button
              className="flex justify-between items-center border-b border-gray-300 pb-2 font-bold"
              onClick={() => {
                setShowGenderFilter((prev) => !prev);
              }}
            >
              <span>Género</span>
              <RiArrowDropDownLine
                className={`w-8 h-8 ${
                  showGenderFilter ? "rotate-180" : ""
                } transfrom transition-all duration-200`}
              />
            </button>
            {showGenderFilter && (
              <ListWithChek
                ulId="filter_gender"
                list={genderFilter}
                onClickLi={(v) => handleClickFilter("gender", v)}
                selections={seGenderFilter}
              />
            )}
            <button
              className="flex justify-between items-center border-b border-gray-300 pb-2 font-bold"
              onClick={() => {
                setShowSpeciesFilter((prev) => !prev);
              }}
            >
              <span>Especie</span>
              <RiArrowDropDownLine
                className={`w-8 h-8 ${
                  showSpeciesFilter ? "rotate-180" : ""
                } transfrom transition-all duration-200`}
              />
            </button>
            {showSpeciesFilter && (
              <ListWithChek
                ulId="filter_species"
                list={speciesFilter}
                onClickLi={(v) => handleClickFilter("species", v)}
                selections={seSpeciesFilter}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
