import {
  ActionFunction,
  json,
  LoaderFunction,
  redirect,
} from "@remix-run/node";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import { PiWarningCircle } from "react-icons/pi";
import { toast } from "sonner";
import InputWithIcon from "~/components/Input/InputWithIcon";
import { getDateGt, handleEmailValidation } from "~/utils/common";
import { getUserDb } from "~/services/db/user.service";
import { sendPasswordResetEmail } from "~/services/mail/resend.service";
import {
  createPasswordResetTokenDb,
  deleteManyPasswordResetTokenDb,
} from "~/services/db/passwordResetToken.service";
import { generateSecureToken, hashText } from "~/utils/crypto.server";
import { getSession } from "~/services/sessions/sessions.service";

export const meta = () => {
  return [{ title: "Recuperar Contraseña" }];
};

/*==============================| Loader |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);

  if (session.get("dbUserId")) {
    return redirect("/");
  }

  return json({});
};

/*==============================| Action |==============================*/
export const action: ActionFunction = async ({ request }) => {
  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const email = formData.get("email")?.toString() as string;

  if (!email) {
    return json({ errorMsg: "El correo es requerido." }, { status: 400 });
  }

  const userInfoRes = await getUserDb({ email });
  const successMsg =
    "Si el correo existe, recibirás un enlace para restablecer tu contraseña.";

  // Siempre respondemos igual para evitar filtrar si el correo existe
  if (userInfoRes.success && userInfoRes.data) {
    const user = userInfoRes.data;

    const token = generateSecureToken();
    const hashToken = await hashText(token);
    const expiresAt = new Date(getDateGt().getTime() + 1000 * 60 * 30); // 30 min

    // registramos el token y eliminamos los anteriores
    await deleteManyPasswordResetTokenDb({ user_id: user.id });

    await createPasswordResetTokenDb({
      created_at: getDateGt(),
      expires_at: expiresAt,
      token: hashToken,
      user_id: user.id,
    });

    await sendPasswordResetEmail(
      user.email,
      `${new URL(request.url).origin}/restablecer-clave?token=${token}`,
      user.first_name,
    );
  }

  return json({
    successMsg,
  });
};

/*==============================| Component |==============================*/
export default function ForgotPasswordPage() {
  // Hooks..
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();

  // Para el correo
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [errorEmail, setErrorEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setIsSubmitting(false);
    }
    if (fetcher.data?.successMsg) {
      toast.success(fetcher.data.successMsg);
      setIsSubmitting(false);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  // Función que maneja el envio de formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const err = handleEmailValidation(email);
    if (err) {
      setErrorEmail(err);
      toast.error(err);
      return;
    }

    setIsSubmitting(true);
    fetcher.submit({ email }, { method: "post" });
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center bg-[#f2f4f7]">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[450px] min-h-[450px] flex flex-col justify-start items-center gap-y-6 rounded-lg bg-white px-4 pt-6 pb-4 shadow-lg"
      >
        <h1 className="text-center font-bold text-xl border-b border-gray-300 pb-2">
          Recuperar Contraseña
        </h1>
        <p className="text-gray-500 text-sm text-center px-8">
          Ingresa tu correo electrónico y te enviaremos un enlace para
          restablecer tu contraseña.
        </p>
        <div className="w-[80%] flex flex-col gap-y-1">
          <InputWithIcon
            type="email"
            placeholder="Correo electrónico"
            Icon={FaEnvelope}
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
        <button
          type="submit"
          className="bg-medium-turquoise-meraki text-white rounded-full px-16 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Enviando..." : "Enviar enlace de recuperación"}
        </button>
      </form>
    </div>
  );
}
