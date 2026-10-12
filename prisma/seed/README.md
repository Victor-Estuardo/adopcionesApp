# Seed y migraciones

Guía para mantener al día todas las bases de datos (producción, pruebas, local).

Hay dos tipos de cambios y cada uno se propaga distinto:

| Tipo de cambio | Dónde vive | Cómo se propaga |
|---|---|---|
| **Estructura** (tablas, columnas, enums, índices) | `prisma/schema.prisma` + `prisma/migrations/` | `prisma migrate deploy` |
| **Configuración** (roles, módulos, permisos, especies, preguntas del formulario) | `prisma/seed/data/*.json` | `prisma db seed` |

El resto de los datos (usuarios, mascotas, solicitudes, donaciones, historias, etc.) **no** va en el seed: es contenido de cada entorno.

---

## 1. Montar una BD nueva

1. En `.env` apunta `DATABASE_URL` y `DIRECT_URL` a la BD nueva (`DIRECT_URL` = conexión directa, puerto 5432).
2. Agrega `ADMIN_EMAIL` y `ADMIN_PASSWORD` (opcional `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`).
3. Aplica el esquema: `npx prisma migrate deploy`
4. Siembra la configuración y el administrador: `npx prisma db seed`

El seed es idempotente: se puede correr de nuevo sin duplicar nada. Si el usuario 1 ya existe, no se modifica (tampoco su contraseña).

### BD que ya tenía el esquema (solo la primera vez)

Si la BD ya existía antes de las migraciones, no ejecutes `0_init`; márcala como aplicada:

```bash
npx prisma migrate resolve --applied 0_init
```

---

## 2. Cambiar la estructura (nueva tabla, columna, enum...)

1. Edita `prisma/schema.prisma`.
2. Apunta `.env` a la BD **de pruebas** y genera la migración:
   ```bash
   npx prisma migrate dev --name descripcion_corta_del_cambio
   ```
   Revisa el SQL generado en `prisma/migrations/<fecha>_<nombre>/migration.sql` antes de seguir.
3. Haz commit de `schema.prisma` y de la carpeta de la migración.
4. Para aplicarlo en otras BDs (producción incluida):
   ```bash
   npx prisma migrate deploy
   ```

Reglas:
- **Nunca** edites tablas a mano en el dashboard de Supabase: la BD se desvía del repo y la siguiente migración falla.
- **Nunca** edites una migración ya aplicada; crea otra nueva.
- No uses `prisma db push` en entornos con datos reales.
- Si el cambio es destructivo (borrar columna o tabla), respalda antes de hacer `migrate deploy` en producción.

---

## 3. Agregar o cambiar configuración

La configuración se crea en la BD de pruebas (con la app o con SQL), se **exporta** a los JSON y se commitea. Así queda reproducible en cualquier BD.

### Nuevo módulo con sus permisos

1. Crea el módulo en la tabla `module` (clave de ruta, nombre, icono, `nav_zone`, `nav_audience`, `order`).
2. Crea sus permisos en `permission` (uno por acción: Leer, Crear, Actualizar, Eliminar, Guardar).
3. Asigna los permisos a los roles en `permission_role`.
4. Exporta y commitea:
   ```bash
   npm run db:export-config
   git add prisma/seed/data
   git commit -m "Agregar módulo X a la configuración"
   ```
5. En las demás BDs: `npx prisma db seed`.

### Otros casos

- **Nueva especie** (`petSpecies`): el seed la crea con `creator_id`/`updater_id` ya definidos en el JSON; deben apuntar a un usuario que exista (el 1).
- **Nuevas preguntas del formulario de adopción** (`formQuestion`): mantén `sort_order` consistente. No cambies el `id` de una pregunta existente: las respuestas ya guardadas la referencian.
- **Nuevo rol de sistema** (`role`): luego asígnale permisos en `permission_role`.

### Qué hace (y qué no) el seed

- Inserta las filas que faltan y **actualiza** las existentes con lo que diga el JSON (por `id`).
- Alinea las secuencias de ids al final, para que los próximos inserts no choquen.
- **No borra** filas. Si quitas un módulo, permiso o pregunta, bórralo también en cada BD (a mano o con una migración); si no, el seed lo dejará ahí.
- Los ids son parte de la configuración (por ejemplo `/donaciones` es el módulo 15). No los renumeres.

---

## 4. Orden recomendado cuando un cambio toca estructura y configuración

1. Migración de estructura → commit.
2. Configuración nueva en BD de pruebas → `npm run db:export-config` → commit.
3. En cada BD destino: `npx prisma migrate deploy` y luego `npx prisma db seed`.

## 5. Comandos útiles

| Comando | Para qué |
|---|---|
| `npx prisma migrate deploy` | Aplicar migraciones pendientes |
| `npx prisma migrate dev --name x` | Crear y aplicar una migración (solo BD de pruebas) |
| `npx prisma migrate status` | Ver si la BD está al día con las migraciones |
| `npx prisma db seed` | Sembrar configuración y administrador |
| `npm run db:export-config` | Regenerar `prisma/seed/data/*.json` desde la BD actual |
| `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` | Detectar desvíos entre la BD y `schema.prisma` (vacío = sin diferencias) |

## 6. Archivos

- `seed.ts`: lee los JSON y hace los upserts en orden de llaves foráneas.
- `export-config.ts`: vuelca la configuración de la BD actual a `data/`.
- `data/*.json`: `role`, `module`, `permission`, `permission_role`, `petSpecies`, `formQuestion`.
