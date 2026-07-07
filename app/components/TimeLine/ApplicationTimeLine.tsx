import { FaCheck, FaClock } from "react-icons/fa";
import { AdoptionAppAllInfo } from "~/services/db/adoptionApplication.service";
import { STATUS_CONFIG } from "~/utils/pet-helpers";

interface ApplicationProps {
  application: AdoptionAppAllInfo | undefined;
  adopter?: boolean;
  children?: React.ReactNode;
}

export function ApplicationTimeLine({
  application,
  adopter,
  children,
}: ApplicationProps) {
  const STEPS = ["Enviada", "En revisión", "Decisión final"];
  const status =
    (application?.status as keyof typeof STATUS_CONFIG) ?? "pendiente";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
        Estado de tu solicitud
      </h2>

      <div className="flex items-center gap-0">
        {STEPS.map((stepLabel, i) => {
          const stepNum = i + 1;
          const isDone = config.step > stepNum;
          const isCurrent = config.step === stepNum;
          const isRejected = status === "rechazada" && stepNum === 3;

          return (
            <div
              key={stepLabel}
              className="flex items-center flex-1 last:flex-none"
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                  ${
                    isDone
                      ? "bg-teal-500 text-white"
                      : isCurrent && !isRejected
                      ? "bg-teal-100 text-teal-600 ring-2 ring-teal-400 ring-offset-2"
                      : isRejected
                      ? "bg-red-100 text-red-500 ring-2 ring-red-300 ring-offset-2"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? <FaCheck className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap
                  ${
                    isCurrent
                      ? config.color
                      : isDone
                      ? "text-teal-600"
                      : "text-gray-400"
                  }`}
                >
                  {stepLabel}
                </span>
              </div>

              {/* Línea conectora */}
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all
                  ${
                    config.step > stepNum + 1 || isDone
                      ? "bg-teal-400"
                      : "bg-gray-100"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p
        className={`mt-5 text-sm rounded-xl px-4 py-3 border ${config.bg} ${config.border} ${config.color}`}
      >
        <FaClock className="inline w-3.5 h-3.5 mr-1.5" />
        {adopter ? config.description_adopter : config.description}
      </p>
      {children}
    </div>
  );
}
