# Para ver (lista compartida)

La sección **Para ver** es una lista compartida para guardar películas, series y shows entre ambos usuarios autenticados.

## Qué incluye

- Página nueva en `/dashboard/para-ver`.
- Acceso desde navbar con icono de TV.
- Estados con leyenda e iconos:
  - `No se ha visto`
  - `Actualmente viendo`
  - `Ya se ha visto`
- Botón **Agregar para ver** con modal animado.
- Subida de portada (imagen), título y notas.
- Edición de estado, edición de notas/título y eliminación por tarjeta.

## Configuración en Supabase (una sola vez)

Ejecuta el SQL actualizado de `supabase_schema.sql` para crear:

- Tabla `public.para_ver_items`
- Políticas RLS para lectura/escritura compartida entre usuarios autenticados
- Bucket público `para-ver` para imágenes
- Políticas de `storage.objects` para ese bucket

## Modelo de datos

Tabla `para_ver_items`:

- `id` uuid (PK)
- `title` text
- `image_url` text nullable
- `status` text (`no_visto` | `viendo` | `visto`)
- `notes` text nullable
- `created_by` uuid nullable
- `created_at` timestamptz

