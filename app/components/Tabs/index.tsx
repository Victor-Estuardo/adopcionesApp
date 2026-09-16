import { IconType } from "react-icons";

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
 * Scroll horizontal con scrollbar oculta para no romper el layout en mobile.
 */
export default function Tabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  idPrefix,
}: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
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
    </div>
  );
}
