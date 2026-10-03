import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { LuArrowLeft } from "react-icons/lu";
import { storyImageUrl } from "~/utils/image";
import { formatStoryDate, STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";
import type { StoryDetailLoader } from "~/utils/story-routes.server";
import { ShareBar } from "./ShareBar";
import { StoryBody } from "./StoryBody";
import { StoryCard, StoryCategoryBadge } from "./StoryCard";
import { StoryCta } from "./StoryCta";
import { StoryGallery } from "./StoryGallery";

const PAGE_BG = {
  Finales_felices: "bg-white",
  Camino_arcoiris: "bg-[#F4F2EC]",
} as const;

/**
 * Detalle público de una historia (RF-D01…D06). Un solo `h1`; portada con
 * prioridad alta; galería solo con las fotos que no son portada; "Más
 * historias" se oculta si no hay. Contenedor con scroll propio (el `<main>`
 * del layout es `overflow-hidden`).
 */
export function StoryDetailPage({ data }: { data: SerializeFrom<StoryDetailLoader> }) {
  const { story, cover, gallery, related, cloudName, canonicalUrl } = data;
  const cfg = STORY_CATEGORY_CONFIG[story.category];
  const title = story.title;

  return (
    <div className={`h-full w-full overflow-y-auto ${PAGE_BG[story.category]}`}>
      <article className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
        <Link
          to={cfg.route}
          prefetch="intent"
          className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full px-1 text-sm font-semibold text-[#3A362E] hover:text-[#1F1D1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden />
          Volver a {cfg.label}
        </Link>

        <header className="flex flex-col gap-4">
          {cfg.classes.accentLine && (
            <div className={`${cfg.classes.accentLine} rounded-full`} aria-hidden />
          )}
          <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
            <StoryCategoryBadge category={story.category} />
            <h1 className="break-words text-3xl font-extrabold leading-tight text-[#1F1D1A] sm:text-4xl">
              {title}
            </h1>
            {story.published_at && (
              <p className="text-sm font-medium text-[#6B665C]">
                Publicada el{" "}
                <time dateTime={story.published_at}>
                  {formatStoryDate(story.published_at)}
                </time>
              </p>
            )}
          </div>
          {cover && (
            <img
              src={storyImageUrl(cloudName, cover.path, "storyCover")}
              alt={cover.alt_text || title}
              width={1600}
              height={900}
              decoding="async"
              {...({ fetchpriority: "high" } as object)}
              className="aspect-[4/3] w-full rounded-2xl border border-[#EAE6DC] bg-[#F4F2EC] object-cover md:aspect-[21/9]"
            />
          )}
        </header>

        <StoryBody body={story.body} />

        {gallery.length > 0 && (
          <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <h2 className="text-xl font-bold text-[#1F1D1A]">Más fotos</h2>
            <StoryGallery
              label={`Fotos de «${title}»`}
              images={gallery.map((img) => ({
                src: storyImageUrl(cloudName, img.path, "storyCover"),
                alt: img.alt_text || title,
              }))}
            />
          </section>
        )}

        <div className="mx-auto w-full max-w-[680px] border-t border-[#EAE6DC] pt-6">
          <ShareBar url={canonicalUrl} title={title} />
        </div>

        <StoryCta category={story.category} />

        {related.length > 0 && (
          <section aria-labelledby="mas-historias" className="flex flex-col gap-4">
            <h2 id="mas-historias" className="text-xl font-bold text-[#1F1D1A]">
              Más historias
            </h2>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.id}>
                  <StoryCard story={item} cloudName={cloudName} headingLevel={3} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
