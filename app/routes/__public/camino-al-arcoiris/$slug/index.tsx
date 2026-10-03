import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { StoryDetailPage } from "~/components/Story/StoryDetailPage";
import { storyDetailMeta } from "~/utils/story-meta";
import { loadStoryDetail } from "~/utils/story-routes.server";

const CATEGORY = "Camino_arcoiris";

export const loader = ({ params }: LoaderArgs) =>
  loadStoryDetail(params.slug, CATEGORY);

export const meta: V2_MetaFunction<typeof loader> = ({ data }) =>
  storyDetailMeta(data);

export { StoryRouteError as ErrorBoundary } from "~/components/Story/StoryRouteError";

export default function StoryDetailRoute() {
  return <StoryDetailPage data={useLoaderData<typeof loader>()} />;
}
