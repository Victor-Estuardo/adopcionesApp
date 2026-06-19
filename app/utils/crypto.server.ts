import bcrypt from "bcryptjs";
import crypto from "crypto";

/*------------------------------------------------------------------------*/
/**
 * Hashea un texto usando bcrypt
 * @param password - El texto plano
 * @returns Promise con el hash del texto
 */
export async function hashText(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(Number(process.env.SALT_BCRYPT));
  const hashedPassword = await bcrypt.hash(password, salt);

  return hashedPassword;
}

/*------------------------------------------------------------------------*/
/**
 * Verifica si una texto coincide con su hash
 * @param password - El texto plano
 * @param hashedPassword - El hash almacenado
 * @returns Promise<boolean> - true si el texto es válido
 */
export async function verifyText(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  const isValid = await bcrypt.compare(password, hashedPassword);
  return isValid;
}

/*------------------------------------------------------------------------*/
/**
 * Genera un token seguro para recuperación de contraseña
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
