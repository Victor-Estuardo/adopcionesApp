import { Link } from "@remix-run/react";
import React from "react";
import { IoFemaleOutline, IoMaleOutline } from "react-icons/io5";
import { PetWithImage } from "~/services/db/pet.service";
import { calculateAge } from "~/utils/common";
import { petImageUrl } from "~/utils/image";
import { getPetStatusConfig, getSpeciesAccent } from "~/utils/pet-helpers";

interface PetCardProps {
  pet: PetWithImage;
  petTagNub?: boolean;
  healthStatus?: boolean;
  children: React.ReactNode;
  onClickCard?: () => void;
  /** Si se pasa, el nombre es un enlace real que cubre toda la tarjeta. */
  href?: string;
  cloudName?: string;
}

export function PetCard({
  pet,
  petTagNub = false,
  healthStatus = false,
  children,
  onClickCard,
  href,
  cloudName = "",
}: PetCardProps) {
  const accent = getSpeciesAccent(pet.petSpecies?.name || "default");
  const statusConfig = getPetStatusConfig(pet.status);
  const cover = pet.pet_images?.[0]
    ? petImageUrl(cloudName, pet.pet_images[0].path, "card")
    : null;

  return (
    <article
      className={`max-h-max group relative overflow-hidden rounded-2xl border border-[#EAE6DC] bg-white shadow-sm transition-shadow hover:shadow-md ${
        onClickCard || href ? "cursor-pointer" : ""
      }`}
      onClick={onClickCard}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F4F2EC]">
        {cover ? (
          <img
            src={cover}
            alt={pet.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#B9B3A4]">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M12 4c-4 0-7 3.5-7 8 0 4 2.5 8 7 8s7-4 7-8c0-4.5-3-8-7-8Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        )}
        {petTagNub && (
          <div className="absolute right-3 top-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`}
                aria-hidden
              />
              {statusConfig.label}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[#1F1D1A]">
              {href ? (
                <Link
                  to={href}
                  className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-meraki focus-visible:after:rounded-2xl"
                >
                  {pet.name}
                </Link>
              ) : (
                pet.name
              )}
            </h3>
            <p className="text-sm text-[#8A8577]">
              {pet.race || pet.petSpecies?.name} · {calculateAge(pet.birthdate)}
            </p>
          </div>
          <span aria-label={pet.gender} className="mt-0.5 text-[#B9B3A4]">
            {pet.gender === "Hembra" ? <IoFemaleOutline /> : <IoMaleOutline />}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${accent.bg} ${accent.text}`}
          >
            {pet.petSpecies?.name}
          </span>
          <span className="rounded-full bg-[#F4F2EC] px-2 py-0.5 text-xs text-[#6B665C]">
            {pet.size}
          </span>
          <span className="rounded-full bg-[#F4F2EC] px-2 py-0.5 text-xs text-[#6B665C] truncate text-ellipsis">
            {pet.color}
          </span>
        </div>

        {healthStatus && (
          <div className="flex items-center gap-3 text-xs text-[#8A8577]">
            <span className="inline-flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  pet.vaccinated ? "bg-[#2FA36B]" : "bg-[#D8D3C6]"
                }`}
              />
              Vacunado
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  pet.sterilized ? "bg-[#2FA36B]" : "bg-[#D8D3C6]"
                }`}
              />
              Esterilizado
            </span>
          </div>
        )}

        {children}
      </div>
    </article>
  );
}