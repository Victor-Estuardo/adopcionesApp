import jwt from "jsonwebtoken";

/*------------------------------------------------------------------------*/
/**
 * Crea un token de verificación de cuenta
 * @param userId Id del usuario a verificar
 * @returns {string} - token generado
 */
export function generateVerificationToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "8h" });
}

/**
 * Verifica un token JWT
 * @param token Token a verificar
 * @returns - Datos decodificados del token o null si es inválido
 */
export function verifyToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number;
      exp: number;
    };
  } catch (error) {
    return null;
  }
}
