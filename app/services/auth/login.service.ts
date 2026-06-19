import { $Enums } from "@prisma/client";
import { getUserDb } from "../db/user.service";
import { Session } from "@remix-run/node";
import { verifyText } from "~/utils/crypto.server";
import { getRoleByIdDb } from "../db/role.service";
import { listPermissionRoleDb } from "../db/permission_role.service";
import { listModulesForSessionDb } from "../db/module.service";

export interface PermissionSession {
  name: string;
  module_id: number;
  action: $Enums.action_permission;
}

type LoginResponse =
  | {
      sucess: false;
      errorMsg?: string;
      errorEmail?: string;
      errorPass?: string;
      verifyAccount?: boolean;
    }
  | {
      sucess: true;
      [x: string]: any;
    };

/**
 * Función para crear el inicio de sesión dle usuario a la app
 * @param email Correo del usuario
 * @param password Contraseña a verificar
 * @returns
 */
export async function loginWebApp(
  email: string,
  password: string,
  session: Session,
): Promise<LoginResponse> {
  // ======== | Mensaje de errores
  const errorMsg =
    "Ocurrió un error al iniciar sesión\nPor favor, intente nuevamente.";
  const errorEmail = "¿Seguro que has introducido tu correo correctamente?";
  const errorPass =
    'Contraseña incorrecta. Vuelve a intentarlo o selecciona "¿Has olvidado tu contraseña?" para cambiarla.';

  // Obtenemos el usuario ligado al correo
  const userInfoRes = await getUserDb({ email });

  if (!userInfoRes.success) {
    return {
      sucess: false,
      errorMsg,
    };
  }

  if (!userInfoRes.data) {
    return {
      sucess: false,
      errorEmail,
      errorPass,
    };
  }

  const userInfo = userInfoRes.data;

  // Verificamos la autenticidad de la contraseña
  const validPassword = await verifyText(password, userInfo.password);

  if (!validPassword) {
    return {
      sucess: false,
      errorEmail,
      errorPass,
    };
  }

  // Si no se ha verificado la cuenta se solicita
  if (!userInfo.it_is_verified) {
    return {
      sucess: false,
      verifyAccount: true,
    };
  }

  // Si es valido se obtiene información adicional
  // Información de rol
  const roleInfoRes = await getRoleByIdDb(userInfo.role_id);

  // Lista de permisos del usuario
  const permissionRoleListRes = await listPermissionRoleDb({
    role_id: userInfo.role_id,
  });

  if (!permissionRoleListRes.success || !roleInfoRes.success) {
    return {
      sucess: false,
      errorMsg,
    };
  }

  const roleInfo = roleInfoRes.data;
  const permissionRoleList = permissionRoleListRes.data;
  const permissionList = permissionRoleList
    .map((p) => p.permission)
    .map((p) => ({
      name: p.name,
      module_id: p.module_id,
      action: p.action,
    }));

  // Modulos disponibles al rol
  const availableModules: $Enums.nav_audience_module[] = ["ALL"];

  if (roleInfo?.its_administrative) {
    availableModules.push("ADMIN_ONLY");
  } else {
    availableModules.push("AUTH_ONLY");
  }

  // Modulos disponibles por su rol
  const allowedModulesRes = await listModulesForSessionDb({
    nav_audience: { in: availableModules },
  });

  if (!allowedModulesRes.success) {
    return {
      sucess: false,
      errorMsg,
    };
  }

  session.set("administrative", roleInfo?.its_administrative);
  session.set("dbUserId", userInfo.id);
  session.set("first_name", userInfo.first_name);
  session.set("last_name", userInfo.last_name);
  session.set("profile", userInfo.profile_public_id);
  session.set("profile_v", userInfo.profile_version);
  session.set("permissions", permissionList);
  session.set("modules", allowedModulesRes.data);

  return {
    sucess: true,
  };
}
