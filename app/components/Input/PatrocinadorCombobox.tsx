import { useFetcher } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";
import { FaChevronDown, FaPlus } from "react-icons/fa";
import { toast } from "sonner";

interface Option {
  id: number;
  name: string;
}

interface PatrocinadorComboboxProps {
  /** Patrocinadores activos (viene del loader; se refresca al crear uno). */
  patrocinadores: Option[];
  /** `name` del hidden que envía el id seleccionado en el submit principal. */
  name?: string;
  error?: string;
  /** Se llama cuando cambia el id seleccionado (o vuelve a `null`). */
  onValueChange?: (id: number | null) => void;
}

type CreateResponse = { newPatrocinador?: Option; errorMsg?: string };

/**
 * Combobox de patrocinadores: busca entre los existentes y, si el que
 * se escribe no aparece, ofrece "Crear «…»" inline sin salir del modal de
 * registro. El id seleccionado viaja en un `<input type="hidden">` para que el
 * envío de la donación no cambie.
 *
 * No hay librería de combobox en el proyecto; se implementa a mano siguiendo el
 * patrón WAI-ARIA (input `role="combobox"` + `role="listbox"`): ↑/↓ mueven el
 * `aria-activedescendant`, Enter selecciona, Escape cierra.
 */
export function PatrocinadorCombobox({
  patrocinadores,
  name = "md-patrocinador",
  error,
  onValueChange,
}: PatrocinadorComboboxProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();
  const wasCreating = useRef(false);

  const fetcher = useFetcher<CreateResponse>();
  const isCreating = fetcher.state !== "idle";

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();
  const matches = trimmed
    ? patrocinadores.filter((p) =>
        p.name.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : patrocinadores;
  const exactMatch = patrocinadores.some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = trimmed.length > 0 && !exactMatch;
  const createIndex = showCreate ? matches.length : -1;
  const optionCount = matches.length + (showCreate ? 1 : 0);

  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const select = (option: Option) => {
    setSelectedId(option.id);
    setQuery(option.name);
    setOpen(false);
    onValueChange?.(option.id);
  };

  const createNew = () => {
    if (!trimmed || isCreating) return;
    fetcher.submit(
      { intent: "create-patrocinador", name: trimmed },
      { method: "post" },
    );
  };

  const choose = (index: number) => {
    if (index === createIndex) createNew();
    else if (matches[index]) select(matches[index]);
  };

  // Resetea el resaltado al cambiar la búsqueda.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Al terminar de crear: si salió bien, el nuevo patrocinador queda
  // seleccionado (aunque el loader aún no haya revalidado la lista).
  useEffect(() => {
    if (fetcher.state === "submitting") wasCreating.current = true;
    if (fetcher.state === "idle" && wasCreating.current) {
      wasCreating.current = false;
      if (fetcher.data?.newPatrocinador) {
        select(fetcher.data.newPatrocinador);
      } else if (fetcher.data?.errorMsg) {
        toast.error(fetcher.data.errorMsg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state]);

  useEffect(() => () => clearTimeout(blurTimeout.current), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, Math.max(optionCount - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (open && optionCount > 0) {
        event.preventDefault();
        choose(activeIndex);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`${baseId}-input`}
        className="text-sm font-medium text-gray-700"
      >
        Patrocinador
      </label>

      <div className="relative">
        <input
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && optionCount > 0 ? optionId(activeIndex) : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          placeholder="Busca o escribe un patrocinador…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedId !== null) {
              setSelectedId(null);
              onValueChange?.(null);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm text-gray-800 focus:border-medium-turquoise-meraki focus:outline-none focus:ring-2 focus:ring-medium-turquoise-meraki/30"
        />
        <FaChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400"
          aria-hidden
        />

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
          >
            {matches.map((option, index) => (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(option)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? "bg-medium-turquoise-meraki/10 text-medium-turquoise-meraki"
                    : "text-gray-700"
                }`}
              >
                {option.name}
              </li>
            ))}

            {showCreate && (
              <li
                id={optionId(createIndex)}
                role="option"
                aria-selected={activeIndex === createIndex}
                onMouseEnter={() => setActiveIndex(createIndex)}
                onClick={createNew}
                className={`flex cursor-pointer items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm ${
                  activeIndex === createIndex
                    ? "bg-medium-turquoise-meraki/10 text-medium-turquoise-meraki"
                    : "text-gray-600"
                }`}
              >
                <FaPlus className="h-3 w-3 shrink-0" aria-hidden />
                {isCreating ? "Creando…" : `Crear “${trimmed}”`}
              </li>
            )}

            {matches.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-sm text-gray-400">
                Sin resultados
              </li>
            )}
          </ul>
        )}
      </div>

      <input type="hidden" name={name} value={selectedId ?? ""} />

      {error && (
        <p id={errorId} className="text-xs font-medium text-pink-meraki">
          {error}
        </p>
      )}
    </div>
  );
}
