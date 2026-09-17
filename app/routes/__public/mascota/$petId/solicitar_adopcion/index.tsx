import {
  ActionFunction,
  LoaderFunction,
  json,
  redirect,
} from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { getSession } from "~/services/sessions/sessions.service";
import AdoptionForm, { FormQuestion } from "~/components/Form/adoption";
import { getPetDb, Pet } from "~/services/db/pet.service";
import { listFormQuestionDb } from "~/services/db/formQuestion.service";
import {
  createAdoptionApplicationDb,
  getAdoptionApplicationDb,
} from "~/services/db/adoptionApplication.service";
import { createApplicationAnswersDb } from "~/services/db/applicationAnswer.service";
import { toast } from "sonner";
import { createcommitmentAgreementDb } from "~/services/db/commitmentAgreement.service";
import { validatePermission } from "~/utils/common";
import { getPetStatusConfig } from "~/utils/pet-helpers";
import { enforceRateLimits, getClientIp } from "~/utils/rateLimit.server";

export const meta = () => {
  return [{ title: "SOLICITUD DE ADOPCIÓN" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request, params }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  // verificamos que tenga permiso de solicitar adopción
  const validateRequest = validatePermission(session, 1, "Crear");
  if (validateRequest) throw validateRequest;

  // Obtenemos el id de la mascota
  const { petId } = params;

  if (!petId) {
    return json({
      errorMsg: "Ocurrió un error al obtener la información de la mascota",
    });
  }

  // Verificar si el usuario ya tiene una solicitud para la mascota
  const existing = await getAdoptionApplicationDb({
    pet_id: Number(petId),
    user_id: dbUserId,
  });

  if (!existing.success) {
    return json({
      errorMsg: "Ocurrió un error al obtener la información",
    });
  }

  if (existing.data) {
    return redirect(`/mi-cuenta/solicitudes/${existing.data.id}`);
  }

  // Obtenemos información de la mascota y de las preguntas del formulario
  const [getPetResponse, getQuestionsResponse] = await Promise.all([
    getPetDb({ id: Number(petId) }),
    listFormQuestionDb({ active: true }),
  ]);

  if (!getPetResponse.success || !getQuestionsResponse.success) {
    return json({
      errorMsg: "Ocurrió un error al obtener la información",
    });
  }

  const pet = getPetResponse.data;
  const questions = getQuestionsResponse.data;

  // Verificar que la mascota siga disponible para adopción
  if (pet && !getPetStatusConfig(pet.status).canRequestAdoption) {
    throw new Response("La mascota no está disponible para adopción", {
      status: 404,
    });
  }

  const agreementText = `
    Yo, como solicitante de adopción, me comprometo a:
    1. Continuar con los cuidados médicos y tratamientos que esten en proceso (Si fuera el caso).
    2. Proveerle cada día de agua limpia.
    3. Proveerle concentrado de calidad y darle de acuerdo al peso, en raciones distribuidas en 3 tiempos si fueran cachorros y en 2 si fuesen adultos.
    4. La mascota no será en ningún caso golpeado, maltratado, amarrado por periodos largos (24 horas), abandonado o regalado a nadie mas.
    5. El maltrato es un delito tipificado en el codigo civil art. 480 y en la ley de bienestar animal considerados como faltas graves y con cauciones económicas de hasta 12 salarios mínimos.
    6. si por alguna razón la mascota no se adaptara, después de algún tiempo, se devolverá a la asociación, previo aviso mínimo de una semana.
    Esta carta de compromiso tiene carácter legal y cualquier incumplimiento puede
    derivar en la recuperación del animal por parte de la asociación.
  `.trim();

  return json({
    pet,
    questions: questions,
    agreementText,
  });
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request, params }) => {
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);
  const dbUserId = session.get("dbUserId");

  //=============| Datos del POST |==============================//
  const formData = await request.formData();

  // Límite por IP y por usuario para frenar el spam de solicitudes falsas
  const rateLimitMsg = await enforceRateLimits([
    {
      action: "solicitud-adopcion",
      identifier: getClientIp(request),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    },
    {
      action: "solicitud-adopcion",
      identifier: String(dbUserId),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    },
  ]);
  if (rateLimitMsg) {
    return json({ errorMsg: rateLimitMsg }, { status: 429 });
  }

  // Obtenemos el id de la mascota
  const { petId } = params;

  // Obtenemos información de la mascota y de las preguntas del formulario
  const getQuestionsResponse = await listFormQuestionDb({ active: true });

  if (!getQuestionsResponse.success) {
    return json({
      errorMsg:
        "Ocurrió un error al crear la solicitud, por favor intente nuevamente",
    });
  }

  const questions = getQuestionsResponse.data;

  // Crear la solicitud de adopción
  const createApplicationRes = await createAdoptionApplicationDb({
    pet_id: Number(petId),
    user_id: dbUserId,
    status: "pendiente",
    submitted_at: new Date(),
    updated_at: new Date(),
  });

  if (!createApplicationRes.success) {
    return json({
      errorMsg:
        "Ocurrió un error al crear la solicitud, por favor intente nuevamente",
    });
  }

  const application = createApplicationRes.data;

  // Guardar respuestas
  const answersData = questions
    .map((q) => {
      const raw = formData.getAll(`answer_${q.id}`);
      const value = raw.length > 1 ? raw.join(", ") : raw[0] ?? "";
      return {
        application_id: application.id,
        question_id: q.id,
        answer_value: value.toString(),
      };
    })
    .filter((a) => a.answer_value !== "");

  const createAnswersRes = await createApplicationAnswersDb(answersData);

  if (!createAnswersRes.success) {
    return json({
      errorMsg:
        "Ocurrió un error al crear la solicitud, por favor intente nuevamente",
    });
  }

  // Guardar carta de compromiso
  const agreed = formData.get("agreed") === "true";
  if (agreed) {
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await createcommitmentAgreementDb({
      application_id: application.id,
      agreement_text: formData.get("agreementText")?.toString() ?? "",
      accepted: true,
      ip_address: ip,
      signed_at: new Date(),
    });
  }

  return json({
    answers_success: application.id,
  });
};

/*==============================| Component |==============================*/
export default function () {
  // Hooks...
  const { pet, questions, agreementText } = useLoaderData<{
    pet: Pet;
    questions: FormQuestion[];
    agreementText: string;
  }>();
  const actionData = useActionData();
  const navigate = useNavigate();

  // Para aceptación de compromisos
  const [agreed, setAgreed] = useState(false);
  const [acceptAgreement, setAcceptAgreement] = useState("No");

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    if (actionData?.answers_success) {
      toast.success("Solicitud enviada exitosamente,", { duration: 4000 });

      navigate(
        `/mi-cuenta/solicitudes/${actionData.answers_success}?rc=pet&enviada=true`,
      );
    }
  }, [actionData]);

  return (
    <div className="w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
      <button
        className="hidden md:flex max-w-max items-center gap-x-3 text-blue-meraki"
        onClick={() => navigate(pet?.id ? `/mascota/${pet.id}` : "/")}
      >
        <FaChevronLeft className="w-6 h-6" />
        <span className="text-xl font-semibold">Información de mascota</span>
      </button>
      {agreed ? (
        <AdoptionForm
          questions={questions}
          petId={pet.id}
          petName={pet.name}
          agreementText={agreementText}
        />
      ) : (
        <div className="w-full md:w-[80%] mx-auto flex flex-col gap-y-6">
          <div className="rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <h2 className="font-bold">COMPROMISOS POR PARTE DEL ADOPTANTE</h2>
            <ol className="list-disc">
              <li>
                Proveer al animal un lugar apropiado donde esté protegido de las
                variaciones del clima.
              </li>
              <li>Proveer alimento y agua fresca todos los días.</li>
              <li>
                Mantener sus vacunas al día y desparasitarlo cuando se requiera.
              </li>
              <li>
                Mantener a la mascota en un lugar seguro, cercado, no permitir
                que ande en las calles sin correa.
              </li>
              <li>
                Colocar una identificación en su collar, con el nombre de la
                mascota y el número del dueño.
              </li>
              <li>
                En tal caso se llegara a salir, notificar a la asociación de
                inmediato para que se sume a la búsqueda de la mascota.
              </li>
              <li>
                Llevarle a sus chequeos veterinarios para que su salud no se vea
                comprometida en un futuro.
              </li>
              <li>Notificar cualquier cambio de teléfono o dirección.</li>
              <li>
                Adjuntar fotocopia de DPI, recibo de agua, luz o teléfono del
                domicilio realizar la cancelación de las vacunas y la
                castracion, siendo para perro Q 350. y para gatito Q 300.
              </li>
              <li>
                Estar de acuerdo con el monitoreo de parte de la asociación, es
                decir fotos, llamadas y visitas de rutina sin previo aviso.
              </li>
              <li>
                Reconocer el derecho de la asociación de recuperar a la mascota
                en tal caso no haya satisfacción en su cuidado, y trato sin
                devolución de la donación.
              </li>
              <li>
                Si por alguna razón no puede mantener al adoptado lo regresará a
                la asociación, no lo venderá, abandonará o entregará a terceros.
              </li>
            </ol>
          </div>
          <div className="rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <h2 className="font-bold">
              COMPROMISOS POR PARTE DE LA ASOCIACIÓN
            </h2>
            <ol className="list-disc">
              <li>
                Entregar al perro castrado si es mayor de los 4 meses: de ser
                más pequeño estableceríamos fecha para su castración al cumplir
                4 meses.
              </li>
              <li>
                Entregar al perro vacunado y desparasitado, libre de cualquier
                parásito y enfermedad.
              </li>
              <li>
                Entrega de carnet de vacunas al día y certificado de adopción.
              </li>
              <li>
                Entrega del adoptado en su domicilio en el transcurso de la
                semana.
              </li>
              <li>
                Realizar monitoreo para evaluar su estadía y ayudarles en el
                proceso de adaptación en su nuevo hogar, como de monitorear su
                refuerzo de vacunas.
              </li>
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-pre-line">
              ¿Estás de acuerdo con TODO?
              <span className="text-teal-500 ml-1">*</span>
            </label>
            <div className="flex gap-2">
              {["Sí", "No"].map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all text-sm
                        ${
                          acceptAgreement === opt
                            ? "border-teal-400 bg-teal-50 text-teal-700 font-medium"
                            : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
                        }`}
                >
                  <input
                    type="radio"
                    value={opt}
                    required
                    checked={acceptAgreement === opt}
                    onChange={() => setAcceptAgreement(opt)}
                    className="accent-teal-500"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAgreed(true)}
            disabled={acceptAgreement === "No"}
            className="max-w-min flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Siguiente
            <FaChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
