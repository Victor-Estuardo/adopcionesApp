import {
  category_proyectoFoto,
  Prisma,
  project,
  project_photo,
} from "@prisma/client";
import { GetBatchResult } from "@prisma/client/runtime/library";
import { sanitizeLimit } from "~/utils/sanitize";
import prisma, { handlePosiblePrismaError, PrismaUtilResponse } from "./prisma";

/*==================================================| TYPE |==================================================*/
export type ProjectPhoto = { id: number; url: string };

/* Etapas de la galería: el `category` del enum de Prisma, el `slug` que se usa
   como public_id en Cloudinary y como nombre de campo del form, y el `label`
   legible. */
export const PROYECTO_FOTO_CATEGORIES: {
  category: category_proyectoFoto;
  slug: string;
  label: string;
}[] = [
  { category: "Antes", slug: "antes", label: "Antes" },
  { category: "Durante", slug: "durante", label: "Durante" },
  { category: "Despu_s", slug: "despues", label: "Después" },
];

/**
 * Proyecto tal como lo ve el rol Administrativo al gestionarlo:
 * todos los campos editables + una foto por etapa (si existe).
 */
export type AdminProject = Pick<
  project,
  "id" | "name" | "description" | "goal" | "progress" | "status"
> & {
  sponsors: string[];
  photos: {
    antes: ProjectPhoto | null;
    durante: ProjectPhoto | null;
    despues: ProjectPhoto | null;
  };
};

/**
 * Proyecto tal como se muestra en su ficha pública: descripción, estado,
 * meta (si aplica), avance y galería de fotos ya agrupada por categoría
 * (antes/durante/después). `sponsors` son los patrocinadores con al menos una
 * donación pública y no rechazada registrada al proyecto.
 */
export type PublicProject = {
  id: number;
  name: string;
  description: string;
  goal: string | null;
  progress: number | null;
  status: "Activo" | "Finalizado";
  sponsors: { id: number; name: string }[];
  photos: {
    antes: ProjectPhoto[];
    durante: ProjectPhoto[];
    despues: ProjectPhoto[];
  };
};

/*==================================================| LIST |==================================================*/
/**
 * Función para obtener los proyectos para la vista pública, con su
 * galería de fotos agrupada por categoría y la lista de patrocinadores que han
 * aportado. Se ordenan los activos primero y, dentro de cada estado, del más
 * reciente al más antiguo.
 *
 * El `select` de las donaciones se limita a lo necesario para armar la lista de
 * patrocinadores (id y nombre) y filtra en la propia query las donaciones no
 * públicas o rechazadas, para no exponer aportes que no fueron autorizados.
 *
 * @param limit Cantidad máxima a retornar. Se sanitiza a un entero en [1, 30];
 *              si no es un número usable se ignora (sin límite).
 * @returns Lista de proyectos con fotos y patrocinadores
 */
export const listPublicProjectsDb = async (
  limit?: unknown,
): Promise<PrismaUtilResponse<PublicProject[]>> => {
  const take = sanitizeLimit(limit, { max: 30 });

  return await handlePosiblePrismaError(async () => {
    const rows = await prisma.project.findMany({
      take,
      orderBy: [{ status: "asc" }, { creation_date: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        progress: true,
        status: true,
        project_photo: {
          orderBy: { creation_date: "asc" },
          select: { id: true, url: true, category: true },
        },
        donation: {
          where: {
            patrocinador_id: { not: null },
            is_public: true,
            status: { not: "rechazada" },
          },
          select: { patrocinador: { select: { id: true, name: true } } },
        },
      },
    });

    return rows.map((row): PublicProject => {
      const photos: PublicProject["photos"] = {
        antes: [],
        durante: [],
        despues: [],
      };
      for (const foto of row.project_photo) {
        const item: ProjectPhoto = { id: foto.id, url: foto.url };
        if (foto.category === "Antes") photos.antes.push(item);
        else if (foto.category === "Durante") photos.durante.push(item);
        else photos.despues.push(item);
      }

      // Un patrocinador puede tener varias donaciones al mismo proyecto: se
      // deduplica por id conservando una sola entrada.
      const sponsorMap = new Map<number, string>();
      for (const donacion of row.donation) {
        if (donacion.patrocinador) {
          sponsorMap.set(donacion.patrocinador.id, donacion.patrocinador.name);
        }
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        goal: row.goal,
        progress: row.progress,
        status: row.status,
        sponsors: [...sponsorMap]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
        photos,
      };
    });
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función para listar los proyectos para la pantalla administrativa
 * . Devuelve una foto por etapa (o null) y los patrocinadores que
 * han aportado (todas las donaciones no rechazadas, no solo las públicas).
 * @returns Lista de proyectos con sus fotos por etapa
 */
export const listProyectosAdminDb = async (): Promise<
  PrismaUtilResponse<AdminProject[]>
> => {
  return await handlePosiblePrismaError(async () => {
    const rows = await prisma.project.findMany({
      orderBy: [{ status: "asc" }, { creation_date: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        progress: true,
        status: true,
        project_photo: {
          orderBy: { creation_date: "desc" },
          select: { id: true, url: true, category: true },
        },
        donation: {
          where: {
            patrocinador_id: { not: null },
            status: { not: "rechazada" },
          },
          select: { patrocinador: { select: { name: true } } },
        },
      },
    });

    return rows.map(
      ({ project_photo, donation, ...proyecto }): AdminProject => {
        const photos: AdminProject["photos"] = {
          antes: null,
          durante: null,
          despues: null,
        };
        for (const foto of project_photo) {
          const item: ProjectPhoto = { id: foto.id, url: foto.url };
          // La primera (más reciente) por etapa gana; solo debería haber una.
          if (foto.category === "Antes") photos.antes ??= item;
          else if (foto.category === "Durante") photos.durante ??= item;
          else photos.despues ??= item;
        }

        const sponsors = [
          ...new Set(
            donation
              .map((d) => d.patrocinador?.name)
              .filter((name): name is string => !!name),
          ),
        ].sort((a, b) => a.localeCompare(b, "es"));

        return { ...proyecto, sponsors, photos };
      },
    );
  });
};

/*==================================================| LIST |==================================================*/
/**
 * Función ligera para poblar selects de "proyecto" (filtros, formulario de
 * registro manual): solo id y nombre, todos los proyectos.
 * @returns Lista de `{ id, name }`
 */
export const listProjectOptionsDb = async (): Promise<
  PrismaUtilResponse<{ id: number; name: string }[]>
> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  });
};

/*==================================================| GET |==================================================*/
/**
 * Función para obtener un proyecto puntual (p. ej. para validar, al registrar
 * una donación, que el proyecto asociado enviado exista).
 * @param where Filtro (normalmente `{ id }`)
 * @returns El proyecto o `null`
 */
export const getProyectoDb = async (
  where: Prisma.projectWhereInput,
): Promise<PrismaUtilResponse<project | null>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project.findFirst({ where });
  });
};

/*==================================================| CREATE |==================================================*/
/**
 * Función para registrar un proyecto.
 * @param data Datos del proyecto (incluye `creator_id`/`updater_id`)
 * @returns El proyecto creado
 */
export const createProyectoDb = async (
  data: Prisma.projectUncheckedCreateInput,
): Promise<PrismaUtilResponse<project>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project.create({ data });
  });
};

/*==================================================| UPDATE |==================================================*/
/**
 * Función para editar un proyecto o cerrarlo (cambiar estado a Finalizado).
 * @param id Id del proyecto
 * @param data Campos a editar (`status`, `updater_id`, `update_date`, ...)
 * @returns El proyecto actualizado
 */
export const updateProyectoDb = async (
  id: number,
  data: Prisma.projectUncheckedUpdateInput,
): Promise<PrismaUtilResponse<project>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project.update({ where: { id }, data });
  });
};

/*==================================================| FOTOS |==================================================*/
/**
 * Lista las fotos de un proyecto (o de una etapa).
 */
export const listProyectoFotosDb = async (
  where: Prisma.project_photoWhereInput,
): Promise<PrismaUtilResponse<project_photo[]>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project_photo.findMany({ where });
  });
};

/**
 * Registra la foto de una etapa de un proyecto.
 */
export const createProyectoFotoDb = async (
  data: Prisma.project_photoUncheckedCreateInput,
): Promise<PrismaUtilResponse<project_photo>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project_photo.create({ data });
  });
};

/**
 * Borra filas de fotos de proyecto (al reemplazar o quitar la foto de una
 * etapa). El asset de Cloudinary se limpia aparte en la ruta.
 */
export const deleteProyectoFotosDb = async (
  where: Prisma.project_photoWhereInput,
): Promise<PrismaUtilResponse<GetBatchResult>> => {
  return await handlePosiblePrismaError(async () => {
    return prisma.project_photo.deleteMany({ where });
  });
};
