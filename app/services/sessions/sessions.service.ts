import { createCookieSessionStorage } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    secure: process.env.NODE_ENV === "production", // solo HTTPS en producción
    secrets: [process.env.SESSION_SECRET!],
    sameSite: "lax", // evita CSRF
    path: "/",
    httpOnly: true, // protege de ataques XSS
    maxAge: 60 * 60 * 24, // 1 Día
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
