// app/utils/email.server.ts
import { Resend } from "resend";
import { config } from "~/config";
import { generateVerificationToken } from "~/utils/jwt.server";

const resend = new Resend(config.resendApiKey);

// Email del remitente
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Asociación Meraki";

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  userName?: string,
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: "Recuperación de contraseña",
      html: getPasswordResetEmailHtml(resetUrl, userName),
      text: getPasswordResetEmailText(resetUrl, userName),
    });

    if (error) {
      console.error("Error al enviar correo de recuperación:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("No se pudo enviar el correo de recuperación:", error);
    return false;
  }
}

function getPasswordResetEmailHtml(
  resetUrl: string,
  userName?: string,
): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background-color: #f9f9f9;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #52C9BB;
          margin: 0;
        }
        .content {
          background-color: white;
          padding: 25px;
          border-radius: 8px;
        }
        .button {
          display: inline-block;
          padding: 15px 30px;
          background-color: #52C9BB;
          color: white !important;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #42B9AB;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 10px;
          margin: 20px 0;
        }
        .security-note {
          background-color: #e8f5f4;
          border-left: 4px solid #52C9BB;
          padding: 10px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Recuperación de contraseña</h1>
        </div>
        
        <div class="content">
          ${
            userName
              ? `<p>Hola <strong>${userName}</strong>,</p>`
              : "<p>Hola,</p>"
          }
          
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Para crear una nueva contraseña, haz clic en el botón de abajo:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Restablecer contraseña</a>
          </div>
          
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
          
          <div class="warning">
            <strong>⏱️ Importante:</strong> Este enlace expirará en 15 minutos por razones de seguridad.
          </div>
          
          <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu cuenta permanecerá protegida.</p>
          
          <div class="security-note">
            <strong>🔒 Seguridad:</strong> Por tu protección, nunca compartas este enlace con nadie.
          </div>
        </div>
        
        <div class="footer">
          <p>© 2025 MERAKI. Todos los derechos reservados.</p>
          <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPasswordResetEmailText(
  resetUrl: string,
  userName?: string,
): string {
  return `
    Recuperación de contraseña
    
    ${userName ? `Hola ${userName},` : "Hola,"}
    
    Recibimos una solicitud para restablecer la contraseña de tu cuenta.
    
    Haz clic en el siguiente enlace para crear una nueva contraseña:
    ${resetUrl}
    
    ⏱️ Este enlace expirará en 15 minutos.
    
    Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu cuenta permanecerá protegida.
    
    🔒 Por tu seguridad, nunca compartas este enlace con nadie.
    
    Saludos,
    El equipo de MERAKI
  `;
}

export async function sendVerificationEmail(
  user: { id: number; email: string; name: string },
  baseUrl: string,
) {
  try {
    // Generar el token
    const verificationToken = generateVerificationToken(user.id);

    // Crear el enlace de verificación
    const verificationLink = `${baseUrl}/verificar-cuenta?token=${verificationToken}`;

    // Crear el HTML del correo
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #52C9BB;
            margin: 0;
          }
          .content {
            background-color: white;
            padding: 25px;
            border-radius: 8px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background-color: #52C9BB;
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a MERAKI!</h1>
          </div>
          
          <div class="content">
            <p>Hola <strong>${user.name}</strong>,</p>
            
            <p>Gracias por registrarte. Para completar tu registro y activar tu cuenta, por favor verifica tu correo electrónico haciendo clic en el botón de abajo:</p>
            
            <div style="text-align: center;">
              <a href="${verificationLink}" class="button">Verificar mi cuenta</a>
            </div>
            
            <p>O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationLink}</p>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este enlace expirará en 8 horas por razones de seguridad.
            </div>
            
            <p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 MERAKI. Todos los derechos reservados.</p>
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Versión en texto plano (fallback)
    const textContent = `
      Hola ${user.name},
      
      Gracias por registrarte en MERAKI.
      
      Para activar tu cuenta, por favor visita el siguiente enlace:
      ${verificationLink}
      
      Este enlace expirará en 8 horas.
      
      Si no creaste esta cuenta, puedes ignorar este correo.
      
      Saludos,
      El equipo de MERAKI
    `;

    // Enviar el correo con Resend
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [user.email],
      subject: "Verifica tu cuenta - Meraki",
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error("Error al enviar correo de verificación:", error);
      return { success: false };
    }

    return { success: true, token: verificationToken };
  } catch (error) {
    console.error("No se pudo enviar el correo de verificación:", error);
    return { success: false };
  }
}

export async function sendSetPasswordEmail(
  email: string,
  setPasswordUrl: string,
  userName?: string,
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [email],
      subject: "Configura tu contraseña - Meraki",
      html: getSetPasswordEmailHtml(setPasswordUrl, userName),
      text: getSetPasswordEmailText(setPasswordUrl, userName),
    });

    if (error) {
      console.error(
        "Error al enviar correo de configuración de contraseña:",
        error,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "No se pudo enviar el correo de configuración de contraseña:",
      error,
    );
    return false;
  }
}

function getSetPasswordEmailHtml(
  setPasswordUrl: string,
  userName?: string,
): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #52C9BB; margin: 0; }
        .content { background-color: white; padding: 25px; border-radius: 8px; }
        .button { display: inline-block; padding: 15px 30px; background-color: #52C9BB; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Bienvenido al equipo Meraki!</h1>
        </div>
        <div class="content">
          ${
            userName
              ? `<p>Hola <strong>${userName}</strong>,</p>`
              : "<p>Hola,</p>"
          }
          <p>Se creó una cuenta administrativa para ti en el panel de Meraki. Para comenzar, define tu contraseña haciendo clic en el botón de abajo:</p>
          <div style="text-align: center;">
            <a href="${setPasswordUrl}" class="button">Configurar mi contraseña</a>
          </div>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${setPasswordUrl}</p>
          <div class="warning">
            <strong>⏱️ Importante:</strong> Este enlace expirará en 24 horas por razones de seguridad.
          </div>
          <p>Si no reconoces esta invitación, puedes ignorar este correo.</p>
        </div>
        <div class="footer">
          <p>© 2025 MERAKI. Todos los derechos reservados.</p>
          <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getSetPasswordEmailText(
  setPasswordUrl: string,
  userName?: string,
): string {
  return `
    ¡Bienvenido al equipo Meraki!

    ${userName ? `Hola ${userName},` : "Hola,"}

    Se creó una cuenta administrativa para ti en el panel de Meraki.

    Define tu contraseña visitando el siguiente enlace:
    ${setPasswordUrl}

    ⏱️ Este enlace expirará en 24 horas.

    Si no reconoces esta invitación, puedes ignorar este correo.

    Saludos,
    El equipo de MERAKI
  `;
}
