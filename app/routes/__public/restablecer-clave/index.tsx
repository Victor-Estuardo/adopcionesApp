import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { PiWarningCircle } from "react-icons/pi";
import { toast } from "sonner";
import InputWithIcon from "~/components/Input/InputWithIcon";
import { handlePasswordValidation } from "~/utils/common";
import { hashText } from "~/utils/crypto.server";
import prisma from "~/services/db/prisma";
import { validatePasswordResetToken } from "~/services/db/passwordResetToken.service";

export const meta = () => {
  return [{ title: "Restablecer Contraseña" }];
};

/*==============================| Loader |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return json({ error: "Token no proporcionado" }, { status: 400 });
  }

  /// Validar token
  const validation = await validatePasswordResetToken(token);

  if (!validation.valid) {
    return json(
      { error: validation.error || "Token inválido" },
      { status: 400 },
    );
  }

  return json({ token, valid: true });
};

/*==============================| Action |==============================*/
export const action: ActionFunction = async ({ request }) => {
  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "resetPassword") {
    let data: {
      token: string;
      password: string;
    } | null = null;

    if (typeof payload === "string") data = JSON.parse(payload);

    if (!data) {
      return json({
        errorMsg: "Datos incompletos.\nPor favor, intente nuevamente.",
      });
    }

    const { password, token } = data;

    // Revalidamos en servidor lo que el formulario ya valida en cliente,
    // por si llega un POST directo sin pasar por el JS del navegador.
    const passwordError = handlePasswordValidation(password, true);
    if (passwordError) {
      return json({ errorMsg: passwordError });
    }

    // Validar token
    const validation = await validatePasswordResetToken(token);
    if (!validation.valid || !validation.userId) {
      return json({ errorMsg: validation.error });
    }

    // Hash de la contrtaseña
    const hashPass = await hashText(password);

    // Actualizar contraseña y marcar token como usado
    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: validation.userId },
          data: { password: hashPass, it_is_verified: true },
        }),
        prisma.passwordResetToken.deleteMany({
          where: { user_id: validation.userId },
        }),
      ]);

      // Redirigir al login con mensaje de éxito
      return json({
        reset_paswd: true,
      });
    } catch (error) {
      return json({
        errorMsg:
          "Error al restablecer la contraseña.\nPor favor, intente nuevamente.",
      });
    }
  }
};

/*==============================| Component |==============================*/
export default function ResetPasswordPage() {
  // Hooks...
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();

  // Memo
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  // Para la nueva contraseña
  const [password, setPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Para confirmación de contraseña
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorConfirmPass, setErrorConfirmPass] = useState("");
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Para cambio de contraseña
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setIsSubmitting(false);
    }

    if (fetcher.data?.reset_paswd) {
      toast.success(
        "Contraseña restablecida correctamente\nEn unos momentos será redirigido al inicio de sesión",
        {
          position: "top-center",
          duration: 10000,
          onAutoClose: () => (window.location.href = "/iniciar-sesion"),
        },
      );
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función que maneja el envio de formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let err = handlePasswordValidation(password, true);

    if (confirmPassword !== password) {
      err ||= "Las contraseñas no coinciden";
    }

    if (err) {
      toast.error(err);
      return;
    }

    setIsSubmitting(true);
    fetcher.submit(
      {
        action: "resetPassword",
        payload: JSON.stringify({
          token,
          password,
        }),
      },
      { method: "post" },
    );
  };

  // Mensaje de error de token
  if ("error" in loaderData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full">
          <div className="rounded-md bg-red-50 p-4">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{loaderData.error}</p>
              <p className="mt-2">
                El enlace puede haber expirado o ya fue usado.{" "}
                <a href="/recuperar-clave" className="font-medium underline">
                  Solicitar nuevo enlace
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formulario para nueva contraseña
  return (
    <div className="w-full h-full flex flex-col justify-center items-center bg-[#f2f4f7]">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[450px] min-h-[450px] flex flex-col justify-start items-center gap-y-6 rounded-lg bg-white px-4 pt-6 pb-4 shadow-lg"
      >
        <h1 className="text-center font-bold text-xl border-b border-gray-300 pb-2">
          Restablecer Contraseña
        </h1>
        <p className="text-gray-500 text-sm text-center px-8">
          Crea una nueva contraseña segura para tu cuenta.
        </p>
        <div className="w-[80%] flex flex-col gap-y-1">
          <InputWithIcon
            type={showPassword ? "text" : "password"}
            placeholder="Nueva contraseña"
            Icon={showPassword ? FaEye : FaEyeSlash}
            iconPosition="right"
            onIconClick={() => setShowPassword(!showPassword)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() =>
              setErrorPassword(handlePasswordValidation(password, true))
            }
          />
          {errorPassword && (
            <p className="grid grid-cols-[max-content_1fr] gap-x-1 text-[12px] text-red-500">
              <PiWarningCircle className="self-center" />
              {errorPassword}
            </p>
          )}
        </div>
        <div className="w-[80%] flex flex-col gap-y-1">
          <InputWithIcon
            type={showConfirmPass ? "text" : "password"}
            placeholder="Confirmar contraseña"
            Icon={showConfirmPass ? FaEye : FaEyeSlash}
            iconPosition="right"
            onIconClick={() => setShowConfirmPass(!showConfirmPass)}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => {
              let error = "";

              if (confirmPassword !== password) {
                error = "Las contraseñas no coinciden";
              }

              setErrorConfirmPass(error);
            }}
          />
          {errorConfirmPass && (
            <p className="grid grid-cols-[max-content_1fr] gap-x-1 text-[12px] text-red-500">
              <PiWarningCircle className="self-center" />
              {errorConfirmPass}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="bg-medium-turquoise-meraki text-white rounded-full px-16 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Guardando..." : "Guardar nueva contraseña"}
        </button>
      </form>
    </div>
  );
}
