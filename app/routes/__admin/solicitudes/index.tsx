import { gender_pet, petSpecies, Prisma } from "@prisma/client";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";
import { ApplicationCard } from "~/components/Card/applicationCard";
import SearchInput from "~/components/Input/SearchInput";
import { Select } from "~/components/Input/Select";
import Pagination from "~/components/Pagination";
import { config } from "~/config";
import {
  countAdoptionApplicationDb,
  listAdoptionApplicationWithPetDb,
  ListApplicationWithPet,
} from "~/services/db/adoptionApplication.service";
import { listPetSpeciesDb } from "~/services/db/petSpecies.service";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";

export const meta = () => {
  return [{ title: "Solicitudes | Asociación Meraki" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // Verificamos que tenga permiso de Leer "mis solicitudes";
  const validateRequest = validatePermission(session, 10, "Leer");

  if (validateRequest) throw validateRequest;

  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    const validateRequest = validatePermission(session, 10, "Leer");
    if (validateRequest) throw validateRequest;

    let data: {
      q: string;
      page: string;
      status: string;
      gender: string;
      clear: boolean;
      specie: string;
    } | null = null;

    if (typeof payload === "string") data = JSON.parse(payload);

    // Obtenemos los parametros de la url
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Información de paginación
    const page = Number(data?.page || searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");

    // Información de filtros
    const search = (data?.q ?? searchParams.get("q")) || undefined;
    const status = (data?.status ?? searchParams.get("status")) || undefined;
    const gender = (data?.gender ?? searchParams.get("gender")) || undefined;
    const specie = (data?.specie ?? searchParams.get("specie")) || undefined;

    // Filtro para la llamada de lista de mascotas
    const whereListApp: Prisma.adoptionApplicationWhereInput = {
      pet: {
        name: { contains: search, mode: "insensitive" },
        gender: { equals: gender as gender_pet | undefined },
        pet_species_id: { equals: specie ? Number(specie) : undefined },
      },
      status: { equals: status },
    };

    const [applicationsRes, totalAppsResponse, speciesResponse] =
      await Promise.all([
        listAdoptionApplicationWithPetDb(
          data?.clear ? undefined : whereListApp,
          { submitted_at: "asc" },
          (page - 1) * limit,
          limit,
        ),
        countAdoptionApplicationDb(whereListApp),
        listPetSpeciesDb({ active: true }),
      ]);

    if (
      !applicationsRes.success ||
      !totalAppsResponse.success ||
      !speciesResponse.success
    )
      return json({
        errorMsg: "Ocurrió un error al cargar la página",
      });

    return json({
      applications: applicationsRes.data,
      totalPages: Math.ceil(totalAppsResponse.data / limit),
      totalApps: totalAppsResponse.data,
      cloudName: config.cloudinaryCloudName,
      species: speciesResponse.data,
    });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la página",
  });
};

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros
  const [q, setQ] = useState("");
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const hasActiveFilters = Boolean(searchParams.toString());
  const [species, setSpecies] = useState<petSpecies[]>([]);

  // Lista de solicitudes
  const [applications, setApplications] = useState<ListApplicationWithPet[]>(
    [],
  );
  const [totalApps, setTotalApps] = useState(0);
  const [cloudName, setCloudName] = useState("");

  // Banderas
  const [isLoadingApps, setIsLoadingApps] = useState(true);

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
      setIsLoadingApps(false);
    }

    if (fetcher.data?.applications) {
      setApplications(fetcher.data.applications);
      setTotalPages(fetcher.data?.totalPages || 0);
      setTotalApps(fetcher.data?.totalApps || 0);
      setIsLoadingApps(false);
    }

    if (fetcher.data?.species) {
      setSpecies(fetcher.data?.species);
    }

    if (fetcher.data?.cloudName) {
      setCloudName(fetcher.data?.cloudName);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función que maneja el cambio en el filtro de texto
  const handleChangeSearch = (search: string) => {
    // Guardamos los cambios
    setQ(search);

    // limpiamos y creamos el debounce para la busqueda
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    const timeoutId = setTimeout(() => {
      handleLoadApps({ q: search, page: "" });
    }, 500);
    setDebounceTimeout(timeoutId);
  };

  // Cambiar de pagina
  function goToPage(next: number) {
    handleLoadApps({ page: String(next) });
  }

  // Función para actualizar informaci+pn
  const handleLoadApps = (params: Record<string, string>, clear?: boolean) => {
    if (clear) {
      setSearchParams({}, { preventScrollReset: true });
    } else {
      setSearchParams((prev) => {
        for (const [key, value] of Object.entries(params)) {
          if (!value) prev.delete(key);
          else prev.set(key, value);
        }
        return prev;
      });
    }

    setIsLoadingApps(true);
    fetcher.submit(
      {
        action: "loadInformation",
        payload: JSON.stringify({
          ...params,
          clear,
        }),
      },
      { method: "post" },
    );
  };

  // Si esta vacia la lista
  function EmptyState({ hasFilters }: { hasFilters: boolean }) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E4E0D6] py-16 text-center">
        <p className="font-medium text-[#1F1D1A]">
          {hasFilters
            ? "Ningún resultado con estos filtros"
            : "Todavía no hay solicitudes registradas"}
        </p>
        <p className="max-w-xs text-sm text-[#8A8577]">
          {hasFilters
            ? "Ajusta o limpia los filtros para ver más resultados."
            : "Espera la primera solicitud que realice el adoptante."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <h1 className="md:hidden text-xl font-bold">Solicitudes</h1>
      <h2 className="hidden md:block text-gray-400">
        Gestiona las solicitudes de mascotas para adopción.
      </h2>

      <div className="flex flex-col gap-6 md:gap-3 pb-3 md:flex-row md:items-center">
        <SearchInput
          placeholder="Buscar por nombre de mascota..."
          value={q}
          onChange={(e) => handleChangeSearch(e.target.value)}
        />
        <div className="grid grid-cols-2 md:flex md:items-center gap-x-6 gap-y-4">
          <Select
            id="status"
            name="status"
            className="w-full md:w-auto"
            value={searchParams.get("status") ?? ""}
            onChange={(e) =>
              handleLoadApps({ status: e.target.value, page: "" })
            }
          >
            <option value="">Todo estado</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </Select>
          <Select
            id="specie"
            name="specie"
            className="w-full md:w-auto"
            value={searchParams.get("specie") ?? ""}
            onChange={(e) =>
              handleLoadApps({ specie: e.target.value, page: "" })
            }
          >
            <option value="">Toda especie</option>
            {species.map((s: petSpecies) => (
              <option value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select
            id="gender"
            name="gender"
            className="w-full md:w-auto"
            value={searchParams.get("gender") ?? ""}
            onChange={(e) =>
              handleLoadApps({ gender: e.target.value, page: "" })
            }
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
                  handleLoadApps({}, true);
                }}
              >
                Limpiar
              </button>
            </div>
          )}
          <span className="col-span-2 px-1 md:px-0 text-sm text-gray-400 whitespace-nowrap">
            {totalApps} {totalApps === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {isLoadingApps ? (
          <div className="flex-grow flex justify-center items-center">
            <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
          </div>
        ) : applications.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} />
        ) : (
          applications.map((app) => (
            <ApplicationCard key={app.id} app={app} cloudName={cloudName} />
          ))
        )}
      </div>
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onChangePage={goToPage}
      />
    </div>
  );
}
