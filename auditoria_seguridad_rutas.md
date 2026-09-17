# Auditoría de seguridad — Rutas y acciones (adopcionesApp)

**Fecha de auditoría:** 2026-09-16
**Alcance:** revisión de `loader` y `action` de las 28 rutas del proyecto, enfocada en control de acceso (autenticación + RBAC), IDOR, validación de entrada y manejo de datos sensibles.

**Cómo usar este archivo:** cada hallazgo tiene un checkbox. Márcalo cuando lo corrijas. El orden es por severidad (🔴 Crítico → 🟠 Alto → 🟡 Medio), que es también el orden recomendado de corrección.

**Patrón raíz detectado:** en Remix, el `loader` de un layout (`__admin.tsx`, `__mi-cuenta.tsx`) no protege automáticamente las `action` de las rutas hijas. Varias rutas validan permiso en su `loader` (la carga de página normal) pero **no** en su `action` (lo que se ejecuta al enviar un formulario o al hacer `fetcher.submit`) — que es exactamente por donde entra un POST directo sin pasar por la interfaz.

---

## 🔴 Crítico

### [x] SEC-01 — Aprobar/rechazar solicitudes sin ninguna verificación
- **Ruta:** `app/routes/__admin/solicitudes/$applicationId/index.tsx`
- **Acción(es):** `approve`, `reject`
- **Problema:** ninguna de las dos ramas verifica sesión ni permiso antes de ejecutar `updateAdoptionApplicationDb`.
- **Impacto:** cualquier persona (autenticada o no) que envíe un POST con `action=approve` o `action=reject` y un `applicationId` válido puede aprobar o rechazar cualquier solicitud de adopción del sistema. Contradice RNF2.2 del ERS (acceso restringido por rol y permisos).
- **Recomendación:** agregar al inicio de cada rama algo como `validatePermission(session, 10, "Actualizar")` (mismo módulo/acción que ya usa el `loader` de esta misma ruta), y cortar con `throw validateRequest` si falla — igual al patrón ya usado en `mascotas` o `donaciones`.

### [x] SEC-02 — Detalle de solicitud + datos del adoptante sin protección
- **Ruta:** `app/routes/__admin/solicitudes/$applicationId/index.tsx`
- **Acción(es):** `loadInformation`
- **Problema:** devuelve el detalle completo de la solicitud y la información personal del adoptante (`getEssentialUserDb`) sin validar sesión ni permiso. La sesión solo se lee para calcular una bandera de UI (`allowedToUpdate`), no como control de acceso.
- **Impacto:** exposición de datos personales de adoptantes a cualquiera que conozca o adivine un `applicationId`. Contradice RNF2.3 del ERS (evitar accesos no autorizados a información sensible de adoptantes).
- **Recomendación:** mismo fix que SEC-01 — `validatePermission(session, 10, "Leer")` al inicio de la rama, antes de consultar la base de datos.

---

## 🟠 Alto

### [x] SEC-03 — Listado completo de solicitudes sin protección en la acción
- **Ruta:** `app/routes/__admin/solicitudes/index.tsx`
- **Acción(es):** `loadInformation`
- **Problema:** el `loader` de la página sí valida `"Leer"` sobre el módulo 10, pero esta `action` (usada para filtrar/paginar vía fetcher) no valida nada.
- **Impacto:** listado completo de solicitudes (con datos de mascota y adoptante) accesible sin permiso.
- **Recomendación:** replicar el mismo `validatePermission(session, 10, "Leer")` del loader, al inicio de esta rama.

### [x] SEC-04 — Listado de roles y matriz de permisos sin protección
- **Ruta:** `app/routes/__admin/roles/index.tsx`
- **Acción(es):** `loadInformation`
- **Problema:** devuelve todos los roles y la lista completa de módulos con sus permisos, sin verificar sesión ni permiso.
- **Impacto:** exposición de la matriz de permisos del sistema — información sensible para quien quisiera mapear qué endpoints existen y qué acciones controlan.
- **Recomendación:** `validatePermission(session, 11, "Leer")` al inicio de la rama (mismo módulo que ya usa el loader de esta ruta).

### [x] SEC-05 — Listado de usuarios administrativos sin protección
- **Ruta:** `app/routes/__admin/usuarios/index.tsx`
- **Acción(es):** `loadInformation`
- **Problema:** devuelve la lista completa de usuarios administrativos (nombre, correo, teléfono, rol) sin verificar sesión ni permiso.
- **Impacto:** exposición de datos de contacto del personal administrativo (incluyendo, presumiblemente, a la fundadora y su hija).
- **Recomendación:** `validatePermission(session, 12, "Leer")` al inicio de la rama.

### [x] SEC-06 — Reenvío de invitación sin ninguna verificación
- **Ruta:** `app/routes/__admin/usuarios/index.tsx`
- **Acción(es):** `resend-invite`
- **Problema:** no verifica sesión ni permiso en ningún punto. Además, invalida el token de invitación vigente del usuario objetivo antes de crear uno nuevo.
- **Impacto:** cualquiera puede disparar el reenvío de invitación para cualquier `user_id`, e invalidar de paso el link de acceso que esa persona ya tenía pendiente de usar.
- **Recomendación:** `validatePermission(session, 12, "Crear")` (mismo permiso que `create-user`, ya que forma parte del mismo flujo de alta de usuarios) al inicio de la rama.

---

## 🟡 Medio

### [x] SEC-07 — Envío de solicitud de adopción sin rate limiting
- **Ruta:** `app/routes/__public/mascota/$petId/solicitar_adopcion/index.tsx`
- **Acción(es):** el envío del formulario de solicitud
- **Problema:** a diferencia de login, crear-cuenta, recuperar-clave y donación, esta ruta no usa `enforceRateLimits`.
- **Impacto:** posible spam de solicitudes falsas hacia el panel administrativo.
- **Recomendación:** agregar un límite por IP (y opcionalmente por `pet_id` o por correo del formulario), siguiendo el mismo patrón ya usado en `donacion/index.tsx`.

---

## Nota aparte (no es un hallazgo de seguridad, es de organización de código)

La lógica de `patrocinadores` (`create-patrocinador`) y de `needSupplies` (`insumo-create`, `insumo-update`, `insumo-toggle`) vive dentro de `app/routes/__admin/donaciones/index.tsx`, no en sus propias rutas — aunque cada intent ahí sí está correctamente protegido. No representa una brecha de seguridad, pero es una pista más de qué tan integrados están estos dos módulos "fuera de alcance" al flujo de donaciones — relevante para cuando decidas cómo documentarlos en el ERS.

---

## Referencia — lo que ya está bien implementado

Para no perder el contexto al corregir uno por uno: estas partes del sistema **no necesitan cambios**, y sirven como el patrón correcto a copiar en los hallazgos de arriba.

- **`mascotas`, `donaciones` (los 10 intents), `proyectos`, `patrocinadores`:** cada rama de su `action` valida permiso correctamente. `proyectos` y `patrocinadores` usan además un patrón de *whitelist* (`if (intent !== "create" && intent !== "update") return error`) — más seguro por diseño porque no hay forma de que exista una rama sin cubrir.
- **`mi-cuenta/*` (lado adoptante):** todas las consultas están acotadas a `session.get("dbUserId")`, nunca a un id que venga del cliente. `mi-cuenta/solicitudes/$applicationId` compara explícitamente `application.user_id != dbUserId` — el control anti-IDOR que falta del lado admin (SEC-01/SEC-02).
- **Subida de archivos:** validación de tipo MIME y tamaño en servidor, centralizada en `services/cloudinary/upload.ts`, aplicada a foto de perfil, comprobante de donación, logo de patrocinador y foto de proyecto.
- **Contraseñas y tokens:** bcrypt con salt; tokens de reseteo/invitación hasheados y con expiración; nunca en texto plano.
- **Sesión:** cookie `httpOnly`, `secure` en producción, `sameSite: lax`, datos respaldados en Postgres.
- **SQL crudo:** el único `$queryRaw` del proyecto (rate limiting) usa el template parametrizado de Prisma — sin riesgo de inyección.
- **`.env`** correctamente excluido en `.gitignore`.

---

## Resumen

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 2 |
| 🟠 Alto | 4 |
| 🟡 Medio | 1 |
| **Total** | **7** |
