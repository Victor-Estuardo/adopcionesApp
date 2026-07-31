import { status_pet } from "@prisma/client";

// Paleta de acentos por especie. Como `petSpecies` es dinámico (viene de BD),
// se asigna un color de forma determinística por nombre en lugar de un mapeo fijo.
// Así cualquier especie nueva ("Conejo", "Ave", etc.) recibe un color estable
// sin tocar código cada vez que el admin crea una especie.
const SPECIES_PALETTE = [
  { bg: "bg-[#F3E4D2]", text: "text-[#8A5A2B]", dot: "bg-[#D98A3D]" }, // ámbar
  { bg: "bg-[#E7E1F7]", text: "text-[#5B4499]", dot: "bg-[#8B6FD9]" }, // violeta
  { bg: "bg-[#DCEEF0]", text: "text-[#296B76]", dot: "bg-[#3D9DBF]" }, // teal
  { bg: "bg-[#FBE3E3]", text: "text-[#A13F3F]", dot: "bg-[#D96666]" }, // rosado
  { bg: "bg-[#E3EFDD]", text: "text-[#4C7A38]", dot: "bg-[#7CB35C]" }, // verde
] as const;

export function getSpeciesAccent(speciesName: string) {
  let hash = 0;
  for (let i = 0; i < speciesName.length; i++) {
    hash = speciesName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPECIES_PALETTE.length;
  return SPECIES_PALETTE[index];
}

// Estado de la mascota dentro del refugio. Solo "Disponible" puede recibir
// solicitudes de adopción por el momento; el resto son estados informativos
// que el administrativo puede asignar según el ciclo de vida de la mascota.
export const PET_STATUS_CONFIG: Record<
  status_pet,
  {
    label: string;
    color: string;
    bg: string;
    dot: string;
    /** Se muestra en el catálogo público (home / búsqueda). */
    visibleToPublic: boolean;
    /** Puede recibir solicitudes de adopción. */
    canRequestAdoption: boolean;
  }
> = {
  Disponible: {
    label: "Disponible",
    color: "text-[#1F7A4D]",
    bg: "bg-[#E4F5EC]",
    dot: "bg-[#2FA36B]",
    visibleToPublic: true,
    canRequestAdoption: true,
  },
  En_tratamiento: {
    label: "En tratamiento",
    color: "text-[#9A6A1F]",
    bg: "bg-[#FBEEDC]",
    dot: "bg-[#E0A63E]",
    visibleToPublic: true,
    canRequestAdoption: false,
  },
  Incapacitado: {
    label: "Necesidades especiales",
    color: "text-[#5B4499]",
    bg: "bg-[#EDE7F9]",
    dot: "bg-[#8B6FD9]",
    visibleToPublic: false,
    canRequestAdoption: false,
  },
  Fallecido: {
    label: "Fallecido",
    color: "text-[#57534E]",
    bg: "bg-[#EDEAE3]",
    dot: "bg-[#8C877A]",
    visibleToPublic: false,
    canRequestAdoption: false,
  },
  Retirado: {
    label: "Retirado",
    color: "text-[#6B665C]",
    bg: "bg-[#F0EDE5]",
    dot: "bg-[#A6A092]",
    visibleToPublic: false,
    canRequestAdoption: false,
  },
  Adoptado: {
    label: "Adoptado",
    color: "text-[#2F5AA8]",
    bg: "bg-[#E3EBFA]",
    dot: "bg-[#5C8AD9]",
    visibleToPublic: false,
    canRequestAdoption: false,
  },
};

export const PET_STATUS_OPTIONS: { value: status_pet; label: string }[] =
  Object.entries(PET_STATUS_CONFIG).map(([value, cfg]) => ({
    value: value as status_pet,
    label: cfg.label,
  }));

/** Estados visibles en el catálogo público de adopción. */
export const PUBLIC_PET_STATUSES = Object.entries(PET_STATUS_CONFIG)
  .filter(([, cfg]) => cfg.visibleToPublic)
  .map(([status]) => status as status_pet);

export function getPetStatusConfig(status: status_pet) {
  return PET_STATUS_CONFIG[status];
}

export const STATUS_CONFIG = {
  pendiente: {
    label: "Solicitud recibida",
    description_adopter: "Hemos recibido tu solicitud. La revisaremos pronto.",
    description: "Esta solicitud está pendiente de revisión.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    step: 1,
  },
  en_revision: {
    label: "En revisión",
    description_adopter: "Estamos revisando tu solicitud actualmente.",
    description: "Esta solicitud está siendo revisada.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-400",
    step: 2,
  },
  aprobada: {
    label: "¡Solicitud aprobada!",
    description_adopter:
      "Tu solicitud fue aprobada. Nos pondremos en contacto contigo.",
    description:
      "Solicitud aprobada. Coordina una reunión con el adoptante para confirmar la adopción.",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    dot: "bg-teal-400",
    step: 3,
  },
  rechazada: {
    label: "Solicitud no aprobada",
    description_adopter:
      "Lamentablemente tu solicitud no fue aprobada en esta ocasión.",
    description: "Esta solicitud fue rechazada.",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-400",
    step: 3,
  },
} as const;
