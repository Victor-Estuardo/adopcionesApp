import { createSessionStorage } from "@remix-run/node";
import {
  createSessionDataDb,
  deleteSessionDataDb,
  readSessionDataDb,
  updateSessionDataDb,
} from "~/services/db/session.service";

// Respaldada en Postgres (tabla `session`, vía Prisma): la cookie del
// cliente solo lleva el id de sesión firmado, no los datos. Antes era
// createCookieSessionStorage, que guardaba módulos+permisos completos en la
// cookie y superó el límite de ~4096 bytes de los navegadores.
export const sessionStorage = createSessionStorage({
  cookie: {
    name: "__session",
    secure: process.env.NODE_ENV === "production", // solo HTTPS en producción
    secrets: [process.env.SESSION_SECRET!],
    sameSite: "lax", // evita CSRF
    path: "/",
    httpOnly: true, // protege de ataques XSS
    maxAge: 60 * 60 * 24, // 1 Día
  },
  createData: (data, expires) => createSessionDataDb(data, expires),
  readData: (id) => readSessionDataDb(id),
  updateData: (id, data, expires) => updateSessionDataDb(id, data, expires),
  deleteData: (id) => deleteSessionDataDb(id),
});

export const { getSession, commitSession, destroySession } = sessionStorage;
