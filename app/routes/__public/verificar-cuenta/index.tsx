import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { LuCircleCheck, LuCircleX } from "react-icons/lu";
import { getUserDb, updateUserDb } from "~/services/db/user.service";
import {
  deleteManyAccountVerificationTokenDb,
  validateAccountVerificationToken,
} from "~/services/db/accountVerificationToken.service";

export const meta = () => {
  return [{ title: "Verificar cuenta | Asociación Meraki" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return json({
      status: "error",
      message: "Token de verificación no proporcionado",
    });
  }

  try {
    // Verificar el token
    const validation = await validateAccountVerificationToken(token);

    if (!validation.valid || !validation.userId) {
      return json({
        status: "error",
        message: validation.error || "Token inválido o expirado",
      });
    }

    // Obtener el usuario
    const userRes = await getUserDb({ id: validation.userId });

    if (!userRes.success || !userRes.data) {
      return json({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    const user = userRes.data;

    // Verificar si ya está verificado
    if (user.it_is_verified) {
      return json({
        status: "already_verified",
        message: "Esta cuenta ya ha sido verificada",
      });
    }

    // Actualizar el estado de verificación
    const updateRes = await updateUserDb(user.id, {
      it_is_verified: true,
    });

    if (!updateRes.success) {
      return json({
        status: "error",
        message: "Error al verificar la cuenta. Por favor, intenta nuevamente.",
      });
    }

    // El token es de un solo uso: se borra al consumirse.
    await deleteManyAccountVerificationTokenDb({ user_id: user.id });

    return json({
      status: "success",
      message: "¡Cuenta verificada exitosamente!",
    });
  } catch (error) {
    return json({
      status: "error",
      message: "Token inválido o expirado",
    });
  }
};

/*==============================| Component |==============================*/
export default function VerificarCuenta() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  // Redirección automática después de verificación exitosa
  useEffect(() => {
    if (data.status === "success" || data.status === "already_verified") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate("/iniciar-sesion");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [data.status, navigate]);

  // Estado: Verificación exitosa
  if (data.status === "success") {
    return (
      <div className="w-full h-full flex flex-col justify-end sm:justify-center items-center bg-black/60 sm:bg-[#f2f4f7]">
        <div className="w-full sm:w-[450px] h-[80%] lg:h-auto sm:min-h-[500px] overflow-y-auto flex flex-col justify-center items-center gap-y-6 rounded-t-3xl sm:rounded-lg bg-white px-6 py-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
              <LuCircleCheck
                className="w-16 h-16 text-emerald-600"
                strokeWidth={2}
              />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              ¡Cuenta verificada!
            </h1>
            <p className="text-gray-600 text-base leading-relaxed">
              Tu cuenta ha sido verificada exitosamente. Ya puedes iniciar
              sesión y disfrutar de todos los beneficios.
            </p>
          </div>

          <div className="w-full bg-emerald-50 border border-emerald-100 rounded-lg p-4">
            <p className="text-sm text-emerald-800 text-center">
              Serás redirigido al inicio de sesión en{" "}
              <span className="font-bold">{countdown}</span> segundo
              {countdown !== 1 ? "s" : ""}...
            </p>
          </div>

          <div className="w-full pt-4 space-y-3">
            <button
              onClick={() => navigate("/iniciar-sesion")}
              className="w-full bg-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/90 transition-colors text-white font-medium rounded-lg px-6 py-3"
            >
              Ir a iniciar sesión ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Estado: Ya verificado
  if (data.status === "already_verified") {
    return (
      <div className="w-full h-full flex flex-col justify-end sm:justify-center items-center bg-black/60 sm:bg-[#f2f4f7]">
        <div className="w-full sm:w-[450px] h-[80%] lg:h-auto sm:min-h-[500px] overflow-y-auto flex flex-col justify-center items-center gap-y-6 rounded-t-3xl sm:rounded-lg bg-white px-6 py-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
              <LuCircleCheck
                className="w-16 h-16 text-blue-600"
                strokeWidth={2}
              />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Cuenta ya verificada
            </h1>
            <p className="text-gray-600 text-base leading-relaxed">
              Esta cuenta ya ha sido verificada anteriormente. Puedes iniciar
              sesión cuando lo desees.
            </p>
          </div>

          <div className="w-full bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-800 text-center">
              Serás redirigido al inicio de sesión en{" "}
              <span className="font-bold">{countdown}</span> segundo
              {countdown !== 1 ? "s" : ""}...
            </p>
          </div>

          <div className="w-full pt-4 space-y-3">
            <button
              onClick={() => navigate("/iniciar-sesion")}
              className="w-full bg-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/90 transition-colors text-white font-medium rounded-lg px-6 py-3"
            >
              Ir a iniciar sesión ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Estado: Error
  return (
    <div className="w-full h-full flex flex-col justify-end sm:justify-center items-center bg-black/60 sm:bg-[#f2f4f7]">
      <div className="w-full sm:w-[450px] h-[80%] lg:h-auto sm:min-h-[500px] overflow-y-auto flex flex-col justify-center items-center gap-y-6 rounded-t-3xl sm:rounded-lg bg-white px-6 py-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
            <LuCircleX className="w-16 h-16 text-red-600" strokeWidth={2} />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Error de verificación
          </h1>
          <p className="text-gray-600 text-base leading-relaxed">
            {data.message ||
              "No se pudo verificar tu cuenta. El enlace puede haber expirado o ser inválido."}
          </p>
        </div>

        <div className="w-full bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
          <p className="text-sm text-amber-900 font-medium">
            ¿Qué puedes hacer?
          </p>
          <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
            <li>Solicita un nuevo correo de verificación</li>
            <li>Verifica que el enlace esté completo</li>
            <li>Intenta desde otro navegador</li>
          </ul>
        </div>

        <div className="w-full pt-4 space-y-3">
          <button
            onClick={() => navigate("/iniciar-sesion")}
            className="w-full bg-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/90 transition-colors text-white font-medium rounded-lg px-6 py-3"
          >
            Solicitar nuevo correo
          </button>
          <button
            onClick={() => navigate("/iniciar-sesion")}
            className="w-full bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 font-medium rounded-lg px-6 py-3"
          >
            Volver a inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}
