import { AdoptionAppAllInfo } from "~/services/db/adoptionApplication.service";

interface ApplicationProps {
  application: AdoptionAppAllInfo | undefined;
}

export function ApplicationPanel({ application }: ApplicationProps) {
  // Agrupar respuestas por sección
  const answersBySection = application?.other_applicationAnswer.reduce<
    Record<string, typeof application.other_applicationAnswer>
  >((acc, a) => {
    const sec = a.formQuestion.section;
    acc[sec || "GENERAL"] = [...(acc[sec || "GENERAL"] ?? []), a];
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
        Tus respuestas
      </h2>

      <div className="flex flex-col gap-6">
        {Object.entries(answersBySection ?? {}).map(([section, answers]) => (
          <div key={section}>
            <h3 className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
              {section}
            </h3>
            <div className="flex flex-col gap-3">
              {answers.map((a) => (
                <div key={a.id} className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400">
                    {a.formQuestion.question_text}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    {a.answer_value || (
                      <span className="text-gray-300 italic">
                        Sin respuesta
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
