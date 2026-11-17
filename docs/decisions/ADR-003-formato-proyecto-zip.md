# ADR-003 — Proyecto como archivo contenedor ZIP `.dwings`

- **Estado:** Aprobada
- **Fecha:** 2026-11-17

## Contexto

El público principal no es técnico: un proyecto debe ser un único archivo que se pueda copiar, enviar o respaldar sin perder medios. A la vez, el guardado debe ser seguro frente a cortes y permitir migrar versiones del formato.

## Opciones

- **Carpeta de proyecto:** guardado incremental sencillo, pero en Windows una carpeta no se comporta como un documento, y es fácil copiar solo una parte y perder los medios.
- **SQLite como archivo de aplicación:** transaccional e incremental, pero depende de un módulo nativo (o de `node:sqlite`, aún sin API estable) y es opaco para recuperar datos a mano.
- **ZIP con manifiesto:** es el estándar de facto en herramientas creativas (`.kra` de Krita, OpenRaster, `.docx`), se puede inspeccionar con cualquier descompresor y no necesita código nativo.

## Decisión

**Archivo ZIP con extensión `.dwings`**:

```
manifest.json      formato, versión del formato y versión de la app
project.json       documento completo (escenas, capas, trazos, animación y audio)
media/<sha256>.<ext>   imágenes y audio importados, almacenados sin comprimir (STORE)
cache/peaks/<sha256>.bin   forma de onda precalculada (regenerable)
thumbnail.png      miniatura para la pantalla de inicio
```

- Los medios se identifican por hash: se deduplican y nunca hay rutas absolutas.
- Los medios van sin comprimir, así que se pueden leer por rangos de bytes directamente desde el ZIP y reproducirse sin extraerlos.
- Guardado atómico: se escribe `nombre.dwings.tmp` en la misma carpeta, se hace `fsync` y se renombra sobre el original. Se conserva `nombre.dwings.bak` con la versión anterior válida.
- Autoguardado y recuperación: el documento se guarda periódicamente en la carpeta de datos de la aplicación (no en el archivo del usuario). Al abrir, si la copia de recuperación es más reciente que el archivo, se ofrece restaurarla.
- Validación al abrir con esquemas Zod. Las versiones antiguas se migran con funciones `migrate_vN_to_vN+1` probadas con fixtures. Una versión más nueva que la app se rechaza con un mensaje claro.
- El proyecto nunca contiene código ejecutable. Se rechazan las entradas con rutas sospechosas (`..`, absolutas) y los tamaños descomprimidos anómalos.

## Consecuencias

- Positivas: un archivo único y portable, recuperable a mano y sin dependencias nativas.
- Negativas: cada guardado reescribe el ZIP (los medios grandes se copian, aunque sin recomprimir). Si los proyectos con muchos cientos de MB de medios lo hacen lento, se puede migrar a escritura incremental o a SQLite en una versión posterior del formato.
