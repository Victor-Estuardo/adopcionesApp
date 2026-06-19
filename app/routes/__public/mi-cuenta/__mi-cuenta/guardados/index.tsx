import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { Link, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FaChevronRight } from "react-icons/fa";
import { LuCalendar, LuHeart, LuMapPin } from "react-icons/lu";
import { toast } from "sonner";
import {
  deleteSavedPetDb,
  listSavedPetWithPetDb,
} from "~/services/db/savedPet.service";
import { getSession } from "~/services/sessions/sessions.service";
import { calculateAge } from "~/utils/common";

/*==============================| Types |==============================*/
type SavedPetItem = {
  savedId: string;
  savedAt: string;
  pet: {
    id: number;
    name: string;
    gender: string;
    size: string;
    birthdate: string;
    adopted: boolean;
    species: string;
    imageUrl: string | null;
  };
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload, ...values } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    const savedPetListRes = await listSavedPetWithPetDb(
      { user_id: dbUserId },
      { saved_at: "desc" },
    );

    if (!savedPetListRes.success)
      return json({
        errorMsg: "Ocurrió un error al cargar la pagina",
      });

    // Formateo de items
    const items: SavedPetItem[] = savedPetListRes.data.map((s) => ({
      savedId: s.id,
      savedAt: s.saved_at.toISOString(),
      pet: {
        id: s.pet.id,
        name: s.pet.name,
        gender: s.pet.gender,
        size: s.pet.size,
        birthdate: s.pet.birthdate.toISOString(),
        adopted: s.pet.adopted,
        species: s.pet.petSpecies.name,
        imageUrl: s.pet.pet_images[0].path,
      },
    }));

    return json({
      saved_pets: items,
    });
  }

  if (action === "unsavePet") {
    const savedId = values.savedId as string;

    // Si no encuentra un id, da error
    if (!savedId) {
      return json({
        errorMsg: "Ocurrió un error al quitar de guardados",
      });
    }

    const deleteRes = await deleteSavedPetDb({ id: savedId });

    if (!deleteRes.success) {
      return json({
        errorMsg: "Ocurrió un error al quitar de guardados",
      });
    }

    return json({
      delete_saved_id: savedId,
    });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

/*==============================| Component |==============================*/
export default function () {
  // Hooks...
  const fetcher = useFetcher();

  // Banderas
  const [isLoading, setIsLoading] = useState(true);

  // Items
  const [items, setItems] = useState<SavedPetItem[]>([]);

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
      setIsLoading(false);
    }

    if (fetcher.data?.saved_pets) {
      setItems(fetcher.data.saved_pets);
      setIsLoading(false);
    }

    if (fetcher.data?.delete_saved_id) {
      const tempSaveId = fetcher.data.delete_saved_id;
      toast.success("Se quitó exitosamente");
      setItems((prev) => prev.filter((p) => p.savedId != tempSaveId));
    }
  }, [fetcher.data]);

  if (isLoading) {
    return (
      <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
        <div className="flex-grow flex justify-center items-center">
          <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-y-6 md:p-5 md:overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Guardados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length === 0
              ? "Aún no tienes mascotas guardadas"
              : `${items.length} ${
                  items.length === 1 ? "mascota guardada" : "mascotas guardadas"
                }`}
          </p>
        </div>
        {items.length > 0 && (
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-medium-turquoise-meraki hover:text-teal-700 transition-colors"
          >
            Ver más mascotas
            <FaChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <SavedPetCard key={item.savedId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/*==============================| SavedPetCard |==============================*/
function SavedPetCard({ item }: { item: SavedPetItem }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Foto */}
      <Link to={`/mascota/${item.pet.id}`} className="block">
        <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
          {item.pet.imageUrl ? (
            <img
              src={item.pet.imageUrl}
              alt={item.pet.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl">🐾</span>
            </div>
          )}

          {/* Badge adoptado */}
          {item.pet.adopted && (
            <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              Adoptado
            </div>
          )}
        </div>
      </Link>

      {/* Botón quitar guardado */}
      <form method="post">
        <input type="hidden" name="action" value={"unsavePet"} />
        <input type="hidden" name="savedId" value={item.savedId} />
        <button
          type="submit"
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow text-rose-400 hover:text-rose-600 hover:bg-white transition-colors"
          aria-label="Quitar de guardados"
        >
          <LuHeart className="w-4 h-4 fill-current" />
        </button>
      </form>

      {/* Info */}
      <div className="p-4">
        <Link to={`/mascota/${item.pet.id}`} className="block">
          <h3 className="font-semibold text-gray-900 text-base leading-tight hover:text-teal-600 transition-colors">
            {item.pet.name}
          </h3>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <LuCalendar className="w-3.5 h-3.5" />
              {calculateAge(item.pet.birthdate)}
            </span>
            <span className="flex items-center gap-1">
              <LuMapPin className="w-3.5 h-3.5" />
              {item.pet.species}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <Chip>{item.pet.gender}</Chip>
            <Chip>{item.pet.size}</Chip>
          </div>
        </Link>

        <Link
          to={`/mascota/${item.pet.id}`}
          className={`mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
            item.pet.adopted
              ? "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
              : "bg-medium-turquoise-meraki hover:bg-teal-600 text-white"
          }`}
        >
          {item.pet.adopted ? "Ya fue adoptado" : "Ver perfil"}
          {!item.pet.adopted && <FaChevronRight className="w-4 h-4" />}
        </Link>
      </div>
    </div>
  );
}

/*==============================| Chip |==============================*/
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="capitalize inline-flex items-center px-2 py-0.5 rounded-full bg-teal-50 text-medium-turquoise-meraki text-xs font-medium border border-teal-100">
      {children}
    </span>
  );
}

/*==============================| EmptyState |==============================*/
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center mb-4">
        <LuHeart className="w-9 h-9 text-teal-300" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800">
        Aún no guardaste ninguna mascota
      </h2>
      <p className="mt-1 text-sm text-gray-500 max-w-xs">
        Explora las mascotas disponibles y guarda las que te llamen la atención
        para encontrarlas fácilmente después.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
      >
        Explorar mascotas
        <FaChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
