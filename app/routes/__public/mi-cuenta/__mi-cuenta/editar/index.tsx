import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import { uploadProfileImage } from "~/services/cloudinary/upload";
import {
  createPasswordResetTokenDb,
  deleteManyPasswordResetTokenDb,
} from "~/services/db/passwordResetToken.service";
import {
  getOwnProfileUserDb,
  getUserDb,
  OwnProfileUser,
  updateUserDb,
} from "~/services/db/user.service";
import { sendPasswordResetEmail } from "~/services/mail/resend.service";
import {
  commitSession,
  getSession,
} from "~/services/sessions/sessions.service";
import { getDateGt, validatePermission } from "~/utils/common";
import { generateSecureToken, hashText } from "~/utils/crypto.server";
import { resizeImage } from "~/utils/image";
import { enforceRateLimits, getClientIp } from "~/utils/rateLimit.server";

export const meta = () => {
  return [{ title: "EDITAR CUENTA" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Verificamos que tenga permiso de Leer "editar mi Cuenta";
  const validateRequest = validatePermission(session, 6, "Leer");

  if (validateRequest) throw validateRequest;

  return json({
    edit_profile: searchParams.get("editProfile") === "true",
  });
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload, ...values } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    // Obtenemos la información del usuario
    const userInfoRes = await getOwnProfileUserDb({ id: dbUserId });

    if (!userInfoRes.success) {
      return json({
        errorMsg: "Ocurrió un error al obtener información",
      });
    }

    return json({
      loading_info: true,
      user: userInfoRes.data,
    });
  }

  if (action === "uploadProfile") {
    const file: File | string = values.profileImg;

    // Si no tiene un archivo se devuelve error
    if (typeof file === "string") {
      return json({
        errorMsg: "Ocurrió un error al actualizar el perfil",
      });
    }

    //Cargamos la imagen en cloudinary
    const uploadRes = await uploadProfileImage(file, dbUserId);

    if (!uploadRes.success) {
      return json({
        errorMsg: "Ocurrió un error al actualizar el perfil",
      });
    }

    // Modificamos el public id en el usuario
    const updateUserRes = await updateUserDb(dbUserId, {
      profile_public_id: uploadRes.data.public_id,
      profile_version: String(uploadRes.data.version),
    });

    if (!updateUserRes.success) {
      return json({
        errorMsg: "Ocurrió un error al actualizar el perfil",
      });
    }

    // Modificamos la sesion con el nuevo profile
    session.set("profile", uploadRes.data.public_id);
    session.set("profile_v", uploadRes.data.version);

    return json(
      { uploading_profile: true },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      },
    );
  }

  if (action === "updateUser") {
    const {
      first_name,
      last_name,
      phone,
    }: {
      first_name: string;
      last_name: string;
      phone: string | null;
    } = JSON.parse(payload as string);

    // Actualizamos los datos del usuario
    const updateRes = await updateUserDb(dbUserId, {
      first_name,
      last_name,
      phone,
    });

    if (!updateRes.success) {
      return json({
        errorMsg: "Ocurrió un error al actualizar los datos",
      });
    }

    // Guardamos los datos en la sesión
    session.set("first_name", first_name);
    session.set("last_name", last_name);

    return json(
      {
        update_user: true,
      },
      { headers: { "Set-Cookie": await commitSession(session) } },
    );
  }

  if (action === "requestPasswordChange") {
    // Límite por cuenta e IP para frenar el abuso de este reenvío.
    const rateLimitMsg = await enforceRateLimits([
      {
        action: "mi-cuenta-reset-password",
        identifier: String(dbUserId),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
      {
        action: "mi-cuenta-reset-password",
        identifier: getClientIp(request),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (rateLimitMsg) {
      return json({ errorMsg: rateLimitMsg }, { status: 429 });
    }

    // Obtenemos el usuario de la sesión (ya tenemos su id)
    const userInfoRes = await getUserDb({ id: dbUserId });

    if (!userInfoRes.success || !userInfoRes.data) {
      return json({ errorMsg: "Ocurrió un error al procesar la solicitud" });
    }

    const user = userInfoRes.data;
    const token = generateSecureToken();
    const hashToken = await hashText(token);
    const expiresAt = new Date(getDateGt().getTime() + 1000 * 60 * 15); // 15 min

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

    return json({ password_reset_sent: true });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

export default function () {
  // Hooks...
  const routeData = useRouteLoaderData("routes/__public");
  const { edit_profile } = useLoaderData<{ edit_profile: boolean }>();
  const fetcher = useFetcher();

  // usuario
  const [user, setUser] = useState<OwnProfileUser | null>(null);
  const initials = routeData.initials || "";
  const profile = routeData.profile;

  // Datos de usuario que se puede editar
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Banderas
  const [isLoading, setIsLoading] = useState(true);
  const [showChangeProfile, setShowChangeProfile] = useState(edit_profile);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [infoHasModified, setInfoHasModifie] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isRequestingPassReset, setIsRequestingPassReset] = useState(false);

  // Para la imagen de perfil
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

    if (fetcher.data?.user) {
      const tempUser: OwnProfileUser = fetcher.data?.user;

      setUser(tempUser);
      setFirstName(tempUser.first_name);
      setLastName(tempUser.last_name);
      setPhone(tempUser?.phone || "");
    }

    if (fetcher.data?.loading_info) {
      setIsLoading(false);
    }

    if (fetcher.data?.uploading_profile) {
      toast.success("Foto actualizada exitosamente");
      setIsUploadingProfile(false);
      setShowChangeProfile(false);
      setSelectedFile(null);
      setPreviewImage(null);
    }

    if (fetcher.data?.update_user) {
      toast.success("Datos actualizados correctamente");
      setIsUpdatingUser(false);
    }

    if (fetcher.data?.password_reset_sent) {
      toast.success(
        "Te enviamos un enlace a tu correo para cambiar la contraseña",
      );
      setIsRequestingPassReset(false);
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

  // Función para procesar archivos
  function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      return;
    }

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`La imagen no debe superar los ${maxSizeMb}MB`);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Funciones de Drag and drop
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // Función para cambio de archivos
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  // Función para subir la nueva imagen de perfil
  const handleUploadProfile = async () => {
    // Si no hay imagen se sale de la funcion
    if (!selectedFile) return;

    // Se redimenciona para bajar MB
    resizeImage(selectedFile)
      .then((result) => {
        setIsUploadingProfile(true);

        const data = new FormData();
        data.append("action", "uploadProfile");
        data.append("profileImg", result);

        fetcher.submit(data, {
          method: "POST",
          encType: "multipart/form-data",
        });
      })
      .catch((err) => {
        toast.error("Ocurrió un error al actualizar el perfil");
      });
  };

  // Función que maneja cambios de los datos de información
  const handleChangeInfo = (
    set: React.Dispatch<React.SetStateAction<string>>,
    value: string,
  ) => {
    setInfoHasModifie(true);
    set(value);
  };

  // Función para cambiar infomación del usuario
  const handleUpdateUser = () => {
    let error = "";
    if (firstName === "") error = "El nombre no puede estar vacio";

    if (lastName === "") error = "El apellido no puede estar vacio";

    if (error) {
      toast.error(error);
      return;
    }

    setIsUpdatingUser(true);

    fetcher.submit(
      {
        action: "updateUser",
        payload: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
        }),
      },
      { method: "post" },
    );
  };

  // Función para cambiar contraseña
  const handleRequestPasswordChange = () => {
    setIsRequestingPassReset(true);
    fetcher.submit({ action: "requestPasswordChange" }, { method: "post" });
  };

  // Si aun esta cargando la información
  if (isLoading || !user) {
    return (
      <div className="flex-grow flex justify-center items-center">
        <AiOutlineLoading3Quarters className="animate-spin w-16 h-16" />
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col gap-y-5 md:gap-y-10 md:px-5">
      {/* ── Encabezado ── */}
      <div className="w-full">
        <h1 className="text-2xl font-bold text-gray-800">Mi cuenta</h1>
        <p className="text-sm text-gray-400 mt-1">
          {`aquí esta toda tu información personal.`}
        </p>
      </div>
      {/* ── Información personal ── */}
      <div className="flex items-center gap-x-4 md:px-5 py-4 border-b border-gray-100">
        {profile ? (
          <img className="w-14 h-14 rounded-full" src={profile} />
        ) : (
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-lg font-medium text-emerald-700 flex-shrink-0">
            {initials}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">Victor Lopez</p>
          <p className="text-xs text-gray-500">
            Miembro desde {getMemberSince(new Date())}
          </p>
        </div>
        <button
          onClick={() => setShowChangeProfile((prev) => !prev)}
          className="ml-auto text-xs border border-medium-turquoise-meraki text-medium-turquoise-meraki rounded-full px-4 py-1.5 hover:bg-emerald-50 transition-colors"
        >
          Cambiar foto
        </button>
      </div>
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-y-5 md:gap-y-10">
        <Input
          label="Nombre*"
          value={firstName}
          onChange={(value) =>
            handleChangeInfo(setFirstName, value.target.value)
          }
        />
        <Input
          label="Apellido*"
          value={lastName}
          onChange={(value) =>
            handleChangeInfo(setLastName, value.target.value)
          }
        />
        <Input label="Correo Electrónico*" value={user.email || ""} disabled />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(value) => handleChangeInfo(setPhone, value.target.value)}
        />
      </div>
      <div className="w-full flex gap-x-5 justify-end items-center">
        <span className="text-gray-400 text-sm">Campos Obligatorios*</span>
        <PrimaryButton
          label={isUpdatingUser ? "Guardando..." : "Guardar Cambios"}
          disabled={!infoHasModified || isUpdatingUser}
          onClick={() => handleUpdateUser()}
        />
      </div>
      {/* ── Seguridad ── */}
      <div className="w-full border-t border-gray-100 pt-6 flex flex-col gap-y-2 md:px-5">
        <h2 className="text-sm font-semibold text-gray-700">Seguridad</h2>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-3">
          <div>
            <p className="text-sm text-gray-600">Contraseña</p>
            <p className="text-xs text-gray-400">
              Te enviaremos un enlace a tu correo para cambiarla de forma
              segura.
            </p>
          </div>
          <button
            onClick={handleRequestPasswordChange}
            disabled={isRequestingPassReset}
            className="text-xs border border-medium-turquoise-meraki text-medium-turquoise-meraki rounded-full px-4 py-1.5 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-fit"
          >
            {isRequestingPassReset ? "Enviando..." : "Cambiar contraseña"}
          </button>
        </div>
      </div>
      {/* ── Cambiar foto ── */}
      {showChangeProfile && (
        <div className="absolute left-0 bottom-0 w-full h-full z-[10] flex justify-center items-center">
          <div className="w-[90%] md:w-[480px] rounded-xl bg-white shadow-lg overflow-hidden">
            {/* Header */}
            <div className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800">
                Cambiar foto de perfil
              </p>
              <button
                onClick={() => setShowChangeProfile(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <LuX className="w-5 h-5" />
              </button>
            </div>

            {/* Dropzone */}
            <div className="px-5 py-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full rounded-lg border-2 border-dashed flex flex-col items-center gap-y-4 py-8 px-5 transition-colors ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200"
                }`}
              >
                {/* Preview circular dentro del dropzone */}
                {profile || previewImage ? (
                  <img
                    src={previewImage || profile}
                    alt="Imagen de Perfil"
                    className="w-24 h-24 rounded-full object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-lg font-medium text-emerald-700 flex-shrink-0">
                    {initials}
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Arrastra una imagen o selecciona un archivo
                  </p>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs border border-emerald-500 text-emerald-600 rounded-full px-4 py-1.5 hover:bg-emerald-50 transition-colors"
                >
                  Seleccionar imagen
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <p className="text-xs text-gray-400">JPG, PNG · Máx. 5 MB</p>
              </div>

              {selectedFile && (
                <p className="text-xs text-gray-500 mt-3 truncate">
                  Archivo seleccionado: {selectedFile.name}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="w-full px-5 py-4 flex items-center justify-end gap-x-3 border-t border-gray-100">
              <button
                onClick={() => setShowChangeProfile(false)}
                className="text-xs text-gray-600 rounded-full px-4 py-1.5 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadProfile}
                disabled={!selectedFile || isUploadingProfile}
                className="text-xs bg-emerald-600 text-white rounded-full px-4 py-1.5 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isUploadingProfile ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <label className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </label>
      <input
        className="w-full md:w-[70%] rounded-md border border-gray-300 py-2 md:py-4 px-3 text-gray-800 focus:outline-medium-turquoise-meraki"
        onChange={onChange}
        value={value}
        disabled={disabled}
      />
    </div>
  );
}
