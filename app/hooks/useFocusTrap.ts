import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Accesibilidad para modales/drawers. Mientras `active` es true:
 * - Escape llama a `onClose`.
 * - El foco queda atrapado dentro del contenedor (Tab/Shift+Tab hacen ciclo).
 * - Al desactivarse, el foco vuelve al elemento que estaba enfocado antes de abrir.
 *
 * Devuelve un ref para colocar en el contenedor del diálogo (que debe tener
 * `tabIndex={-1}` para poder recibir el foco inicial).
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = containerRef.current;

    const getFocusable = () =>
      container
        ? Array.from(
            container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
          ).filter((el) => el.offsetParent !== null)
        : [];

    // Foco inicial: el contenedor, para que el lector anuncie el diálogo.
    container?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !container) return;

      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
