import { IconType } from "react-icons";
import { useEffect, useRef, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: IconType;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  idPrefix: string;
}

/**
 * Navegación por pestañas reutilizable (sin lógica de datos): controla solo
 * la pestaña activa vía `activeId`/`onChange`. El contenido de cada pestaña
 * lo renderiza la página que la usa, como `<div role="tabpanel" id={`${idPrefix}-panel-${id}`}>`.
 * Scroll horizontal con scrollbar oculta para no romper el layout en mobile;
 * se muestra un degradado en el borde cuando hay más pestañas fuera de vista,
 * para que no parezcan cortadas sin explicación.
 */
export default function Tabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  idPrefix,
}: TabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;

    const onResize = () => updateScrollState();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tabs]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="tablist"
        aria-label={ariaLabel}
        onScroll={updateScrollState}
        className="flex gap-x-4 overflow-x-auto border-b border-gray-200 sm:gap-x-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={`-mb-px flex shrink-0 items-center gap-x-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-semibold transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-meraki/40 ${
                selected
                  ? "border-blue-meraki text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
        {/* Espaciador para que la última pestaña no quede pegada al borde */}
        <div className="shrink-0 w-1" aria-hidden />
      </div>

      {/* Degradados que indican que hay más pestañas fuera de vista (solo mientras aplique) */}
      {canScrollLeft && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-white to-transparent"
        />
      )}
      {canScrollRight && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent"
        />
      )}
    </div>
  );
}
