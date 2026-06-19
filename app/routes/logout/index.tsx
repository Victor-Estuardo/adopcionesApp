import { LoaderFunction, redirect } from "@remix-run/node";
import {
  destroySession,
  getSession,
} from "~/services/sessions/sessions.service";

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);

  return redirect(`/`, {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};
