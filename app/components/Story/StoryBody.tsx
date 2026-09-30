interface StoryBodyProps {
  /** Cuerpo en texto plano; los párrafos se separan por una línea en blanco (RN-07). */
  body: string;
  className?: string;
}

/**
 * Cuerpo de la historia como texto plano: cada bloque separado por una línea
 * en blanco es un `<p>`; los saltos simples se respetan con
 * `whitespace-pre-line`. React escapa el contenido: nunca se interpreta HTML
 * ni Markdown (SEG-05, sin `dangerouslySetInnerHTML`).
 */
export function StoryBody({ body, className = "" }: StoryBodyProps) {
  const paragraphs = body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      className={`mx-auto flex w-full max-w-[680px] flex-col gap-5 text-base leading-8 text-[#2F2C27] md:text-lg md:leading-9 ${className}`}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line break-words">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
