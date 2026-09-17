import { action_permission } from "@prisma/client";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaTimes, FaUsers } from "react-icons/fa";
import { LuPlus, LuShieldCheck } from "react-icons/lu";
import { toast } from "sonner";
import { PrimaryButton } from "~/components/Button/primary";
import {
  listModulesWithPermissionsDb,
  ModuleWithPermissions,
} from "~/services/db/module.service";
import { syncPermissionRoleDb } from "~/services/db/permission_role.service";
import {
  createRoleDb,
  listRolesDb,
  RoleWithPermissions,
  updateRoleDb,
} from "~/services/db/role.service";
import { getSession } from "~/services/sessions/sessions.service";
import { validatePermission } from "~/utils/common";

export const meta = () => {
  return [{ title: "ROLES" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  const validateRequest = validatePermission(session, 11, "Leer");
  if (validateRequest) throw validateRequest;
  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  if (action === "loadInformation") {
    const validateRequest = validatePermission(session, 11, "Leer");
    if (validateRequest) throw validateRequest;

    const [rolesRes, modulesRes] = await Promise.all([
      listRolesDb({ its_administrative: true }),
      listModulesWithPermissionsDb({
        is_active: true,
        nav_audience: "ADMIN_ONLY",
      }),
    ]);

    if (!rolesRes.success || !modulesRes.success) {
      return json({ errorMsg: "Ocurrió un error al cargar los roles" });
    }

    return json({
      roles: rolesRes.data,
      modules: modulesRes.data,
    });
  }

  if (action === "save-role") {
    let data: {
      id?: number;
      name: string;
      description: string;
      permission_ids: number[];
    } = JSON.parse((payload as string | null) || "{}");

    const validateRequest = validatePermission(
      session,
      11,
      data.id ? "Actualizar" : "Crear",
    );
    if (validateRequest) throw validateRequest;

    const id = data.id;
    const name = String(data.name || "").trim();
    const description = data.description || null;
    const permissionIds = data.permission_ids;

    if (!name) {
      return json({ errorMsg: "El nombre del rol es obligatorio" });
    }

    let roleId: number;

    if (id) {
      roleId = Number(id);
      const updateRes = await updateRoleDb(roleId, { name, description });
      if (!updateRes.success) {
        return json({ errorMsg: "Ocurrió un error al actualizar el rol" });
      }
    } else {
      const createRes = await createRoleDb({
        name,
        description,
        active: true,
        its_administrative: true,
        created_in: new Date(),
      });
      if (!createRes.success) {
        return json({ errorMsg: "Ocurrió un error al crear el rol" });
      }
      roleId = createRes.data.id;
    }

    const syncRes = await syncPermissionRoleDb(roleId, permissionIds);
    if (!syncRes.success) {
      return json({ errorMsg: "Ocurrió un error al guardar los permisos" });
    }

    // Obtenemos el dato del rol actualizado
    const roleRes = await listRolesDb({ id: roleId });

    if (!roleRes.success) {
      return json({
        errorMsg:
          "Ocurrió un error al mostrar los datos, solo refresque la pantalla",
      });
    }

    return json({
      updated_role: id ? roleRes.data[0] : undefined,
      created_role: !id ? roleRes.data[0] : undefined,
    });
  }

  if (action === "toggle-active") {
    const datos: { id: string; active: boolean } = JSON.parse(
      (payload as string | null) || "{}",
    );

    const validateRequest = validatePermission(session, 11, "Actualizar");

    if (validateRequest) throw validateRequest;

    const id = Number(datos.id);
    const active = datos.active;

    const updateRes = await updateRoleDb(id, { active });
    if (!updateRes.success) {
      return json({
        errorMsg: "Ocurrió un error al actualizar el estado del rol",
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
  const fetcher = useFetcher();

  // Roles y modulos
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [modules, setModules] = useState<ModuleWithPermissions[]>([]);

  // Banderas
  const [panelOpen, setPanelOpen] = useState(false);
  const isSubmitting = fetcher.state !== "idle";

  // Creacion/edición de rol
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<
    Set<number>
  >(new Set());

  const ACTIONS: action_permission[] = [
    "Leer",
    "Crear",
    "Actualizar",
    "Eliminar",
  ];

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
    }

    if (fetcher.data?.roles) {
      setRoles(fetcher.data.roles);
    }

    if (fetcher.data?.modules) {
      setModules(fetcher.data.modules);
    }

    if (fetcher.data?.updated_status) {
      const id = fetcher.data.updated_status;
      toast.success("Estado actualizado correctamente");
      setRoles((prev) =>
        prev.map((row) => {
          if (row.id == id) {
            return { ...row, active: !row.active };
          }
          return row;
        }),
      );
    }

    if (fetcher.data?.updated_role) {
      const role = fetcher.data.updated_role;
      toast.success("Rol actualizado correctamente");

      setRoles((prev) =>
        prev.map((row) => {
          if (row.id === role.id) return role;
          return row;
        }),
      );

      setPanelOpen(false);
    }

    if (fetcher.data?.created_role) {
      const role = fetcher.data.created_role;
      toast.success("Rol creado correctamente");

      setRoles((prev) => [...prev, role]);

      setPanelOpen(false);
    }
  }, [fetcher.data]);

  /*------------------------------FUNCIONES------------------------------*/
  const openCreate = () => {
    setEditingRole(null);
    setName("");
    setDescription("");
    setSelectedPermissionIds(new Set());
    setPanelOpen(true);
  };

  const openEdit = (role: RoleWithPermissions) => {
    setEditingRole(role.id);
    setName(role.name);
    setDescription(role.description || "");
    setSelectedPermissionIds(
      new Set(role.permission_role.map((pr) => pr.permission_id)),
    );
    setPanelOpen(true);
  };

  const togglePermission = (permissionId: number) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const toggleActive = (role: RoleWithPermissions) => {
    fetcher.submit(
      {
        action: "toggle-active",
        payload: JSON.stringify({
          id: role.id,
          active: !role.active,
        }),
      },
      { method: "post" },
    );
  };

  const handleSave = () => {
    fetcher.submit(
      {
        action: "save-role",
        payload: JSON.stringify({
          id: editingRole ? editingRole : undefined,
          name,
          description,
          permission_ids: Array.from(selectedPermissionIds),
        }),
      },
      { method: "post" },
    );
  };

  return (
    <div className="h-full w-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-6 md:gap-3">
        <h1 className="md:hidden order-1 text-xl font-bold">Roles</h1>
        <h2 className="hidden md:block order-3 md:order-1 text-gray-400">
          Gestiona los roles administrativos y sus permisos por módulo.
        </h2>
        <PrimaryButton
          className="order-2 md:order-2"
          label="Nuevo Rol"
          Icon={LuPlus}
          onClick={openCreate}
        />
      </div>

      <div className="flex flex-col gap-3">
        {roles.map((role: RoleWithPermissions) => (
          <div
            key={role.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-4"
          >
            <div className="hidden w-10 h-10 rounded-full bg-[#4674EA]/10 text-[#4674EA] md:flex items-center justify-center flex-shrink-0">
              <LuShieldCheck className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between md:justify-start items-center gap-2">
                <p className="font-semibold text-gray-800 truncate">
                  {role.name}
                </p>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    role.active
                      ? "bg-teal-50 text-teal-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {role.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              {role.description && (
                <p className="text-sm text-gray-400 truncate">
                  {role.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                <FaUsers className="w-3 h-3" />
                {role._count.user}{" "}
                {role._count.user === 1 ? "usuario" : "usuarios"} ·{" "}
                {role.permission_role.length} permisos asignados
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openEdit(role)}
                className="px-4 py-2 rounded-lg border border-[#52C9BB] text-sm font-medium text-[#52C9BB] hover:bg-[#52C9BB]/5 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => toggleActive(role)}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  role.active
                    ? "border border-[#F2768C] text-[#F2768C] hover:bg-[#F2768C]/5"
                    : "bg-[#52C9BB] text-white hover:bg-[#52C9BB]/90"
                }`}
              >
                {role.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Panel de crear/editar rol + matriz de permisos ── */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className="bg-white w-full md:w-[640px] h-full overflow-y-auto shadow-lg flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editingRole ? "Editar rol" : "Nuevo rol"}
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 flex-1">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Nombre del rol
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Coordinador de adopciones"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52C9BB]/30"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">
                  Descripción (opcional)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descripción del rol"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#52C9BB]/30"
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">
                  Permisos por módulo
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2.5 font-medium">Módulo</th>
                        {ACTIONS.map((action) => (
                          <th
                            key={action}
                            className="px-3 py-2.5 font-medium text-center"
                          >
                            {action}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((module: ModuleWithPermissions) => (
                        <tr
                          key={module.id}
                          className="border-t border-gray-100"
                        >
                          <td className="px-3 py-2.5 text-gray-700 font-medium whitespace-nowrap">
                            {module.name}
                          </td>
                          {ACTIONS.map((action) => {
                            const perm = module.permission.find(
                              (p) => p.action === action,
                            );
                            return (
                              <td
                                key={action}
                                className="px-3 py-2.5 text-center"
                              >
                                {perm ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedPermissionIds.has(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                    className="w-4 h-4 accent-[#52C9BB] cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-gray-200">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                onClick={handleSave}
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-2 rounded-xl bg-[#52C9BB] hover:bg-[#52C9BB]/90 text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Guardando..." : "Guardar rol"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
