import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import { Select } from "~/components/Input/Select";
import { Modal } from "~/components/Modal/Modal";
import { PermissionSession } from "~/services/auth/login.service";
import {
  createPasswordResetTokenDb,
  deleteManyPasswordResetTokenDb,
} from "~/services/db/passwordResetToken.service";
import { listRolesDb, RoleWithPermissions } from "~/services/db/role.service";
import {
  createUserDb,
  getUserDb,
  listUsersDb,
  updateUserDb,
  UserWithRole,
} from "~/services/db/user.service";
import { sendSetPasswordEmail } from "~/services/mail/resend.service";
import { getSession } from "~/services/sessions/sessions.service";
import { getDateGt, validatePermission } from "~/utils/common";
import { generateSecureToken, hashText } from "~/utils/crypto.server";

export const meta = () => {
  return [{ title: "USUARIOS" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  const validateRequest = validatePermission(session, 12, "Leer");
  if (validateRequest) throw validateRequest;
  return json({ dbUserId: Number(session.get("dbUserId")) });
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    const validateRequest = validatePermission(session, 12, "Leer");
    if (validateRequest) throw validateRequest;

    const [usersRes, rolesRes] = await Promise.all([
      listUsersDb(),
      listRolesDb({ its_administrative: true, active: true }),
    ]);

    if (!usersRes.success || !rolesRes.success) {
      return json({ errorMsg: "Ocurrió un error al cargar los usuarios" });
    }

    // Obtenemos los permisos
    const permissions: PermissionSession[] = session.get("permissions") || [];

    return json({
      users: usersRes.data,
      roles: rolesRes.data,
      allowedCreate: !!permissions.find(
        (p) => p.module_id == 12 && p.action === "Crear",
      ),
    });
  }

  if (action === "create-user") {
    const validateRequest = validatePermission(session, 12, "Crear");
    if (validateRequest) throw validateRequest;

    const {
      email,
      first_name,
      last_name,
      phone,
      role_id,
    }: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      role_id: string;
    } = JSON.parse(payload as string);

    if (!first_name || !last_name || !email || !role_id) {
      return json({ errorMsg: "Todos los campos marcados son obligatorios" });
    }

    // Contraseña temporal aleatoria: el usuario no puede iniciar sesión con esto,
    // debe definir la suya propia mediante el link que se le envía por correo.
    const randomPlaceholder = generateSecureToken();
    const hashedPlaceholder = await hashText(randomPlaceholder);

    const createRes = await createUserDb({
      first_name,
      last_name,
      email,
      phone,
      role_id: Number(role_id),
      password: hashedPlaceholder,
      it_is_verified: false,
      registration_date: new Date(),
    });

    if (!createRes.success) {
      return json({
        errorMsg: "Ocurrió un error al crear el usuario",
      });
    }

    const newUser = createRes.data;

    // Generamos el token de configuración de contraseña (igual patrón que recuperación,
    // pero con vigencia más larga ya que es una invitación, no un reseteo urgente)
    const rawToken = generateSecureToken();
    const hashedToken = await hashText(rawToken);

    const expires_at = new Date(getDateGt());
    expires_at.setHours(expires_at.getHours() + 24);

    const tokenRes = await createPasswordResetTokenDb({
      user_id: newUser.id,
      token: hashedToken,
      expires_at,
      created_at: getDateGt(),
    });

    if (!tokenRes.success) {
      return json({
        errorMsg:
          "El usuario se creó, pero ocurrió un error al generar el link de acceso. Usa 'Reenviar invitación' para intentarlo de nuevo.",
      });
    }

    const baseUrl = new URL(request.url).origin;
    const setPasswordUrl = `${baseUrl}/restablecer-clave?token=${rawToken}`;

    const emailSent = await sendSetPasswordEmail(
      email,
      setPasswordUrl,
      first_name,
    );

    if (!emailSent) {
      return json({
        errorMsg:
          "El usuario se creó, pero no se pudo enviar el correo de invitación. Usa 'Reenviar invitación' para intentarlo de nuevo.",
      });
    }

    return json({
      created_user: true,
    });
  }

  if (action === "resend-invite") {
    const validateRequest = validatePermission(session, 12, "Crear");
    if (validateRequest) throw validateRequest;

    const userId = Number(formData.get("user_id"));

    const userRes = await getUserDb({ id: userId });
    if (!userRes.success || !userRes.data) {
      return json({ errorMsg: "Usuario no encontrado" });
    }

    const rawToken = generateSecureToken();
    const hashedToken = await hashText(rawToken);
    const expires_at = new Date(getDateGt());
    expires_at.setHours(expires_at.getHours() + 24);

    // Invalidamos tokens previos de este usuario antes de crear uno nuevo
    await deleteManyPasswordResetTokenDb({ user_id: userId });

    const tokenRes = await createPasswordResetTokenDb({
      user_id: userId,
      token: hashedToken,
      expires_at,
      created_at: getDateGt(),
    });

    if (!tokenRes.success) {
      return json({
        errorMsg: "Ocurrió un error al generar el link de invitación",
      });
    }

    const baseUrl = new URL(request.url).origin;
    const setPasswordUrl = `${baseUrl}/restablecer-clave?token=${rawToken}`;

    const emailSent = await sendSetPasswordEmail(
      userRes.data.email,
      setPasswordUrl,
      userRes.data.first_name,
    );

    if (!emailSent) {
      return json({ errorMsg: "No se pudo enviar el correo de invitación" });
    }

    return json({ resent: true });
  }

  if (action === "toggle-active") {
    const validateRequest = validatePermission(session, 12, "Actualizar");
    if (validateRequest) throw validateRequest;

    const { id, active }: { id: number; active: boolean } = JSON.parse(
      (payload as string | null) || "{}",
    );

    const targetId = Number(id);
    const currentUserId = Number(session.get("dbUserId"));

    if (targetId === currentUserId) {
      return json({ errorMsg: "No puedes desactivar tu propia cuenta." });
    }

    const updateRes = await updateUserDb(targetId, { active });
    if (!updateRes.success) {
      return json({
        errorMsg: "Ocurrió un error al actualizar el estado del usuario",
      });
    }

    return json({ updated_status: updateRes.data.id });
  }

  return json({
    errorMsg: "Ocurrió un error al cargar la pagina",
  });
};

/*==============================| Component |==============================*/
export default function () {
  // Hooks...
  const { dbUserId } = useLoaderData<{ dbUserId: number }>();
  const fetcher = useFetcher();

  // Banderas
  const [panelOpen, setPanelOpen] = useState(false);
  const [allowedCreate, setAllowedCreate] = useState(false);
  const isSubmitting = fetcher.state !== "idle";

  // Usuarios y roles
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [toggleTarget, setToggleTarget] = useState<UserWithRole | null>(null);

  // Datos de nuevo usuario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");

  // Validaciones
  const isFormValid =
    firstName.trim() && lastName.trim() && email.trim() && roleId;

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
      setPanelOpen(false);
      setToggleTarget(null);
    }

    if (fetcher.data?.allowedCreate) {
      setAllowedCreate(true);
    }

    if (fetcher.data?.roles) {
      setRoles(fetcher.data.roles);
    }

    if (fetcher.data?.users) {
      setUsers(fetcher.data.users);
    }

    if (fetcher.data?.created_user) {
      toast.success("Se creo el usuario exitosamente");
      window.location.reload();
    }

    if (fetcher.data?.resent) {
      toast.success("Invitación enviada exitosamente");
    }

    if (fetcher.data?.updated_status) {
      const id = fetcher.data.updated_status;
      toast.success("Estado actualizado correctamente");
      setUsers((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, active: !row.active } : row,
        ),
      );
      setToggleTarget(null);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  const confirmToggleActive = () => {
    if (!toggleTarget) return;
    fetcher.submit(
      {
        action: "toggle-active",
        payload: JSON.stringify({
          id: toggleTarget.id,
          active: !toggleTarget.active,
        }),
      },
      { method: "post" },
    );
  };

  const handleCreate = () => {
    fetcher.submit(
      {
        action: "create-user",
        payload: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role_id: roleId,
        }),
      },
      { method: "POST" },
    );
  };

  return (
    <div className="h-full w-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-6 md:gap-3">
        <h1 className="md:hidden order-1 text-xl font-bold">Usuarios</h1>
        <h2 className="hidden md:block order-3 md:order-1 text-gray-400">
          Gestiona el personal administrativo con acceso al panel.
        </h2>
        {allowedCreate && (
          <PrimaryButton
            className="order-2 md:order-2"
            label="Nuevo Usuario"
            Icon={LuPlus}
            onClick={() => setPanelOpen(true)}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Correo</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Invitación</th>
              <th className="px-5 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: UserWithRole) => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="px-5 py-3.5 text-gray-700 font-medium">
                  {user.first_name} {user.last_name}
                </td>
                <td className="px-5 py-3.5 text-gray-500">{user.email}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#4674EA]/10 text-[#4674EA]">
                    {user.role.name}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      !user.active
                        ? "bg-gray-100 text-gray-500"
                        : user.it_is_verified
                        ? "bg-teal-50 text-teal-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {!user.active
                      ? "Inactivo"
                      : user.it_is_verified
                      ? "Activo"
                      : "Pendiente de verificación"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {!user.it_is_verified && (
                    <button
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("action", "resend-invite");
                        fd.set("user_id", String(user.id));
                        fetcher.submit(fd, { method: "post" });
                      }}
                      disabled={isSubmitting}
                      className="text-xs font-medium text-[#4674EA] hover:underline disabled:opacity-50"
                    >
                      Reenviar invitación
                    </button>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  {user.id === dbUserId ? (
                    <span
                      className="text-xs text-gray-400"
                      title="No puedes desactivar tu propia cuenta"
                    >
                      —
                    </span>
                  ) : (
                    <button
                      onClick={() => setToggleTarget(user)}
                      disabled={isSubmitting}
                      className={`text-xs font-medium hover:underline disabled:opacity-50 ${
                        user.active ? "text-[#F2768C]" : "text-[#52C9BB]"
                      }`}
                    >
                      {user.active ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-gray-400"
                >
                  Todavía no hay usuarios administrativos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Panel de nuevo usuario ── */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className="bg-white w-full md:w-[480px] h-full overflow-y-auto shadow-lg flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Nuevo usuario</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 flex-1">
              <p className="text-sm text-gray-500 -mt-1">
                Se enviará un correo al usuario para que defina su propia
                contraseña.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Nombre
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52C9BB]/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Apellido
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52C9BB]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52C9BB]/30"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">
                  Teléfono (opcional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52C9BB]/30"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Rol</label>
                <Select
                  id="role_id"
                  name="role_id"
                  className="mt-1 w-full"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value="">Selecciona un rol</option>
                  {roles.map((r: { id: number; name: string }) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setPanelOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={isSubmitting || !isFormValid}
                className="px-5 py-2 rounded-xl bg-[#52C9BB] hover:bg-[#52C9BB]/90 text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Creando..." : "Crear e invitar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmación activar/desactivar ── */}
      {toggleTarget && (
        <Modal
          open
          onClose={() => setToggleTarget(null)}
          title={toggleTarget.active ? "Desactivar usuario" : "Activar usuario"}
          footer={
            <>
              <button
                type="button"
                onClick={() => setToggleTarget(null)}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmToggleActive}
                disabled={isSubmitting}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  toggleTarget.active
                    ? "bg-pink-meraki hover:bg-pink-meraki/90"
                    : "bg-medium-turquoise-meraki hover:bg-medium-turquoise-meraki/90"
                }`}
              >
                {isSubmitting
                  ? "Guardando…"
                  : toggleTarget.active
                  ? "Desactivar"
                  : "Activar"}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            {toggleTarget.active
              ? `¿Desactivar a "${toggleTarget.first_name} ${toggleTarget.last_name}"? No podrá iniciar sesión hasta que se reactive su cuenta.`
              : `¿Activar a "${toggleTarget.first_name} ${toggleTarget.last_name}"? Podrá volver a iniciar sesión con su contraseña actual.`}
          </p>
        </Modal>
      )}
    </div>
  );
}
