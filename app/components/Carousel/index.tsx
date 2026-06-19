import { useEffect, useState } from "react";
import { FaChevronLeft } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";

interface CarouselProps {
  displayImages: string[];
}

export default function ({ displayImages }: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const next = () => {
    setCurrent((prev) => (prev + 1) % displayImages.length);
  };

  const prev = () => {
    setCurrent(
      (prev) => (prev - 1 + displayImages.length) % displayImages.length,
    );
  };

  const goTo = (index: number) => {
    setCurrent(index);
  };

  return (
    <>
      <div className="relative bg-gray-200 rounded-lg overflow-hidden aspect-video group">
        {/* Imágenes */}
        <img
          src={displayImages[current]}
          alt={`Mascota ${current + 1}`}
          className="w-full h-full object-cover"
        />

        {/* Botones de navegación */}
        <button
          onClick={prev}
          className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full transition-all ${
            isMobile ? "" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Imagen anterior"
        >
          <FaChevronLeft size={24} className="text-gray-800" />
        </button>

        <button
          onClick={next}
          className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full transition-all ${
            isMobile ? "" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Imagen siguiente"
        >
          <FaChevronRight size={24} className="text-gray-800" />
        </button>

        {/* Indicador de posición */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {displayImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all ${
                index === current
                  ? "bg-white w-8"
                  : "bg-white/50 w-2 hover:bg-white/75"
              }`}
              aria-label={`Ir a imagen ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
