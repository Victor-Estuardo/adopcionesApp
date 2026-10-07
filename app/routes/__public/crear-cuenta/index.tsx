import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import InputWithIcon from "~/components/Input/InputWithIcon";
import { FaEnvelope, FaEye, FaEyeSlash } from "react-icons/fa";
import React, { useEffect, useState } from "react";
import { PiWarningCircle } from "react-icons/pi";
import { toast } from "sonner";
import { useFetcher, useNavigate } from "@remix-run/react";
import Input from "~/components/Input";
import {
  getDateGt,
  handleEmailValidation,
  handlePasswordValidation,
} from "~/utils/common";
import { generateSecureToken, hashText } from "~/utils/crypto.server";
import { createUserDb, getEssentialUserDb } from "~/services/db/user.service";
import {
  createAccountVerificationTokenDb,
  deleteManyAccountVerificationTokenDb,
} from "~/services/db/accountVerificationToken.service";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { sendVerificationEmail } from "~/services/mail/resend.service";
import { LuMail, LuCircleCheck, LuClock, LuCircleAlert } from "react-icons/lu";
import { enforceRateLimits, getClientIp } from "~/utils/rateLimit.server";

export const meta = () => {
  return [{ title: "Crear cuenta | Asociación Meraki" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "createUser") {
    let data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    } | null = null;

    if (typeof payload === "string") data = JSON.parse(payload);

    if (!data) {
      return json({
        errorMsg:
          "Ocurrió un error al crear la cuenta\nPor favor, intenta de nuevo.",
      });
    }

    const { email, firstName, lastName, password } = data;

    // Revalidamos en servidor lo que el formulario ya valida en cliente,
    // por si llega un POST directo sin pasar por el JS del navegador.
    const emailError = handleEmailValidation(email);
    const passwordError = handlePasswordValidation(password, true);
    if (emailError || passwordError) {
      return json({ errorMsg: emailError || passwordError });
    }

    // Límite por IP para frenar registros masivos automatizados.
    const rateLimitMsg = await enforceRateLimits([
      {
        action: "crear-cuenta",
        identifier: getClientIp(request),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (rateLimitMsg) {
      return json({ errorMsg: rateLimitMsg }, { status: 429 });
    }

    // Hash de la contrtaseña
    const hashPass = await hashText(password);

    // Creamos el usuario en base de datos
    const createUserRes = await createUserDb({
      first_name: firstName,
      last_name: lastName,
      password: hashPass,
      email: email,
      role_id: 3,
    });

    if (!createUserRes.success) {
      return json({
        errorMsg:
          "No se pudo completar el registro.\nSi ya tienes una cuenta, intenta iniciar sesión o recuperar tu contraseña.",
      });
    }

    // Información del nuevo uuario
    const user = createUserRes.data;

    // Token de verificación de cuenta: opaco, hasheado y de un solo uso
    // (se borra al usarse en /verificar-cuenta, ver validateAccountVerificationToken).
    const verificationToken = generateSecureToken();
    const hashedVerificationToken = await hashText(verificationToken);
    await createAccountVerificationTokenDb({
      user_id: user.id,
      token: hashedVerificationToken,
      expires_at: new Date(getDateGt().getTime() + 1000 * 60 * 60 * 8), // 8h
      created_at: getDateGt(),
    });

    const verificationLink = `${new URL(request.url).origin}/verificar-cuenta?token=${verificationToken}`;
    await sendVerificationEmail(email, verificationLink, firstName);

    return json({
      create_account: true,
      new_user_id: user.id,
    });
  }

  if (action === "forwardEmail") {
    let data: {
      userId: number;
    } | null = null;

    if (typeof payload === "string") {
      data = JSON.parse(payload);
    }

    if (!data)
      return json({
        errorMsg:
          "Ocurrió un error al enviar el correo, por favor intenta de nuevo.",
      });

    const { userId } = data;

    // Límite por IP y por cuenta para frenar el abuso de este reenvío.
    const rateLimitMsg = await enforceRateLimits([
      {
        action: "crear-cuenta-forward",
        identifier: getClientIp(request),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
      {
        action: "crear-cuenta-forward",
        identifier: String(userId),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (rateLimitMsg) {
      return json({ errorMsg: rateLimitMsg }, { status: 429 });
    }

    // El correo/nombre se toman siempre de la cuenta en BD — nunca del
    // cliente — para no permitir reenviar el link de verificación a una
    // dirección arbitraria.
    const userRes = await getEssentialUserDb({ id: Number(userId) });

    if (!userRes.success || !userRes.data) {
      return json({
        errorMsg:
          "Ocurrió un error al enviar el correo, por favor intenta de nuevo.",
      });
    }

    // Invalidamos cualquier token pendiente antes de emitir uno nuevo
    // (igual patrón que "resend-invite" en usuarios/index.tsx).
    await deleteManyAccountVerificationTokenDb({ user_id: Number(userId) });

    const verificationToken = generateSecureToken();
    const hashedVerificationToken = await hashText(verificationToken);
    await createAccountVerificationTokenDb({
      user_id: Number(userId),
      token: hashedVerificationToken,
      expires_at: new Date(getDateGt().getTime() + 1000 * 60 * 60 * 8), // 8h
      created_at: getDateGt(),
    });

    const verificationLink = `${new URL(request.url).origin}/verificar-cuenta?token=${verificationToken}`;
    await sendVerificationEmail(
      userRes.data.email,
      verificationLink,
      userRes.data.first_name,
    );

    return json({
      send_email: true,
    });
  }

  return json({});
};

/*==============================| Component |==============================*/
export default function () {
  // Hooks...
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // Información del usuario
  const [userId, setUserId] = useState(0);

  // Información del formulario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Reporte de errores
  const [errorEmail, setErrorEmail] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [errorName, setErrorName] = useState("");

  // Cambios en la vista
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isForwardingEmail, setIsForwardingEmail] = useState(false);

  // Creación de cuenta
  const [createAccount, setCreateAccount] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    // Mensaje de error durante algun proceso
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setIsCreating(false);
      setIsForwardingEmail(false);
    }
    if (fetcher.data?.create_account) {
      setCreateAccount(true);
      setUserId(fetcher.data.new_user_id);
    }
    if (fetcher.data?.send_email) {
      toast.success("Correo enviado exitosamente.");
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  //Función que maneja cambio en nombre y apellido
  const handleNameValidation = () => {
    let error = "";

    if (!firstName || !lastName) {
      error = "Nombre y apellido requeridos";
    }

    setErrorName(error);
    return error;
  };

  // Función que maneja el envio de formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Se previene el envio por defecto del formulario

    const err =
      handleNameValidation() ||
      handleEmailValidation(email) ||
      handlePasswordValidation(password, true);

    if (err) {
      toast.error(err, { duration: 3000 });
      return;
    }

    if (!acceptedTerms) {
      toast.error(
        "Debes aceptar los Términos y Condiciones y la Política de Privacidad",
        { duration: 3000 },
      );
      return;
    }

    setIsCreating(true);
    fetcher.submit(
      {
        action: "createUser",
        payload: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
        }),
      },
      { method: "post" },
    );
  };

  // Función para reenviar el codigo de verificación
  const handleForwardEmail = () => {
    setIsForwardingEmail(true);
    fetcher.submit(
      {
        action: "forwardEmail",
        payload: JSON.stringify({
          userId,
          email,
        }),
      },
      { method: "post" },
    );
  };

  if (createAccount) {
    return (
      <div className="w-full h-full flex flex-col justify-end sm:justify-center items-center bg-black/60 sm:bg-[#f2f4f7]">
        <div className="w-full sm:w-[450px] h-[80%] lg:h-auto sm:min-h-[550px] overflow-y-auto flex flex-col justify-start items-center gap-y-4 sm:gap-y-6 rounded-t-3xl sm:rounded-lg bg-white px-4 pt-6 pb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
              <LuMail
                className="w-10 h-10 text-emerald-600"
                strokeWidth={1.5}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-white">
              <LuCircleCheck className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              ¡Cuenta creada exitosamente!
            </h1>
            <p className="text-gray-500 text-sm">
              Solo un paso más para comenzar
            </p>
          </div>
          <div className="w-full bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <LuMail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Revisa tu correo electrónico
                </p>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Te hemos enviado un enlace de verificación. Haz clic en él
                  para activar tu cuenta y empezar a disfrutar de todos los
                  beneficios.
                </p>
              </div>
            </div>
          </div>
          <div className="w-full space-y-4">
            <div className="flex items-start gap-3 text-left">
              <LuClock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  El enlace expira en 8 horas
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Por tu seguridad, el enlace de verificación tiene validez
                  limitada
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-left">
              <LuCircleAlert className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  ¿No lo encuentras?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Revisa tu carpeta de spam o correo no deseado. A veces los
                  correos pueden llegar ahí.
                </p>
              </div>
            </div>
          </div>
          <div className="w-full pt-4 border-t border-gray-200 space-y-3">
            <button
              className="w-full bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 font-medium rounded-lg px-6 py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => handleForwardEmail()}
              disabled={isForwardingEmail}
            >
              {isForwardingEmail
                ? "Reenviando..."
                : "Reenviar correo de verificación"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-end sm:justify-center items-center bg-black/60 sm:bg-[#f2f4f7]">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[450px] h-[80%] lg:h-auto sm:min-h-[550px] overflow-y-auto flex flex-col justify-start items-center gap-y-4 sm:gap-y-6 rounded-t-3xl sm:rounded-lg bg-white px-4 pt-6 pb-4"
      >
        <h1 className="w-full text-center font-bold text-xl border-b border-gray-300 pb-2">
          Crea una cuenta
        </h1>
        <div className="w-full flex flex-col items-start gap-y-4 sm:gap-y-6">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <Input
              placeholder="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => handleNameValidation()}
            />
            <Input
              placeholder="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => handleNameValidation()}
            />
            {errorName && (
              <p className="col-span-2 grid grid-cols-[max-content_1fr] gap-x-1 text-[12px] text-red-500">
                <PiWarningCircle className="self-center" />
                {errorName}
              </p>
            )}
          </div>
          <div className="w-full flex flex-col gap-y-1">
            <InputWithIcon
              type="email"
              placeholder="Correo electrónico"
              Icon={FaEnvelope}
              iconClassName="pointer-events-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setErrorEmail(handleEmailValidation(email))}
            />
            {errorEmail && (
              <p className="grid grid-cols-[max-content_1fr] gap-x-1 text-[12px] text-red-500">
                <PiWarningCircle className="self-center" />
                {errorEmail}
              </p>
            )}
          </div>
          <div className="w-full flex flex-col gap-y-1">
            <InputWithIcon
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
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
              <p className="flex justify-start items-center gap-x-1 text-[12px] text-red-500">
                <PiWarningCircle />
                {errorPassword}
              </p>
            )}
          </div>
        </div>
        <label className="w-full flex items-start gap-x-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-medium-turquoise-meraki"
          />
          <span>
            Acepto los{" "}
            <a
              href="/terminos-y-condiciones"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 font-medium hover:text-teal-700 underline"
            >
              Términos y Condiciones
            </a>{" "}
            y la{" "}
            <a
              href="/politica-privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 font-medium hover:text-teal-700 underline"
            >
              Política de Privacidad
            </a>
          </span>
        </label>
        <div className="pt-6">
          <button
            className="bg-medium-turquoise-meraki text-white rounded-full px-16 py-3 disabled:opacity-60"
            disabled={isCreating || !acceptedTerms}
            onClick={(e) => {
              if (isCreating) e.preventDefault();
            }}
          >
            {isCreating ? (
              <AiOutlineLoading3Quarters className="animate-spin" />
            ) : (
              "Crear cuenta"
            )}
          </button>
        </div>
        <div className="w-full pt-3 sm:pt-5 border-b border-gray-300" />
        <p>¿Ya tienes cuenta?</p>
        <div
          className="border border-medium-turquoise-meraki rounded-full px-16 py-3"
          role="button"
          onClick={() => {
            if (!isCreating) navigate("/iniciar-sesion");
          }}
        >
          Inicia sesión
        </div>
      </form>
    </div>
  );
}
