import { useNavigate } from "@remix-run/react";
import { FaChevronRight, FaPaw } from "react-icons/fa";
import { ListApplicationWithPet } from "~/services/db/adoptionApplication.service";
import { calculateAge } from "~/utils/common";
import { petImageUrl } from "~/utils/image";

interface ApplicationCardProps {
  app: ListApplicationWithPet;
  cloudName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pendiente: {
    label: "Pendiente",
    dot: "bg-amber-400",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  en_revision: {
    label: "En revisión",
    dot: "bg-blue-400",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  aprobada: {
    label: "Aprobada",
    dot: "bg-teal-400",
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
  },
  rechazada: {
    label: "No aprobada",
    dot: "bg-red-400",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
} as const;

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ApplicationCard({ app, cloudName }: ApplicationCardProps) {
  // Hooks...
  const navigate = useNavigate();

  // Banderas
  const status = (app.status as keyof typeof STATUS_CONFIG) ?? "pendiente";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente;
  const pet = app.pet;

  return (
    <button
      onClick={() => navigate(`${app.id}?rc=applications`)}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-teal-200 hover:shadow-md transition-all text-left group"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {pet.pet_images?.[0].path ? (
            <img
              src={petImageUrl(cloudName, pet.pet_images[0].path, "thumb")}
              className="w-full h-full object-cover"
            />
          ) : (
            <FaPaw className="w-6 h-6 text-gray-300" />
          )}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate group-hover:text-teal-600 transition-colors">
                {pet.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pet.petSpecies.name} · {pet.race} ·{" "}
                {calculateAge(pet.birthdate)}
              </p>
            </div>

            {/* Badge de estado */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold flex-shrink-0 ${cfg.bg} ${cfg.border} ${cfg.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          </div>

          {/* Fecha + flecha */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              Enviada el {formatDate(app.submitted_at)}
            </span>
            <FaChevronRight className="w-3 h-3 text-gray-300 group-hover:text-teal-400 transition-colors" />
          </div>
        </div>
      </div>
    </button>
  );
}
