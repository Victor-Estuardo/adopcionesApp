import { MERAKI_EMAIL, MERAKI_PHONE_DISPLAY } from "~/utils/whatsapp";

export const meta = () => {
  return [{ title: "POLÍTICA DE PRIVACIDAD" }];
};

/*==============================| Component |==============================*/
export default function () {
  return (
    <div className="w-full h-full p-5 overflow-y-auto">
      <div className="max-w-3xl mx-auto flex flex-col gap-y-6 pb-10">
        <div>
          <h1 className="text-blue-meraki text-2xl md:text-3xl font-bold">
            Política de privacidad
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Última actualización: 24 de septiembre de 2026
          </p>
        </div>

        <Section title="1. Responsable del tratamiento">
          <p>
            Asociación Meraki es responsable de los datos personales que
            recolecta a través de esta plataforma. Puedes contactarnos en{" "}
            <a
              href={`mailto:${MERAKI_EMAIL}`}
              className="text-teal-600 font-medium hover:text-teal-700"
            >
              {MERAKI_EMAIL}
            </a>{" "}
            o al {MERAKI_PHONE_DISPLAY} para cualquier duda sobre tus datos.
          </p>
        </Section>

        <Section title="2. Qué datos recolectamos">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Cuenta:</strong> nombre, apellido, correo, teléfono
              (opcional) y contraseña (almacenada de forma cifrada).
            </li>
            <li>
              <strong>Solicitud de adopción:</strong> las respuestas que das
              al formulario de adopción de la mascota que elegiste.
            </li>
            <li>
              <strong>Carta de compromiso:</strong> al aceptarla digitalmente
              guardamos el texto aceptado, la fecha/hora y la dirección IP
              desde la que se firmó, como respaldo de que fue aceptada.
            </li>
            <li>
              <strong>Donaciones:</strong> nombre, correo y/o teléfono del
              donante, el monto declarado y, si lo adjuntas, el comprobante de
              depósito o transferencia.
            </li>
            <li>
              <strong>Sesión:</strong> una cookie técnica que identifica tu
              sesión iniciada; no se usa para publicidad ni rastreo.
            </li>
            <li>
              <strong>Datos técnicos:</strong> tu dirección IP se usa también
              para limitar intentos abusivos en formularios sensibles (inicio
              de sesión, creación de cuenta, recuperación de contraseña,
              solicitudes y notificaciones de donación).
            </li>
          </ul>
        </Section>

        <Section title="3. Para qué usamos tus datos">
          <ul className="list-disc pl-5 space-y-1">
            <li>Crear y proteger tu cuenta.</li>
            <li>Evaluar y dar seguimiento a solicitudes de adopción.</li>
            <li>
              Confirmar donaciones y, si lo autorizas, mostrarlas en el
              listado público de transparencia (con tu nombre o de forma
              anónima, según elijas).
            </li>
            <li>
              Enviarte correos operativos: verificación de cuenta,
              recuperación de contraseña, avisos sobre tu solicitud o
              donación.
            </li>
            <li>Prevenir abuso de la plataforma.</li>
          </ul>
        </Section>

        <Section title="4. Con quién compartimos tus datos">
          <p>
            No vendemos ni compartimos tus datos con terceros para fines
            publicitarios. Usamos los siguientes proveedores para operar la
            plataforma, quienes procesan datos únicamente en nuestro nombre:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Resend:</strong> envío de los correos operativos
              mencionados arriba.
            </li>
            <li>
              <strong>Cloudinary:</strong> almacenamiento de fotos de mascotas
              y de los comprobantes de donación que subes.
            </li>
            <li>Nuestro proveedor de base de datos y hosting.</li>
          </ul>
        </Section>

        <Section title="5. Cuánto tiempo conservamos tus datos">
          <p>
            Conservamos tus datos mientras tu cuenta esté activa o mientras
            sean necesarios para el propósito con el que se recolectaron (por
            ejemplo, el historial de solicitudes de adopción o donaciones).
            Puedes solicitar la eliminación de tu cuenta escribiéndonos a{" "}
            {MERAKI_EMAIL}.
          </p>
        </Section>

        <Section title="6. Tus derechos">
          <p>
            Puedes pedirnos acceder, corregir o eliminar tus datos personales
            escribiéndonos a{" "}
            <a
              href={`mailto:${MERAKI_EMAIL}`}
              className="text-teal-600 font-medium hover:text-teal-700"
            >
              {MERAKI_EMAIL}
            </a>
            . Ten en cuenta que algunos registros, como una carta de
            compromiso ya firmada o el historial de una donación confirmada,
            podemos conservarlos como respaldo aunque elimines tu cuenta.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            Usamos una sola cookie de sesión, necesaria para que puedas
            mantener la sesión iniciada. No usamos cookies de publicidad ni de
            rastreo de terceros.
          </p>
        </Section>

        <Section title="8. Menores de edad">
          <p>
            Esta plataforma está dirigida a personas mayores de edad. No
            recolectamos intencionalmente datos de menores de edad.
          </p>
        </Section>

        <Section title="9. Cambios a esta política">
          <p>
            Podemos actualizar esta política ocasionalmente. Publicaremos la
            fecha de la última actualización en esta misma página.
          </p>
        </Section>
      </div>
    </div>
  );
}

/*==============================| Subcomponentes |==============================*/
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 flex flex-col gap-y-2">
      <h2 className="font-bold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}
