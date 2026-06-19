import { formQuestion } from "@prisma/client";
import { Form, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaCheck, FaChevronLeft, FaChevronRight, FaPaw } from "react-icons/fa";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldType =
  | "yes_no"
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "number"
  | "section";

export type FormQuestion = Omit<formQuestion, "options"> & {
  options: string[] | null; // JSON array guardado en la DB
};

interface AdoptionFormProps {
  questions: FormQuestion[];
  petId: string | number;
  petName: string;
  agreementText: string; // texto del commitment_agreement
}

export default function AdoptionForm({
  questions,
  agreementText,
  petId,
  petName,
}: AdoptionFormProps) {
  // Hooks..
  const navigation = useNavigation();
  const sectionRef = useRef<HTMLDivElement>(null);

  // Estado de envio
  const isSubmitting = useMemo(() => {
    return navigation.state === "submitting";
  }, [navigation.state]);

  // Sección
  const grouped = groupBySection(questions);
  const sections = Object.keys(grouped);

  // Pasos
  const [step, setStep] = useState(0);
  const totalSteps = sections.length + 1;
  const isLastStep = step === totalSteps - 1;
  const currentSection = sections[step];

  // Respuestas
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    () =>
      questions.reduce<Record<string, string | string[]>>((acc, q) => {
        acc[q.id] = q.field_type === "checkbox" ? [] : "";
        return acc;
      }, {}),
  );

  // Progreso
  const progress = useMemo(() => {
    return Math.round(((step + 1) / totalSteps) * 100);
  }, [step]);

  // Pasos
  const isCommitmentStep = step === sections.length;

  // Conforme
  const [agreed, setAgreed] = useState(false);

  /*------------------------------FUNCIONES------------------------------*/
  // Validar que los campos requeridos del paso actual estén llenos
  const canAdvance = () => {
    if (isCommitmentStep) return agreed;
    const qs = grouped[currentSection] ?? [];
    return qs
      .filter((q) => q.required)
      .every((q) => {
        const v = answers[q.id];
        return Array.isArray(v) ? v.length > 0 : v.trim() !== "";
      });
  };

  // Función que cambia las respuestas
  const handleChange = (id: string, val: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  };

  /*------------------------------EFECTOS------------------------------*/
  useEffect(() => {
    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [step]);

  return (
    <div className="w-full md:w-[80%] mx-auto flex flex-col gap-y-6">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Solicitud de adopción
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Adoptando a{" "}
            <span className="text-teal-600 font-semibold">{petName}</span>
          </p>
        </div>
        <span className="text-xs text-gray-400 font-medium">
          Paso {step + 1} de {totalSteps}
        </span>
      </div>

      {/* ── Barra de progreso ── */}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-teal-400 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Tabs de secciones ── */}
      <div className="flex gap-2 flex-wrap">
        {sections.map((sec, i) => (
          <button
            key={sec}
            type="button"
            onClick={() => i <= step && setStep(i)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all
              ${
                i === step
                  ? "bg-teal-500 text-white"
                  : i < step
                  ? "bg-teal-100 text-teal-600 cursor-pointer"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
          >
            {i < step && <FaCheck className="inline mr-1 w-2.5 h-2.5" />}
            {sec}
          </button>
        ))}
        <button
          type="button"
          onClick={() => step >= sections.length && setStep(sections.length)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all
            ${
              isCommitmentStep
                ? "bg-teal-500 text-white"
                : step > sections.length - 1
                ? "bg-teal-100 text-teal-600 cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
        >
          COMPROMISO
        </button>
      </div>

      {/* ── Tarjeta de preguntas ── */}
      <Form method="post" action={`/mascota/${petId}/solicitar_adopcion`}>
        {/* Hidden inputs con todas las respuestas para el submit final */}
        {Object.entries(answers).map(([qId, val]) =>
          Array.isArray(val) ? (
            val.map((v, i) => (
              <input
                key={`${qId}-${i}`}
                type="hidden"
                name={`answer_${qId}`}
                value={v}
              />
            ))
          ) : (
            <input key={qId} type="hidden" name={`answer_${qId}`} value={val} />
          ),
        )}
        <input type="hidden" name="petId" value={petId} />
        <input type="hidden" name="agreementText" value={agreementText} />
        <input type="hidden" name="agreed" value={agreed ? "true" : "false"} />

        <div
          ref={sectionRef}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8"
        >
          {!isCommitmentStep ? (
            <>
              <h2 className="text-lg font-semibold text-gray-700 mb-6 pb-4 border-b border-gray-100">
                <FaPaw className="inline mr-2 text-teal-400 w-4 h-4" />
                {currentSection}
              </h2>

              <div className="flex flex-col gap-6">
                {(grouped[currentSection] ?? []).map((q) => (
                  <div key={q.id} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-pre-line">
                      {q.question_text}
                      {q.required && (
                        <span className="text-teal-500 ml-1">*</span>
                      )}
                    </label>
                    <QuestionField
                      q={q}
                      value={answers[q.id]}
                      onChange={handleChange}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── Paso de compromiso ── */
            <div className="flex flex-col gap-6">
              <h2 className="text-lg font-semibold text-gray-700 pb-4 border-b border-gray-100">
                Carta de compromiso
              </h2>

              <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-600 leading-relaxed border border-gray-100 max-h-64 overflow-y-auto">
                {agreementText}
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all
                    ${
                      agreed
                        ? "bg-teal-500 border-teal-500"
                        : "border-gray-300 group-hover:border-teal-300"
                    }`}
                >
                  {agreed && <FaCheck className="text-white w-2.5 h-2.5" />}
                </div>
                <span className="text-sm text-gray-600">
                  He leído y acepto los términos del compromiso de adopción, y
                  me comprometo a cumplir con todas las responsabilidades
                  indicadas.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* ── Navegación ── */}
        <div className="flex justify-between items-center mt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium
              text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <FaChevronLeft className="w-3 h-3" />
            Anterior
          </button>

          {isLastStep ? (
            <button
              type="submit"
              disabled={!canAdvance() || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600
                text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isSubmitting ? "Enviando..." : "Enviar solicitud"}
              {!isSubmitting && <FaCheck className="w-3 h-3" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => canAdvance() && setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600
                text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Siguiente
              <FaChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </Form>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBySection(questions: FormQuestion[]) {
  return questions
    .filter((q) => q.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .reduce<Record<string, FormQuestion[]>>((acc, q) => {
      acc[q.section || "GENERAL"] = [...(acc[q.section || "GENERAL"] ?? []), q];
      return acc;
    }, {});
}

// ─── Sub-componentes de campo ─────────────────────────────────────────────────

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: FormQuestion;
  value: string | string[];
  onChange: (id: string, val: string | string[]) => void;
}) {
  const baseInput =
    "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 " +
    "focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent " +
    "transition-all placeholder:text-gray-400 bg-white";

  switch (q.field_type) {
    case "section":
      return <div className="flex w-full h-0.5 bg-gray-500"></div>;
    case "yes_no":
      return (
        <div className="flex flex-col gap-2">
          {["Sí", "No"].map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all text-sm
                ${
                  value === opt
                    ? "border-teal-400 bg-teal-50 text-teal-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
                }`}
            >
              <input
                type="radio"
                name={q.id}
                value={opt}
                required={q.required}
                checked={value === opt}
                onChange={() => onChange(q.id, opt)}
                className="accent-teal-500"
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case "textarea":
      return (
        <textarea
          name={q.id}
          required={q.required}
          rows={4}
          value={value as string}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder="Escribe tu respuesta aquí..."
          className={`${baseInput} resize-none`}
        />
      );

    case "select":
      return (
        <select
          name={q.id}
          required={q.required}
          value={value as string}
          onChange={(e) => onChange(q.id, e.target.value)}
          className={`${baseInput} cursor-pointer`}
        >
          <option value="">Selecciona una opción</option>
          {(q.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "radio":
      return (
        <div className="flex flex-col gap-2">
          {(q.options ?? []).map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all text-sm
                ${
                  value === opt
                    ? "border-teal-400 bg-teal-50 text-teal-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
                }`}
            >
              <input
                type="radio"
                name={q.id}
                value={opt}
                required={q.required}
                checked={value === opt}
                onChange={() => onChange(q.id, opt)}
                className="accent-teal-500"
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case "checkbox":
      return (
        <div className="flex flex-col gap-2">
          {(q.options ?? []).map((opt) => {
            const arr = value as string[];
            const checked = arr.includes(opt);
            return (
              <label
                key={opt}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all text-sm
                  ${
                    checked
                      ? "border-teal-400 bg-teal-50 text-teal-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
                  }`}
              >
                <input
                  type="checkbox"
                  name={q.id}
                  value={opt}
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? arr.filter((v) => v !== opt)
                      : [...arr, opt];
                    onChange(q.id, next);
                  }}
                  className="accent-teal-500"
                />
                {opt}
              </label>
            );
          })}
        </div>
      );

    case "number":
      return (
        <input
          type="number"
          name={q.id}
          required={q.required}
          value={value as string}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder="0"
          className={baseInput}
        />
      );

    default: // "text"
      return (
        <input
          type="text"
          name={q.id}
          required={q.required}
          value={value as string}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder="Escribe tu respuesta..."
          className={baseInput}
        />
      );
  }
}
