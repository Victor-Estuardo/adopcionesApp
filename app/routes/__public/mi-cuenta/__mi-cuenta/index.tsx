import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { Link, useFetcher, useRouteLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LuPencil } from "react-icons/lu";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { countAdoptionApplicationDb } from "~/services/db/adoptionApplication.service";
import { getSession } from "~/services/sessions/sessions.service";
import { countSavedpetDb } from "~/services/db/savedPet.service";
import {
  getOwnProfileUserDb,
  OwnProfileUser,
} from "~/services/db/user.service";
import { validatePermission } from "~/utils/common";

export const meta = () => {
  return [{ title: "Mi cuenta | Asociación Meraki" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // Verificamos que tenga permiso de Leer "mi Cuenta";
  const validateRequest = validatePermission(session, 5, "Leer");

  if (validateRequest) throw validateRequest;

  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    // Obtenemos el conteo de las solicitudes realizadas y de las mascotas guardadas
    const [countAppAdoptionR, countApprovedApplicationR, countSavedPetR] =
      await Promise.all([
        countAdoptionApplicationDb({
          user_id: dbUserId,
        }),
        countAdoptionApplicationDb({
          user_id: dbUserId,
          status: "aprobada",
        }),
        countSavedpetDb({
          user_id: dbUserId,
        }),
      ]);

    // Si alguno dio error se muestra en pantalla
    if (
      !countAppAdoptionR.success ||
      !countApprovedApplicationR.success ||
      !countSavedPetR.success
    ) {
      return json({
        errorMsg: "Ocurrió un error al obtener información",
      });
    }

    // Obtenemos la información del usuario
    const userInfoRes = await getOwnProfileUserDb({ id: dbUserId });

    if (!userInfoRes.success) {
      return json({
        errorMsg: "Ocurrió un error al obtener información",
      });
    }

    return json({
      countApplication: countAppAdoptionR.data,
      countApprovedApplication: countApprovedApplicationR.data,
      countSavedPet: countSavedPetR.data,
      loading_info: true,
      user: userInfoRes.data,
    });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la página",
  });
};

const stats = (total: number, saved: number, approved: number) => [
  { label: "Solicitudes enviadas", value: total },
  { label: "Mascotas guardadas", value: saved },
  { label: "Solicitudes aprobadas", value: approved },
];

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const routeData = useRouteLoaderData("routes/__public");
  const fetcher = useFetcher();

  // banderas
  const [isLoading, setIsLoading] = useState(true);

  // conteos
  const [countApprovedApplication, setCountApprovedApplication] = useState(0);
  const [countApplication, setCountApplication] = useState(0);
  const [countSavedPet, setCountSavedPet] = useState(0);

  // Usuario
  const [user, setUser] = useState<OwnProfileUser | null>(null);

  // Datos del usuario
  const initials = routeData.initials || "";
  const profile = routeData.profile || "";

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
    }
    if (fetcher.data?.countApplication) {
      setCountApplication(fetcher.data.countApplication);
    }
    if (fetcher.data?.countApprovedApplication) {
      setCountApprovedApplication(fetcher.data.countApprovedApplication);
    }
    if (fetcher.data?.countSavedPet) {
      setCountSavedPet(fetcher.data.countSavedPet);
    }
    if (fetcher.data?.loading_info) {
      setIsLoading(false);
    }
    if (fetcher.data?.user) {
      setUser(fetcher.data?.user);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // ─── Formatea la fecha de registro: "Miembro desde enero 2025" ────────────
  function getMemberSince(date: Date | string | null): string {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-GT", {
      month: "long",
      year: "numeric",
    });
  }

  // Si aun esta cargando la información
  if (isLoading || !user) {
    return (
      <div className="flex-grow flex justify-center items-center">
        <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 p-5 flex flex-col gap-y-5 overflow-y-auto">
        {/** Actividad Reciente */}
        <div className="flex flex-col gap-y-6 shadow-md rounded-lg p-3">
          <p className="border-b border-gray-200 py-3">Resumen de actividad</p>
          <div className="flex gap-x-6">
            {stats(
              countApplication,
              countSavedPet,
              countApprovedApplication,
            ).map((stat) => (
              <div
                key={`stat_${stat.label}`}
                className="px-4 py-3 border border-gray-200 rounded-lg"
              >
                <p className="text-base">{stat.label}</p>
                <p className="text-2xl text-emerald-600">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
        {/** Mi perfil */}
        <div className="flex flex-col gap-y-6 shadow-md rounded-lg p-3">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
            <p className="font-medium">Información personal</p>
            <Link
              to="/mi-cuenta/editar"
              className="flex items-center gap-x-3 text-sm text-emerald-600 hover:text-emerald-700"
            >
              <LuPencil aria-hidden="true" />
              Editar
            </Link>
          </div>
          <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
            {profile ? (
              <img className="w-14 h-14 rounded-full" src={profile} />
            ) : (
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-lg font-medium text-emerald-700 flex-shrink-0">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-gray-500">
                Miembro desde {getMemberSince(user.registration_date)}
              </p>
            </div>
            <Link
              to="/mi-cuenta/editar?editProfile=true"
              className="ml-auto text-xs border border-emerald-500 text-emerald-600 rounded-full px-4 py-1.5 hover:bg-emerald-50 transition-colors"
            >
              Cambiar foto
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 px-5 py-4">
            <Field label="Nombre" value={user.first_name} />
            <Field label="Apellido" value={user.last_name} />
            <Field label="Correo electrónico" value={user.email} />
            <Field label="Teléfono" value={user.phone || "-"} />
            <Field
              label="Cuenta verificada"
              value={user.it_is_verified ? "Sí" : "No"}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}
