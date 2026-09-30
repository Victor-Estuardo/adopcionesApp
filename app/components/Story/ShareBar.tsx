import { useEffect, useId, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { FaFacebookF, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { LuLink, LuShare2 } from "react-icons/lu";
import { toast } from "sonner";

interface ShareBarProps {
  /** URL canónica ABSOLUTA, construida en el servidor con SITE_URL. */
  url: string;
  /** Título de la historia (texto que acompaña el enlace). */
  title: string;
}

const BUTTON =
  "flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-[#E4E0D6] bg-white px-3 text-sm font-medium text-[#1F1D1A] transition-colors hover:bg-[#F4F2EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2 motion-reduce:transition-none sm:px-4";

/**
 * Barra para compartir una historia: WhatsApp, Facebook, X, copiar enlace y
 * "Compartir" nativo (solo si el navegador tiene `navigator.share`, detectado
 * en el cliente). Los parámetros van con `encodeURIComponent` y los enlaces
 * externos abren en pestaña nueva con `rel="noopener noreferrer"`.
 */
export function ShareBar({ url, title }: ShareBarProps) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const fallbackId = useId();

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    if (showFallback) fallbackRef.current?.select();
  }, [showFallback]);

  const encodedUrl = encodeURIComponent(url);
  const links: { label: string; name: string; href: string; Icon: IconType }[] = [
    {
      label: "Compartir en WhatsApp",
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      Icon: FaWhatsapp,
    },
    {
      label: "Compartir en Facebook",
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      Icon: FaFacebookF,
    },
    {
      label: "Compartir en X",
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(title)}`,
      Icon: FaXTwitter,
    },
  ];

  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Portapapeles no disponible");
      await navigator.clipboard.writeText(url);
      setShowFallback(false);
      toast.success("Enlace copiado.");
    } catch {
      setShowFallback(true);
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo.");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      // Cancelar la hoja de compartir no es un error para el usuario.
      if ((error as DOMException)?.name !== "AbortError") {
        toast.error("No se pudo abrir el menú para compartir.");
      }
    }
  };

  return (
    <nav aria-label="Compartir" className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-[#1F1D1A]">Comparte esta historia</p>
      <ul className="flex flex-wrap gap-2">
        {canNativeShare && (
          <li>
            <button
              type="button"
              onClick={nativeShare}
              aria-label="Compartir con otras aplicaciones"
              className={BUTTON}
            >
              <LuShare2 className="h-5 w-5" aria-hidden />
              <span>Compartir</span>
            </button>
          </li>
        )}
        {links.map(({ label, name, href, Icon }) => (
          <li key={name}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className={BUTTON}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="hidden sm:inline">{name}</span>
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copiar enlace de la historia"
            className={BUTTON}
          >
            <LuLink className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Copiar enlace</span>
          </button>
        </li>
      </ul>

      {showFallback && (
        <div className="flex flex-col gap-1">
          <label htmlFor={fallbackId} className="text-xs font-medium text-[#3A362E]">
            Enlace de la historia
          </label>
          <input
            ref={fallbackRef}
            id={fallbackId}
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-[#E4E0D6] bg-white px-3 py-2 text-sm text-[#1F1D1A] focus:outline-none focus:ring-2 focus:ring-[#1F1D1A]"
          />
        </div>
      )}
    </nav>
  );
}
