import { FaPaw } from "react-icons/fa";
import { AdoptionAppAllInfo } from "~/services/db/adoptionApplication.service";
import { petImageUrl } from "~/utils/image";
import { STATUS_CONFIG } from "~/utils/pet-helpers";

interface ApplicationProps {
  application: AdoptionAppAllInfo | undefined;
  cloudName: string;
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApplicationDetailCard({
  application,
  cloudName,
}: ApplicationProps) {
  // Estado de solicitud
  const status =
    (application?.status as keyof typeof STATUS_CONFIG) ?? "pendiente";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 grid grid-cols-[min-content_1fr] md:flex items-center gap-5">
      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
        {application?.pet.pet_images?.[0]?.path ? (
          <img
            src={petImageUrl(
              cloudName,
              application.pet.pet_images[0].path,
              "thumb",
            )}
            className="w-full h-full object-cover"
          />
        ) : (
          <FaPaw className="w-7 h-7 text-gray-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-sm md:text-xl font-bold text-gray-800 truncate">
          Solicitud para adoptar a{" "}
          <span className="text-[#52C9BB]">{application?.pet.name}</span>
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Enviada el {formatDate(application?.submitted_at || "")}
        </p>
      </div>
      <div className="md:hidden"></div>
      <div
        className={`max-w-min text-nowrap justify-self-end flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold flex-shrink-0 ${config.bg} ${config.border} ${config.color}`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        {config.label}
      </div>
    </div>
  );
}
