import { useId, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

export type StoryGalleryImage = {
  /** URL ya construida (p. ej. `storyImageUrl(..., "storyCover")`). */
  src: string;
  /** Texto alternativo real de la foto (o, por defecto, el título de la historia). */
  alt: string;
};

interface StoryGalleryProps {
  images: StoryGalleryImage[];
  /** Nombre accesible del carrusel, p. ej. "Fotos de la historia". */
  label?: string;
}

const SWIPE_THRESHOLD = 40;

/**
 * Galería accesible para el detalle de una historia. Componente propio (el
 * `Carousel` de la ficha de mascota no se modifica): flechas ←/→ del teclado
 * con el foco en la galería, deslizamiento táctil, `alt` real por foto,
 * `aria-roledescription="carousel"` e indicador "Foto X de N" en una región
 * `aria-live`. Con una sola foto no muestra controles; sin fotos no se pinta.
 */
export function StoryGallery({
  images,
  label = "Fotos de la historia",
}: StoryGalleryProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const statusId = useId();
  const total = images.length;

  if (total === 0) return null;

  const go = (index: number) => setCurrent((index + total) % total);
  const prev = () => go(current - 1);
  const next = () => go(current + 1);
  const image = images[Math.min(current, total - 1)];
  const hasControls = total > 1;

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!hasControls) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      go(total - 1);
    }
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || !hasControls) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) next();
    else prev();
  };

  const controlClass =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#1F1D1A] shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2 motion-reduce:transition-none";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      aria-describedby={hasControls ? statusId : undefined}
      tabIndex={hasControls ? 0 : undefined}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2"
    >
      <div
        className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-2xl border border-[#EAE6DC] bg-[#F4F2EC] sm:aspect-[16/10]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`Foto ${current + 1} de ${total}`}
          className="h-full w-full"
        >
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        </div>

        {hasControls && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className={`${controlClass} absolute left-3 top-1/2 -translate-y-1/2`}
            >
              <LuChevronLeft className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto siguiente"
              className={`${controlClass} absolute right-3 top-1/2 -translate-y-1/2`}
            >
              <LuChevronRight className="h-6 w-6" aria-hidden />
            </button>
          </>
        )}
      </div>

      {hasControls && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            id={statusId}
            aria-live="polite"
            aria-atomic="true"
            className="text-sm font-medium text-[#6B665C]"
          >
            Foto {current + 1} de {total}
          </p>
          <ul className="flex flex-wrap items-center gap-1" aria-label="Elegir foto">
            {images.map((img, index) => (
              <li key={img.src}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  aria-label={`Ver foto ${index + 1} de ${total}`}
                  aria-current={index === current ? "true" : undefined}
                  className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A]"
                >
                  <span
                    className={`block rounded-full transition-all motion-reduce:transition-none ${
                      index === current
                        ? "h-2.5 w-6 bg-[#1F1D1A]"
                        : "h-2.5 w-2.5 bg-[#8C877A] hover:bg-[#57534E]"
                    }`}
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
