# Plataforma de gestión de adopción responsable

Aplicación web fullstack para la **Asociación Meraki** (Guatemala) que digitaliza el proceso de adopción de mascotas, la transparencia de donaciones y la difusión de historias del albergue. Fue desarrollada de forma individual como **proyecto de graduación** de Ingeniería en Sistemas de Información y Ciencias de la Computación (Universidad Mariano Gálvez de Guatemala).

🌐 Sitio en producción: [merakigt.org](https://merakigt.org)

<!-- Agrega aquí 2 o 3 capturas: ![Catálogo](docs/screenshots/catalogo.png) -->

## Qué resuelve

La asociación gestionaba adopciones y donaciones de forma manual. Esta plataforma permite que:

- los **adoptantes** consulten el catálogo, soliciten una adopción y den seguimiento a su solicitud;
- los **donantes** consulten cómo apoyar y vean la transparencia de los aportes;
- el **personal administrativo** gestione mascotas, solicitudes, donaciones y contenido desde un panel con permisos por rol.

## Funcionalidades

**Sitio público**
- Catálogo de mascotas con búsqueda por nombre y filtros por especie y género; ficha con galería de fotos.
- Solicitud de adopción: formulario dinámico y carta de compromiso aceptada con fecha, hora e IP.
- Cuenta de usuario: registro, verificación de correo, recuperación de contraseña, perfil, mascotas guardadas y estado de solicitudes (pendiente, en revisión, aprobada, rechazada).
- Donaciones: cuentas bancarias, insumos que necesita la asociación, notificación de donación con comprobante, resumen de transparencia, patrocinadores y proyectos financiados (fotos antes/durante/después).
- Historias: «Finales felices» y «Camino al arcoíris», con compartir en redes y vista previa Open Graph.
- SEO: páginas renderizadas en servidor, metadatos, `sitemap.xml` dinámico y `robots.txt`.

**Panel administrativo**
- Gestión de mascotas (con fotos), solicitudes de adopción, donaciones, patrocinadores, proyectos e historias.
- **Roles y permisos dinámicos** (Leer, Crear, Actualizar) almacenados en base de datos; el menú se genera a partir de los módulos asignados.
- Gestión de usuarios administrativos.
- Estadísticas con gráficos (solicitudes, catálogo, donaciones) y **exportación a Excel**.

## Seguridad

- Contraseñas con bcrypt; tokens de un solo uso para verificación de correo y recuperación de clave.
- Sesiones guardadas en el servidor (base de datos) con limpieza diaria programada (cron).
- **Rate limiting** persistente en inicio de sesión, registro, recuperación de clave, donaciones y solicitudes, con mensajes genéricos para evitar enumeración de usuarios.
- Validación de permisos en cada ruta administrativa y sanitización de entradas.
- Subida de imágenes validada en servidor (tipo y tamaño) y almacenadas en Cloudinary.

## Stack

| Capa | Tecnologías |
|---|---|
| Frontend | Remix 1.x, React 18, TypeScript, Tailwind CSS, Recharts, Sonner |
| Backend | Remix (loaders y actions), Node.js, Prisma ORM 6 |
| Base de datos | PostgreSQL (Supabase), 25 modelos |
| Servicios | Cloudinary (imágenes), Resend (correo), ExcelJS (reportes) |
| Despliegue | Vercel (con tarea programada) |

## Estructura del proyecto

```
app/
├── routes/
│   ├── __public/      # sitio público (catálogo, cuenta, donaciones, historias)
│   ├── __admin/       # panel administrativo
│   └── cron/          # tareas programadas
├── services/          # acceso a datos (Prisma), auth, correo, Cloudinary, sesiones
├── components/        # componentes reutilizables
└── utils/             # rate limiting, sanitización, SEO, helpers
prisma/
├── schema.prisma      # modelo de datos
└── dbml/schema.dbml   # diagrama del esquema
```

## Ejecutar en local

Requisitos: Node.js 18 o superior y una base de datos PostgreSQL.

```bash
git clone https://github.com/Victor-Estuardo/adopcionesApp.git
cd adopcionesApp
npm install
```

Crea un archivo `.env` en la raíz con estas variables (usa tus propios valores):

```env
DATABASE_URL=
DIRECT_URL=
SESSION_SECRET=
JWT_SECRET=
SALT_BCRYPT=
CRON_SECRET=
RESEND_KEY=
EMAIL_FROM=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SITE_URL=http://localhost:3000
```

Luego aplica el esquema y arranca el servidor de desarrollo:

```bash
npx prisma db push
npm run dev
```

> El proyecto no incluye datos semilla. Los módulos de navegación, roles y permisos se registran en las tablas `module`, `role`, `permission` y `permission_role` de una base nueva.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con compilación de Tailwind en vivo |
| `npm run build` | Compilación de producción |
| `npm run typecheck` | Verificación de tipos con TypeScript |

## Decisiones técnicas

- **Rutas por layouts** (`__public` y `__admin`) para separar el sitio público del panel y aplicar permisos por sección.
- **Menú y permisos en base de datos**, de modo que el personal pueda activar o desactivar módulos sin desplegar código.
- **Rate limiting y sesiones en PostgreSQL** en lugar de memoria, para que funcionen en un entorno serverless como Vercel.
- **`loader` en las páginas de contenido** para que los metadatos de SEO y Open Graph se generen en el servidor con datos reales.

## Autor

**Victor Estuardo López Rodríguez**
[LinkedIn](https://www.linkedin.com/in/victor-estuardo-lopez-rodriguez-59aab7211) · [GitHub](https://github.com/Victor-Estuardo)

## Licencia

Código publicado con fines de portafolio. Todos los derechos reservados © 2026 Victor Estuardo López Rodríguez.
