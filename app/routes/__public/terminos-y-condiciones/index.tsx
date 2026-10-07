import { MERAKI_EMAIL, MERAKI_PHONE_DISPLAY } from "~/utils/whatsapp";

export const meta = () => {
  return [{ title: "Términos y condiciones | Asociación Meraki" }];
};

/*==============================| Component |==============================*/
export default function () {
  return (
    <div className="w-full h-full p-5 overflow-y-auto">
      <div className="max-w-3xl mx-auto flex flex-col gap-y-6 pb-10">
        <div>
          <h1 className="text-blue-meraki text-2xl md:text-3xl font-bold">
            Términos y condiciones
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Última actualización: 24 de septiembre de 2026
          </p>
        </div>

        <Section title="1. Objeto">
          <p>
            Estos términos regulan el uso de la plataforma de Asociación
            Meraki para publicar mascotas en adopción, recibir solicitudes de
            adopción y gestionar donaciones. Al crear una cuenta o usar el
            sitio, aceptas estos términos.
          </p>
        </Section>

        <Section title="2. Cuenta de usuario">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Debes proporcionar información verdadera y mantenerla
              actualizada.
            </li>
            <li>
              Eres responsable de la confidencialidad de tu contraseña y de la
              actividad realizada desde tu cuenta.
            </li>
            <li>
              Nos reservamos el derecho de suspender cuentas que proporcionen
              información falsa o que hagan un uso indebido del formulario de
              solicitudes o donaciones.
            </li>
          </ul>
        </Section>

        <Section title="3. Proceso de adopción">
          <p>
            Enviar una solicitud de adopción no garantiza su aprobación.
            Asociación Meraki evalúa cada solicitud y puede rechazarla, pedir
            información adicional o coordinar una entrevista. Si tu solicitud
            es aprobada, deberás firmar digitalmente la carta de compromiso
            específica de esa adopción; ese documento —no estos términos— es
            el que establece las obligaciones legales del adoptante y de la
            asociación.
          </p>
        </Section>

        <Section title="4. Donaciones">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Las donaciones (monetarias o en especie) son voluntarias y no
              reembolsables.
            </li>
            <li>
              El monto que declaras al notificar una donación queda
              "pendiente" hasta que un voluntario lo confirme; la plataforma
              no procesa pagos ni cobra directamente tarjetas o cuentas.
            </li>
            <li>
              Puedes elegir que tu donación aparezca en el listado público con
              tu nombre, de forma anónima, o que no aparezca en absoluto.
            </li>
          </ul>
        </Section>

        <Section title="5. Contenido">
          <p>
            Las fotografías, descripciones y demás contenido publicado sobre
            las mascotas son propiedad de Asociación Meraki. La información
            que envías en formularios (respuestas de adopción, comentarios de
            donación) se usa únicamente para evaluar tu solicitud o gestionar
            tu donación.
          </p>
        </Section>

        <Section title="6. Uso indebido">
          <p>
            No está permitido enviar solicitudes o notificaciones de donación
            con datos falsos, automatizar envíos masivos, ni intentar acceder
            a información de otros usuarios. Para evitar abuso, algunas
            acciones (crear cuenta, iniciar sesión, enviar solicitudes,
            notificar donaciones) tienen límites de intentos por periodo de
            tiempo.
          </p>
        </Section>

        <Section title="7. Limitación de responsabilidad">
          <p>
            Asociación Meraki no garantiza que la plataforma esté disponible
            de forma ininterrumpida. Los compromisos posteriores a una
            adopción (cuidado del animal, devoluciones, visitas de
            seguimiento) se rigen por la carta de compromiso firmada en cada
            solicitud, no por este documento.
          </p>
        </Section>

        <Section title="8. Cambios a estos términos">
          <p>
            Podemos actualizar estos términos ocasionalmente. Publicaremos la
            fecha de la última actualización en esta misma página.
          </p>
        </Section>

        <Section title="9. Contacto">
          <p>
            Si tienes dudas sobre estos términos, escríbenos a{" "}
            <a
              href={`mailto:${MERAKI_EMAIL}`}
              className="text-teal-600 font-medium hover:text-teal-700"
            >
              {MERAKI_EMAIL}
            </a>{" "}
            o al {MERAKI_PHONE_DISPLAY}.
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
