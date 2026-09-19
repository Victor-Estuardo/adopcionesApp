import { ActionFunction, json } from "@remix-run/node";
import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import Carousel from "~/components/Carousel";
import { getPetWithImagesDb, PetWithImage } from "~/services/db/pet.service";
import { FaChevronLeft, FaMapPin, FaRegHeart } from "react-icons/fa";
import { IoFemaleOutline, IoMaleOutline } from "react-icons/io5";
import { LiaBirthdayCakeSolid } from "react-icons/lia";
import { calculateAge, validatePermission } from "~/utils/common";
import { FaHeart } from "react-icons/fa";
import { GrStatusGoodSmall } from "react-icons/gr";
import { getSession } from "~/services/sessions/sessions.service";
import { toast } from "sonner";
import { PermissionSession } from "~/services/auth/login.service";
import {
  createSavedPetDb,
  deleteSavedPetDb,
  getSavedPetDb,
} from "~/services/db/savedPet.service";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { SecondaryButton } from "~/components/Button/secondary";
import { PrimaryButton } from "~/components/Button/primary";
import { config } from "~/config";
import { petImageUrl } from "~/utils/image";
import { getPetStatusConfig } from "~/utils/pet-helpers";

export const meta = () => {
  return [{ title: "MASCOTA" }];
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request, params }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  // Obtenemos la infromación del usuario
  const dbUserId = session.get("dbUserId");
  // Obtenemos el id de la mascota
  const { petId } = params;

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    // Obtenemos los permisos
    const permissions: PermissionSession[] = session.get("permissions") || [];

    if (!petId) {
      return json({
        errorMsg: "Ocurrió un error al obtener la información de la mascota",
      });
    }

    // Obtenemos información de la mascota
    const petInfoRes = await getPetWithImagesDb({ id: Number(petId) });

    // Obtenemos información de si la mascota ha sido guardada
    const getSavedPetRes = await getSavedPetDb({
      user_id: dbUserId || -100,
      pet_id: Number(petId),
    });

    if (!petInfoRes.success || !petInfoRes.data || !getSavedPetRes.success) {
      return json({
        errorMsg: "Ocurrió un error al obtener la información de la mascota",
      });
    }

    return json({
      pet: petInfoRes.data,
      isUser: !!session.get("dbUserId"),
      allowedLikePet: permissions.find(
        (p) => p.module_id === 1 && p.action === "Guardar",
      ),
      allowedRequestPet: permissions.find(
        (p) => p.module_id === 1 && p.action === "Crear",
      ),
      pet_saved_id: getSavedPetRes.data?.id,
      cloudName: config.cloudinaryCloudName,
    });
  }

  if (action === "savedPet") {
    // Solo un usuario autenticado con permiso "Guardar" puede guardar mascotas
    const validateRequest = validatePermission(session, 1, "Guardar");
    if (validateRequest) throw validateRequest;
    if (!dbUserId) {
      throw new Response(
        "No cuenta con los permisos necesarios para ejecutar la acción",
        { status: 404 },
      );
    }

    // Guardamos la mascota para el usuario
    const createSavedRes = await createSavedPetDb({
      pet_id: Number(petId),
      user_id: dbUserId,
      saved_at: new Date(),
    });

    if (!createSavedRes.success) {
      // La mascota ya estaba guardada (constraint único user_id+pet_id)
      if (createSavedRes.error.includes("Unique constraint")) {
        const existing = await getSavedPetDb({
          user_id: dbUserId,
          pet_id: Number(petId),
        });
        return json({
          pet_saved: true,
          pet_saved_id: existing.success ? existing.data?.id : undefined,
        });
      }

      return json({
        errorMsg:
          "Ocurrió un error al guardar la mascota, por favor intente nuevamente",
      });
    }

    return json({
      pet_saved: true,
      pet_saved_id: createSavedRes.data.id,
    });
  }

  if (action === "unsavePet") {
    // Solo un usuario autenticado con permiso "Guardar" puede quitar guardados
    const validateRequest = validatePermission(session, 1, "Guardar");
    if (validateRequest) throw validateRequest;
    if (!dbUserId) {
      throw new Response(
        "No cuenta con los permisos necesarios para ejecutar la acción",
        { status: 404 },
      );
    }

    let {
      saved_id,
    }: {
      saved_id: string | null;
    } = JSON.parse(payload as string);

    // Si no tenemos un id se devuelve un error
    if (!saved_id) {
      return json({
        errorMsg: "Ocurrió un error al quitar la mascota de los guardados",
      });
    }

    // Quitamos el guardado de la mascota
    const deleteResponse = await deleteSavedPetDb({
      id: saved_id,
      user_id: dbUserId,
    });

    if (!deleteResponse.success || deleteResponse.data === 0) {
      return json({
        errorMsg: "Ocurrió un error al quitar la mascota de los guardados",
      });
    }

    return json({
      unsave_pet: true,
    });
  }

  return json({});
};

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // Información de la mascota
  const [pet, setPet] = useState<PetWithImage | null>(null);
  const [cloudName, setCloudName] = useState("");
  const petImages = useMemo(() => {
    if (pet && cloudName) {
      return pet.pet_images.map((img) =>
        petImageUrl(cloudName, img.path, "full"),
      );
    }

    return [];
  }, [pet, cloudName]);

  // Información del usuario
  const [isUser, setIsUser] = useState(false);
  const [allowedLike, setAllowedLike] = useState(false);
  const [allowedRequest, setAllowedRequest] = useState(false);

  // Banderas
  const [isLoading, setIsLoading] = useState(true);
  const [petSavedId, setPetSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    if (fetcher.data?.pet) {
      setPet(fetcher.data.pet);
      setIsLoading(false);
    }
    if (fetcher.data?.isUser) {
      setIsUser(true);
    }
    if (fetcher.data?.allowedLikePet) {
      setAllowedLike(true);
    }
    if (fetcher.data?.allowedRequestPet) {
      setAllowedRequest(true);
    }
    if (fetcher.data?.pet_saved_id) {
      setPetSavedId(fetcher.data.pet_saved_id);
    }
    if (fetcher.data?.cloudName) {
      setCloudName(fetcher.data.cloudName);
    }
    if (fetcher.data?.pet_saved) {
      toast.success("Guardado exitosamente.");
      setSaving(false);
    }
    if (fetcher.data?.unsave_pet) {
      toast.success("Se quito de Guardados exitosamente");
      setPetSavedId(null);
      setSaving(false);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función que maneja clic en "Guardar"
  const handleSavePet = () => {
    if (!isUser) {
      toast.error("Necesitas iniciar sesión para usar esta funcionalidad");
      navigate(`/iniciar-sesion?redirect=/mascota/${pet?.id}`);
      return;
    }

    setSaving(true);
    fetcher.submit(
      {
        action: petSavedId ? "unsavePet" : "savedPet",
        payload: JSON.stringify({
          saved_id: petSavedId,
        }),
      },
      { method: "post" },
    );
  };

  // Función que maneja clic en "Guardar"
  const handleAdoptionPet = () => {
    if (!isUser) {
      toast.error("Necesitas iniciar sesión para usar esta funcionalidad");
      navigate(`/iniciar-sesion?redirect=/mascota/${pet?.id}`);
      return;
    }

    navigate("solicitar_adopcion");
  };

  // Si aún no hay información de la mascota
  if (isLoading) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="w-full h-full fles justify-center items-center">
        No se encontro información de la mascota
      </div>
    );
  }

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <button
        className="hidden md:flex max-w-max items-center gap-x-3 text-blue-meraki"
        onClick={() => navigate("/")}
      >
        <FaChevronLeft className="w-6 h-6" />
        <span className="text-xl font-semibold">Adopciones</span>
      </button>
      <div className="w-full md:w-[80%] mx-auto flex flex-col gap-y-6">
        <div className="w-full flex flex-col md:flex-row">
          {/** Imagenes */}
          <div className="md:w-1/2">
            <Carousel displayImages={petImages} />
          </div>
          {/** Información principal */}
          <div className="md:w-1/2 py-4 md:py-0 md:px-4 flex flex-col justify-between gap-y-4">
            <div>
              <h1
                className={`text-2xl md:text-3xl font-bold flex items-center md:items-end gap-x-4 ${
                  pet.gender === "Hembra"
                    ? "text-pink-meraki"
                    : "text-blue-meraki"
                }`}
              >
                {pet.name}
              </h1>
              {(() => {
                const statusConfig = getPetStatusConfig(pet.status);
                return (
                  <span
                    className={`flex items-center gap-x-2 ${statusConfig.color}`}
                  >
                    <GrStatusGoodSmall />
                    {statusConfig.canRequestAdoption
                      ? "En adopción"
                      : statusConfig.label}
                  </span>
                );
              })()}
            </div>

            <div className="w-full flex flex-wrap gap-3 text-gray-600">
              <span className="flex justify-center items-center gap-x-2">
                {pet.gender === "Hembra" ? (
                  <IoFemaleOutline className="w-6 h-6 text-medium-turquoise-meraki" />
                ) : (
                  <IoMaleOutline className="w-6 h-6 text-medium-turquoise-meraki" />
                )}
                {pet.gender}
              </span>
              <span className="flex justify-center items-center gap-x-2">
                <LiaBirthdayCakeSolid className="w-6 h-6 text-medium-turquoise-meraki" />
                {calculateAge(pet.birthdate)}
              </span>
              <span className="flex justify-center items-center gap-x-2">
                <FaMapPin className="w-[20px] h-[20px] text-medium-turquoise-meraki" />
                Guatemala
              </span>
            </div>
            <p className="text-gray-700 leading-relaxed">{pet.description}</p>
            <div className="flex gap-4">
              {(!isUser || allowedRequest) && (
                <PrimaryButton
                  disabled={!getPetStatusConfig(pet.status).canRequestAdoption}
                  onClick={() => handleAdoptionPet()}
                  label={
                    getPetStatusConfig(pet.status).canRequestAdoption
                      ? "Solicitar Adopción"
                      : getPetStatusConfig(pet.status).label
                  }
                />
              )}
              {(!isUser || allowedLike) && (
                <SecondaryButton
                  textColor={"text-rose-400"}
                  borderColor="border-rose-400"
                  onClick={() => handleSavePet()}
                  disabled={saving}
                  label={
                    saving
                      ? petSavedId
                        ? "Quitando..."
                        : "Guardando..."
                      : petSavedId
                      ? "Guardado"
                      : "Guardar"
                  }
                  Icon={petSavedId ? FaHeart : FaRegHeart}
                />
              )}
            </div>
          </div>
        </div>
        <div className="w-full shadow-sm p-6 flex flex-col gap-y-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Información adicional
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li>
              <strong>Raza:</strong> {pet.race}
            </li>
            <li>
              <strong>Tamaño:</strong> {pet.size}
            </li>
            <li>
              <strong>Color:</strong> {pet.color}
            </li>
            <li>
              <strong>Vacunado:</strong> {pet.vaccinated ? "Sí" : "No"}
            </li>
            <li>
              <strong>Esterilizado:</strong> {pet.sterilized ? "Sí" : "No"}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
