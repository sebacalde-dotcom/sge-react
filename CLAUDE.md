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
- `materias`: una por curso y ciclo (`nombre`, `horas_semanales`, `personal_id` del docente; migración 014, permisos del área `ciclo`), que se cargan en Ciclo Lectivo → Materias. Las materias de un alumno se derivan de sus cursos (el principal y los adicionales): no hay tabla por alumno. `materia_clases` (día, turno, hora de inicio y de fin) ya existe en la base y va a guardar el Horario. `materia_alumnos` es de un modelo anterior (apunta a la tabla `alumnos`) y no se usa.
- `pases`, `reincorporaciones`. Archivar un legajo (`archivar_legajo`) lo saca de listas, planillas y tareas; eliminar (`eliminar_legajo`) solo se permite a un legajo archivado y no al personal.

## Reglas de negocio
- **La regularidad se calcula, no se guarda** (`inasistencias/regularidad.ts`). Hay reglas por período (`10 por bimestre`, `28 por ciclo`). Ser No Regular es persistente hasta que una reincorporación reinicie la regla infringida.
- **Alcance: solo escuelas de la Provincia de Buenos Aires (PBA) y de la Ciudad de Buenos Aires (CABA)**; otras provincias se verán después. Sus resoluciones oficiales son la fuente de verdad para todo (inasistencias, calificaciones, etc.). El usuario conoce bien PBA; CABA hay que basarla estrictamente en la resolución y marcar lo que no esté verificado.
- **La app sirve a más de un régimen de asistencia** (CABA y Provincia de Buenos Aires tienen reglas distintas). **Dónde se elige:** la jurisdicción de la escuela en Institución (`institucional.jurisdiccion`) y el régimen vigente en Ciclo Lectivo (`ciclos.regimen`, migración 013; vacío = el de la jurisdicción). `useRegimen()` (`inasistencias/useRegimen.ts`) es la fuente única de cuál rige; todo lo que dependa de la normativa (asistencia, calificaciones, etc.) debe leerlo de ahí. `inasistencias/regimenes.ts` define cada régimen: valores, fuente, `aVerificar` y limitaciones. Aplicarlo (`useAplicarRegimen`) carga sus valores en la configuración de inasistencias y de avisos, conservando teclas y mensajes de la escuela; Configuración de Inasistencias muestra si la configuración coincide (`diferenciasConRegimen`) y permite restaurar los valores. Los valores se guardan en la configuración global, no por ciclo (hoy cada alumno tiene un solo ciclo). Hoy hay un régimen por escuela.
- Cada regla (de regularidad o de aviso) tiene `cuenta` (`todas` o `injustificadas`) y `comparacion` (`alcanza` = mayor o igual, `supera` = mayor). Sin dato, `todas` y `alcanza`. La lógica común está en `inasistencias/conteo.ts`. En CABA se cuentan solo las injustificadas y se pierde al superar el tope; en PBA cuentan todas, también las justificadas, y no existe la pérdida de regularidad.
- El valor de una falta sale del tipo (`valor`, y `valor_doble_turno` si el ciclo tiene doble turno: un ausente vale 1 en turno simple y 0,5 por turno en doble turno). Se guarda en cada inasistencia al registrarla.
- `permite_reincorporaciones` (config de inasistencias, por defecto verdadero) apaga las reincorporaciones en regímenes que no las admiten (CABA).
- Cada reincorporación reinicia **solo las reglas infringidas** (las viejas, con `reglas` nulo, las reinician todas). El conteo vuelve a empezar desde esa fecha y **no borra inasistencias**.
- Los períodos (`notificaciones/periodos.ts`): los bimestres y trimestres se cargan con fechas en Ciclo Lectivo (`ciclos.periodos`, migración 012); si no están cargados se calculan por bloques de meses desde el inicio del ciclo, y las pantallas lo avisan. El cuatrimestre usa las fechas c1/c2. Una fecha que cae fuera de todos los períodos (receso) va al período siguiente. Los períodos definidos se identifican por su fecha de inicio (`periodo_desde` es una fecha): cambiarla después de generar notificaciones puede repetirlas. **Ningún período cruza el año ni pasa del fin del ciclo (`fin`): nada se retoma en enero.** No se recorta el inicio de un período porque esa fecha es la clave de las notificaciones ya generadas. Durante el receso no hay clases, así que no hay inasistencias que asignar.
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
- **Ciclo Lectivo:** secciones con sus cursos adentro (hoy son dos pestañas); pestaña Horario (día, hora y materia por curso, con fecha de vigencia porque el horario cambia durante el año), con el horario generado por IA. Las materias ya se cargan (Ciclo Lectivo → Materias) y llenan "Materias que cursa" de la Ficha académica; el Horario es la pieza que hace posible el 75% por materia de PBA. Sin resolver: si una materia puede tener distinto docente según el día, y materias optativas o electivas por alumno.
- **Inasistencias:** registro por materia, boletín de inasistencias (por bimestre, con los períodos del ciclo) y envío real de notificaciones por mail o WhatsApp.
- **Regímenes de asistencia, etapa 2 (decisiones del usuario, 2026-09-20):** en PBA no hace falta nada más por ahora: la carta con su seguimiento (que aparece como tarea pendiente en el tablero hasta que se firma) cubre las citaciones de las 10 y 20 faltas, y a las 28 alcanzan el aviso en la planilla y la carta. Preceptor y directivo son quienes citan y labran las actas. Lo específico de CABA (pérdida de regularidad al cierre del cuatrimestre en Tradicional, "No Regular en dos bimestres consecutivos" en Aprende) espera a que el usuario investigue CABA, porque el texto deja dudas de interpretación. La lista de recuperaciones pendientes espera a Materias y Calificaciones. Etapa 3: asistencia por materia (PBA): **al llegar a las 28 faltas se verifica, con todas las inasistencias del año y no solo las posteriores, si el alumno llega al 75% de asistencia en cada materia que cursa**. Por eso la asistencia por materia tiene que existir desde el inicio del ciclo, registrada clase por clase o derivada de la asistencia diaria más el horario. El porcentaje de cada materia es acumulado desde el inicio del ciclo hasta la fecha, y **el veredicto se toma al finalizar el cuatrimestre**: si ahí no llega al 75%, la materia se recupera, sin importar cómo evolucionó antes. Las materias a recuperar salen de la asistencia o de las calificaciones (aunque cumpla la asistencia): cuando se haga Calificaciones, usar una sola estructura de "materias a recuperar" con su motivo. **El fin de la cursada (fin del 2° cuatrimestre) no es el fin del ciclo lectivo (`fin`)**: entre ambos está el período de recuperación (a confirmar; suele ser desde las primeras semanas de diciembre), sin clases regulares. Depende de Materias, Horario y del registro por materia. Unificar en una sola lista las reglas de regularidad y las de aviso, que tienen la misma forma. Un régimen por curso si hiciera falta (una escuela con planes distintos, o doble turno solo en algunos cursos).
- **Portal de familias:** el adulto responsable es una persona propia; el acceso se decide por vínculo con casillas ("recibe notificaciones", "tiene acceso al portal"); el usuario se vincula con un código impreso en la carta. Falta decidir el método de login (Google, mail y clave, o código por WhatsApp/SMS). Primer paso sin esa decisión: las casillas por vínculo, el atajo "cargar progenitor como adulto responsable" y sacar a los padres de la lista de Legajos.
- Pestañas Ficha Médica y Boletines del legajo (hoy "próximamente"). `AlumnosPage` y `AlumnoFichaPage` no están conectadas a ninguna ruta.
