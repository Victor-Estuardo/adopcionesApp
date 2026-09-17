import {
  ActionFunction,
  json,
  LoaderFunction,
  redirect,
} from "@remix-run/node";
import InputWithIcon from "~/components/Input/InputWithIcon";
import { FaEnvelope, FaEye, FaEyeSlash } from "react-icons/fa";
import React, { useEffect, useState } from "react";
import { PiWarningCircle } from "react-icons/pi";
import { toast } from "sonner";
import { useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import {
  getDateGt,
  getFirstAdminModuleRoute,
  handleEmailValidation,
  handlePasswordValidation,
} from "~/utils/common";
import { generateSecureToken, hashText } from "~/utils/crypto.server";
import {
  commitSession,
  getSession,
} from "~/services/sessions/sessions.service";
import { loginWebApp } from "~/services/auth/login.service";
import { sendVerificationEmail } from "~/services/mail/resend.service";
import { getUserDb } from "~/services/db/user.service";
import {
  createAccountVerificationTokenDb,
  deleteManyAccountVerificationTokenDb,
} from "~/services/db/accountVerificationToken.service";
import { ModuleSession } from "~/services/db/module.service";
import { enforceRateLimits, getClientIp } from "~/utils/rateLimit.server";

export const meta = () => {
  return [{ title: "Iniciar sesión" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);

  if (session.get("dbUserId")) {
    return redirect(session.get("administrative") ? "/admin" : "/mi-cuenta");
  }

  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "login") {
    const data: {
      email: string;
      password: string;
    } = JSON.parse(payload as string);

    const { email, password } = data;

    // Límite por IP (fuerza bruta distribuida) y por correo (ataque
    // dirigido a una cuenta desde varias IPs) a la vez; no se distingue
    // cuál falló en el mensaje, para no dar pistas de enumeración.
    const rateLimitMsg = await enforceRateLimits([
      {
        action: "login",
        identifier: getClientIp(request),
        limit: 20,
        windowMs: 15 * 60 * 1000,
      },
      {
        action: "login",
        identifier: email.toLowerCase(),
        limit: 5,
        windowMs: 15 * 60 * 1000,
      },
    ]);
    if (rateLimitMsg) {
      return json({ errorMsg: rateLimitMsg }, { status: 429 });
    }

    // Verificamos y creamos la sesión
    const loginRes = await loginWebApp(email, password, session);

    if (!loginRes.sucess) {
      return json({
        errorMsg: loginRes.errorMsg,
        errorEmail: loginRes.errorEmail,
        errorPass: loginRes.errorPass,
        verifyAccount: loginRes.verifyAccount,
      });
    }

    // verificamos i hay una ruta a redireccionar en especifico
    const url = new URL(request.url);
    const search = url.searchParams;
    const modules: ModuleSession[] = session.get("modules") || [];

    return redirect(
      search.get("redirect") ||
        (loginRes?.administrative
          ? getFirstAdminModuleRoute(modules)
          : "/mi-cuenta"),
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      },
    );
  }

  if (action === "forwardEmail") {
    let data: {
      email: string;
    } = JSON.parse(payload as string);

    const { email } = data;

    // Límite por IP y por correo para frenar el abuso de este reenvío.
    const rateLimitMsg = await enforceRateLimits([
      {
        action: "iniciar-sesion-forward",
        identifier: getClientIp(request),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
      {
        action: "iniciar-sesion-forward",
        identifier: email.toLowerCase(),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (rateLimitMsg) {
      return json({ errorMsg: rateLimitMsg }, { status: 429 });
    }

    // Obtenemos el usuario por su correo
    const userInfoRes = await getUserDb({ email });

    if (!userInfoRes.success || !userInfoRes.data) {
      return json({
        send_verification: true,
      });
    }

    const user = userInfoRes.data;

    // Invalidamos cualquier token pendiente antes de emitir uno nuevo
    // (igual patrón que "resend-invite" en usuarios/index.tsx).
    await deleteManyAccountVerificationTokenDb({ user_id: user.id });

    const verificationToken = generateSecureToken();
    const hashedVerificationToken = await hashText(verificationToken);
    await createAccountVerificationTokenDb({
      user_id: user.id,
      token: hashedVerificationToken,
      expires_at: new Date(getDateGt().getTime() + 1000 * 60 * 60 * 8), // 8h
      created_at: getDateGt(),
    });

    const verificationLink = `${new URL(request.url).origin}/verificar-cuenta?token=${verificationToken}`;
    await sendVerificationEmail(user.email, verificationLink, user.first_name);

    return json({
      send_verification: true,
    });
  }

  return json({});
};

/*==============================| Component |==============================*/
export default function () {
  //Hooks..
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Para vista de contraseña
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmiting, setIsSubmiting] = useState(false);
  const [isForwardingEmail, setIsForwardingEmail] = useState(false);

  // Para errores generales
  const [verifyAccount, setVerifyAccount] = useState(false);

  // Para errores en correo o contraseña
  const [errorEmail, setErrorEmail] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  // Para entrada de correo y contraseña
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    // Mensaje de error durante algun proceso
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setIsSubmiting(false);
    }

    // Errores en el inicio de sesión
    if (fetcher.data?.errorPass) {
      setErrorPassword(fetcher.data?.errorPass);
      setIsSubmiting(false);
    }

    if (fetcher.data?.errorEmail) {
      setErrorEmail(fetcher.data.errorEmail);
      setIsSubmiting(false);
    }

    // Para errores de autenticación de correo
    if (fetcher.data?.verifyAccount) {
      setVerifyAccount(true);
      setIsSubmiting(false);
    }

    // Para envio de correo de autenticación
    if (fetcher.data?.send_verification) {
      toast.success("Correo de verificación enviado exitosamente.");
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función que maneja el envio de formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Se previene el envio por defecto del formulario

    const err =
      handleEmailValidation(email) || handlePasswordValidation(password);

    if (err) {
      toast.error(err, { duration: 3000 });
      return;
    }

    setIsSubmiting(true);
    fetcher.submit(
      {
        action: "login",
        payload: JSON.stringify({
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
          email,
        }),
      },
      { method: "post" },
    );
  };

  return (
    <div className="w-full h-full flex flex-col justify-end sm:justify-center items-center bg-black/60 sm:bg-[#f2f4f7]">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[450px] h-[80%] lg:h-auto sm:min-h-[550px] overflow-y-auto flex flex-col justify-start items-center gap-y-4 sm:gap-y-6 rounded-t-3xl sm:rounded-lg bg-white px-4 pt-6 pb-4"
      >
        <h1 className="w-full text-center font-bold text-xl border-b border-gray-300 pb-2">
          Inicia sesión
        </h1>
        <div className="w-[80%] flex flex-col gap-y-1">
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
        <div className="w-[80%] flex flex-col gap-y-1">
          <InputWithIcon
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            Icon={showPassword ? FaEye : FaEyeSlash}
            iconPosition="right"
            onIconClick={() => setShowPassword(!showPassword)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setErrorPassword(handlePasswordValidation(password))}
          />
          {errorPassword && (
            <p className="grid grid-cols-[max-content_1fr] gap-x-1 text-[12px] text-red-500">
              <PiWarningCircle className="self-center" />
              {errorPassword}
            </p>
          )}
        </div>
        {verifyAccount && (
          <div className="w-full p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-amber-600 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">
                  Verificación de cuenta pendiente
                </h3>
                <p className="text-sm text-amber-800 mb-3">
                  Necesitas verificar tu correo electrónico antes de iniciar
                  sesión. Revisa tu bandeja de entrada y la carpeta de spam.
                </p>
                <p className="text-sm text-amber-700">
                  ¿No recibiste el correo?{" "}
                  <button
                    className="text-blue-meraki font-medium underline underline-offset-2 hover:text-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => handleForwardEmail()}
                    disabled={isForwardingEmail}
                  >
                    Reenviar correo de verificación
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="pt-6">
          <button
            className="bg-medium-turquoise-meraki text-white rounded-full px-16 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmiting || verifyAccount}
          >
            {isSubmiting ? "Cargando..." : "Iniciar sesión"}
          </button>
        </div>
        <div
          className="underline underline-offset-4 text-gray-400"
          role="button"
          onClick={() => navigate("/recuperar-clave")}
        >
          ¿Has olvidado tu contraseña?
        </div>
        <div className="w-full pt-3 sm:pt-5 border-b border-gray-300" />
        <p>¿Eres Nuevo?</p>
        <div
          className="border border-medium-turquoise-meraki rounded-full px-16 py-3"
          role="button"
          onClick={() => navigate("/crear-cuenta")}
        >
          Crear Cuenta
        </div>
      </form>
    </div>
  );
}
