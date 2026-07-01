//<reference> https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color

import { $Enums } from "@prisma/client";
import { Session } from "@remix-run/node";
import { PermissionSession } from "~/services/auth/login.service";

//Example: console.log('\x1b[33m%s\x1b[0m', stringToMakeYellow);  //yellow
export const LOG_COLORS = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",
  FgGray: "\x1b[90m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
  BgGray: "\x1b[100m",
};

/*------------------------------------------------------------------------*/
/**
 * Función que devuelve la edad según su fecha de nacimiento
 * @param birth Fecha de nacimiento
 * @returns {string} Edad en letras
 */
export function calculateAge(birth: Date | string): string {
  const now = new Date();
  const birthdate = new Date(birth);

  // Calcular meses totales entre ambas fechas
  const years = now.getFullYear() - birthdate.getFullYear();
  const months =
    now.getMonth() -
    birthdate.getMonth() +
    (now.getDate() < birthdate.getDate() ? -1 : 0);

  // Ajustar valores negativos
  const totalMonths = years * 12 + months;

  if (totalMonths < 12) {
    // Mostrar en meses
    const wholeMonths = Math.floor(totalMonths);
    const half = totalMonths - wholeMonths >= 0.5;
    if (wholeMonths === 0) return half ? "medio mes" : "menos de un mes";
    return `${wholeMonths} ${wholeMonths === 1 ? "mes" : "meses"}${
      half ? " y medio" : ""
    }`;
  } else {
    // Mostrar en años
    const wholeYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    const half = remainingMonths == 6; // si tiene exactamente medio año
    const monthsName = remainingMonths > 1 ? "meses" : "mes";
    return `${wholeYears} ${wholeYears === 1 ? "año" : "años"}${
      half
        ? " y medio"
        : remainingMonths > 0
        ? ` y ${remainingMonths} ${monthsName}`
        : ""
    }`;
  }
}

/*------------------------------------------------------------------------*/
/**
 * Función que maneja validación de correo
 * @param email Correo a validar
 * @returns {string} Error encontrado
 */
export function handleEmailValidation(email: string): string {
  // Para mensaje de error
  let error = "";

  if (!email) error = "Correo electrónico requerido";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error ||=
      "Este correo electrónico no es válido. Asegúrate de que este escrito correctamente, como ejemplo@email.com";
  }

  return error;
}

/*------------------------------------------------------------------------*/
/**
 * Función que maneja validación de contraseña
 * @param password Correo a validar
 * @returns {string} Error encontrado
 */
export function handlePasswordValidation(
  password: string,
  validateCreation?: boolean,
): string {
  // Para mensaje de error
  let error = "";

  if (!password) error = "Contraseña requerida";

  if (validateCreation) {
    if (password.length < 8) {
      error ||= "La contraseña debe tener al menos 8 caracteres";
    }

    if (!/[A-Z]/.test(password)) {
      error ||= "La contraseña debe contener al menos una letra mayúscula";
    }

    if (!/[a-z]/.test(password)) {
      error ||= "La contraseña debe contener al menos una letra minúscula";
    }

    if (!/[0-9]/.test(password)) {
      error ||= "La contraseña debe contener al menos un número";
    }

    if (!/[!@#$%^&*(),.?":{}|<>-_]/.test(password)) {
      error ||= "La contraseña debe contener al menos un carácter especial";
    }
  }

  return error;
}

/*------------------------------------------------------------------------*/
/**
 * Función que obtiene la fecha de Guatemala
 * @returns {Date} Fecha de Guatemala
 */
export function getDateGt(): Date {
  return new Date(new Date().getTime() - 6 * 60 * 60 * 1000);
}

/*------------------------------------------------------------------------*/
/**
 * Función que Verifica los permisos de navegación
 * @returns {Boolean} si tiene permiso o no
 */
export function validatePermission(
  session: Session,
  moduleId: number,
  action: $Enums.action_permission,
): Response | null {
  // Obtenemos los permisos
  const permissions: PermissionSession[] = session.get("permissions") || [];

  if (
    !permissions.find((p) => p.module_id === moduleId && p.action === action)
  ) {
    return new Response(
      "No cuenta con los permisos necesarios para ejecutar la acción",
      {
        status: 404,
      },
    );
  }

  return null;
}
