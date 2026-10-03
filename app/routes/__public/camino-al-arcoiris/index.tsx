import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { StoryListPage } from "~/components/Story/StoryListPage";
import { storyListMeta } from "~/utils/story-meta";
import { loadStoryList } from "~/utils/story-routes.server";

const CATEGORY = "Camino_arcoiris";

export const loader = ({ request }: LoaderArgs) =>
  loadStoryList(request, CATEGORY);

export const meta: V2_MetaFunction<typeof loader> = ({ data }) =>
  storyListMeta(CATEGORY, data);

export { StoryRouteError as ErrorBoundary } from "~/components/Story/StoryRouteError";

export default function StoryListRoute() {
  return <StoryListPage data={useLoaderData<typeof loader>()} />;
}
