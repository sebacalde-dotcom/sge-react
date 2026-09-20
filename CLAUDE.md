# SGE – Sistema de Gestión Escolar

App web para la gestión de una escuela: legajos de alumnos y personal, inasistencias, notificaciones a los padres y ciclo lectivo. La usa un administrador de escuela hispanohablante: **todo el texto de la interfaz va en español rioplatense** (voseo: "elegí", "cargá").

## Stack
React 19 · Vite 8 · TypeScript 6 · MUI 9 (API de `slotProps`, no `InputProps`) · react-hook-form · TanStack Query · react-router-dom 7 con `BrowserRouter` (no hay data router: `useBlocker` no funciona) · Supabase (Postgres, Auth con Google, Storage). El alias `@/` apunta a `src/`.

## Comandos
- `npm run dev`: servidor en el puerto 5173 (también está en `.claude/launch.json` como `sge-react-dev`).
- `npx tsc --noEmit -p tsconfig.app.json`: chequeo de tipos. Correrlo antes de dar algo por terminado.
- `npm run lint`: oxlint. `npm test`: vitest, sobre la lógica pura (regularidad, períodos, calendario, carta, permisos).
- `npm run build` = `tsc -b && vite build`.
- Un hook corre oxlint sobre cada `.ts`/`.tsx` de `src/` que se edita y avisa si hay errores.

## Estructura
`src/features/{alumnos,auth,config,dashboard,inasistencias,legajos}` · `src/lib` (calendario, permisos, supabase) · `src/hooks` (useConfig, usePermisos) · `src/contexts` (Auth, Ciclo) · `supabase/migrations` · `supabase/fixes`.

## Base de datos y migraciones
- Las migraciones (`supabase/migrations/NNN_*.sql`) las **corre el usuario a mano** en el SQL Editor de Supabase. Se escriben idempotentes, se guardan en el repo y **se pega el SQL completo en el chat** (el usuario no puede abrir archivos desde links). Hay un skill para esto: `/nueva-migracion`.
- No se edita una migración ya corrida: si hay que corregir, va una nueva.
- Nunca se escribe en la base de producción desde el navegador o con scripts. Las escrituras masivas son SQL que corre el usuario.
- Tras cambiar el esquema: `notify pgrst, 'reload schema'`.
- El front debe degradarse si una migración todavía no se corrió (sonda con una consulta o `'columna' in fila`) y mostrar un aviso en la interfaz.

## Roles y permisos
Roles: `admin`, `directivo`, `docente`, `preceptor`. En la base: `es_staff()` (cualquier personal), `es_admin()` (admin o directivo), `puede_configurar(area)` (delegable desde Configuración → Permisos; las áreas están en `src/lib/permisos.ts`). **Los permisos se aplican en RLS, no solo en la pantalla.**

Los usuarios con login son las filas de `personal`; el primer ingreso las vincula por mail (`link_current_user`). Un usuario sin fila en `personal` queda como no autorizado: las familias todavía no tienen acceso.

## Modelo de personas
- `personas`: `tipo` (alumno, docente, preceptor, directivo, padre, otro), `dni` único, `archivado_at`.
- `alumno_datos`: una fila por alumno. `estado`: `activo`, `pase` o `archivado`. `progenitores` (jsonb) son solo datos de filiación.
- `alumno_cursos`: secciones y cursos adicionales (el principal es `alumno_datos.curso_id`).
- `alumno_responsables`: adultos responsables, que son `personas` tipo `padre` vinculadas al alumno (contacto de emergencia, retiros). Un mismo adulto puede serlo de varios hermanos.
- `pases`, `reincorporaciones`. Archivar un legajo (`archivar_legajo`) lo saca de listas, planillas y tareas; eliminar (`eliminar_legajo`) solo se permite a un legajo archivado y no al personal.

## Reglas de negocio
- **La regularidad se calcula, no se guarda** (`inasistencias/regularidad.ts`). Hay reglas por período (`10 por bimestre`, `28 por ciclo`). Ser No Regular es persistente hasta que una reincorporación reinicie la regla infringida.
- Cada reincorporación reinicia **solo las reglas infringidas** (las viejas, con `reglas` nulo, las reinician todas). El conteo vuelve a empezar desde esa fecha y **no borra inasistencias**.
- Los períodos (`notificaciones/periodos.ts`): bimestre y trimestre cuentan desde el mes de inicio del ciclo; el cuatrimestre usa las fechas c1/c2 del ciclo. **Ningún período cruza el año ni pasa del fin del ciclo (`fin`): nada se retoma en enero.** No se recorta el inicio de un período porque esa fecha es la clave de las notificaciones ya generadas. Durante el receso no hay clases, así que no hay inasistencias que asignar.
- Las cartas a los padres son una página A4 en HTML (`@page` + `window.print()`) con un seguimiento: por imprimir → impresa → entregada → firmada.

## Trampas de código
- Un `update` o `delete` bloqueado por RLS **no da error: afecta 0 filas**. Usar `.select()` y verificar que devolvió filas.
- `.maybeSingle()` cuando la fila puede no existir (`.single()` falla).
- Las dependencias de un efecto deben ser referencias estables: `x ?? []` en las deps causó un loop infinito de renders. Usar una constante fuera del componente.
- Los archivos están con finales de línea CRLF (Windows). Conservarlos al editar con scripts.
- Vite a veces sirve un módulo intermedio tras dos ediciones seguidas ("X is not defined"): hacer `touch` del archivo.

## Cómo trabajar con el usuario
- Conversar en español. Commitear y pushear **solo cuando lo pida**. Mensajes de commit en español, con el porqué en el cuerpo.
- Verificar los cambios visibles en el navegador (`preview_start` con `sge-react-dev`) sin pedirle que revise.
- Nunca ingresar credenciales ni claves. La vulnerabilidad de `xlsx` (sin arreglo publicado) quedó diferida a propósito.

## Ideas pendientes (a discutir, no a implementar sin hablarlo)
- **Ciclo Lectivo:** secciones con sus cursos adentro (hoy son dos pestañas); pestañas Materias y Horario, con el horario generado por IA. Materias alimenta "Materias que cursa" de la Ficha académica. Los trimestres (y quizás los bimestres) deberían poder definirse en el ciclo con fechas, como los cuatrimestres c1/c2, cuando la escuela los use; hoy se calculan por bloques de meses. Diseño por cerrar.
- **Inasistencias:** registro por materia, boletín de inasistencias y envío real de notificaciones por mail o WhatsApp.
- **Portal de familias:** el adulto responsable es una persona propia; el acceso se decide por vínculo con casillas ("recibe notificaciones", "tiene acceso al portal"); el usuario se vincula con un código impreso en la carta. Falta decidir el método de login (Google, mail y clave, o código por WhatsApp/SMS). Primer paso sin esa decisión: las casillas por vínculo, el atajo "cargar progenitor como adulto responsable" y sacar a los padres de la lista de Legajos.
- Pestañas Ficha Médica y Boletines del legajo (hoy "próximamente"). `AlumnosPage` y `AlumnoFichaPage` no están conectadas a ninguna ruta.
