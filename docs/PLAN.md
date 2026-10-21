# Plan: app de gestión de turnos y cambios para enfermería

## Estado y siguiente paso (continuidad)
Fase 1 hecha y probada en `/home/user/turnos-app` (commit local c2db740). El contenedor de esta sesión es temporal: el código hay que guardarlo en GitHub antes de que se recicle.
Siguiente paso recomendado:
1. Armando conecta su cuenta de GitHub en https://claude.ai/connect-github (desde cualquier navegador) y crea un repositorio vacío (p. ej. `turnos-app`).
2. Se adjunta el repositorio a la sesión con permiso de escritura y se sube el código (rama principal).
3. Publicación con GitHub Pages (workflow de Actions que ejecuta `npm ci && npm test && npm run build` y publica `dist/`). Pages en repositorio privado requiere plan de pago; en público solo se ve el código, no los datos.
4. Armando abre la URL en el móvil y la instala ("Añadir a pantalla de inicio").
Decisión de Armando ahora: copia .zip del código (sin node_modules ni dist, con el historial git) en `/home/user/turnos-app.zip`, enviada como archivo descargable. GitHub y publicación se retoman desde casa.

## Contexto
Armando trabaja a turnos y quiere una app en el móvil donde:
1. Sube la plantilla en foto, PDF o Excel (la suya y la de sus compañeros, siempre de su misma categoría).
2. La app la convierte en un calendario editable y la actualiza cuando el centro publica una versión nueva.
3. Al pedir un cambio (quitarse un día o ponerse a trabajar un día), la app propone compañeros ordenados de mejor a peor opción.

El directorio de trabajo está vacío: es un proyecto nuevo.

## Arquitectura propuesta
- **PWA (app web instalable)** con React + Vite + TypeScript. Se instala en el móvil desde el navegador, usa la cámara y no requiere publicar en App Store / Google Play.
- **Lectura de la plantilla (foto, PDF o Excel)**: los tres formatos acaban en el mismo JSON estructurado `{trabajador, fecha, código_turno}` y pasan por los mismos pasos posteriores (códigos desconocidos, revisión, versiones).
  - *Foto y PDF*: Claude con visión (API de Anthropic) acepta imagen y PDF directamente. Si el PDF es de varias páginas, se procesa entero. Una función serverless pequeña (Vercel/Netlify/Cloudflare) guarda la API key; nunca va en el móvil.
  - *Excel (.xlsx, .xls, .csv)*: se lee en el propio móvil con la librería SheetJS, sin IA ni coste por carga y sin errores de lectura de celdas. La primera vez indicas en qué fila están las fechas, en qué columna los nombres y dónde empieza el cuadrante; la app guarda ese formato y lo reutiliza en las siguientes cargas. Si el Excel tiene celdas combinadas o un diseño irregular que no encaja, se puede enviar a Claude como alternativa.
- **Códigos desconocidos**: tras la lectura, la app compara cada código con la leyenda guardada. Si aparece uno que no está (p. ej. "MT", "R", "*"), lo marca y abre un formulario para definirlo (nombre, hora de inicio, hora de fin, si cuenta como trabajo, libre o ausencia). Queda guardado en la leyenda y se reconoce en las siguientes plantillas.
- **Pantalla de revisión obligatoria** tras la lectura: tabla editable donde se corrigen errores antes de guardar. Una foto torcida o con letra a mano produce errores; la app no debe calcular cambios sobre datos sin revisar.
- **Datos**: v1 en el propio móvil (IndexedDB). v2 opcional en la nube (Supabase) si los compañeros también usan la app.

## Excel real analizado
Uso: solo Armando, de momento. Estructura detectada:
- Una hoja ("2026 real"), sin celdas combinadas ni comentarios.
- Fila 1: nombre del mes escrito letra a letra sobre su primera columna (ENERO en C, FEBRERO en AH, MARZO en BJ, ABRIL en CO, MAYO en DS). Fila 2: número de día (mezcla de número y texto: 1.0 y "3"). Fila 3: inicial del día de la semana. Columna C = 1/1/2026 (jueves, coincide). Última columna con día: EW (31 de mayo). 
- Columna A: número de puesto (1, 10.1, 13.1… los ".1" son puestos compartidos o suplencias). Columna B: nombre ("APELLIDOS, NOMBRE", a veces con "(RJ 85%)" o "(50%)").
- Bloque principal: filas 4–117, rotatorio. Segundo bloque desde la fila 118 con su propia cabecera (nombre de la unidad), que llega solo hasta el 30 de abril, y subgrupos de turno fijo: MAÑANA (fila 121), NOCHES A (123), NOCHES B (125–126).
- Un mismo nombre puede aparecer en dos filas (una compañera en filas 76 y 91): el importador debe unir las filas por persona y avisar si hay solapes.
- Los colores de relleno (gris, azul, amarillo) no parecen llevar información de turno; se ignoran salvo que Armando diga lo contrario.

Patrón del rotatorio: casi siempre `vacío → N → D → L`. N va seguida de D en 2163 de 2648 casos y de otra N en 448; D va precedida de N en 2163 casos.

Confirmado por Armando:
- Celda vacía = diurno de 12 h (trabajo). El importador no trata "vacío" como "sin dato": la leyenda tiene una entrada específica para la celda vacía.
- N = nocturno de 12 h.
- M = mañana. T = tarde (en este Excel).

Leyenda oficial recibida (códigos del sistema de gestión del centro, con descripción). Se precarga en la app. Confirma D = DESCANSO (NOCHES) y L = LIBRE.

Decisiones derivadas de la leyenda:
- **Distingue mayúsculas**: en la leyenda oficial M = MATERNIDAD y Ma = MAÑANA; T = TRABAJADO y Td = TARDE. El Excel de la unidad usa M y T con otro significado. La app guarda una **leyenda por fuente**: la oficial como base y, encima, los significados propios de este Excel (M = mañana, T = tarde, vacío = diurno 12 h), que tienen prioridad.
- **Coincidencia**: primero exacta; si no hay, la app propone la coincidencia sin mayúsculas ("PC"/"pc" → Pc, PERMISOS RETRIBUIDOS) y pide confirmación antes de guardarla.
- **Tipo**: la leyenda oficial solo trae descripción. Cada código necesita además tipo (trabajo / libre / ausencia) y horas; se rellenan para los códigos que aparecen en las plantillas de Armando, no para los ~90 de golpe.
- Medias jornadas (/M, /N, /T) son trabajo con horario parcial; el cálculo de descanso usa su horario propio.

Códigos del Excel que no están en la leyenda oficial y hay que definir: x (509), OPE (53), NO (53), % (19), 12 (12), LC (6), * (6), For (2), ur (2), uci (2), "." (2), "n." (2), 13 (1).

**Alcance de turnos (decisión de Armando): solo turnos de 12 h.** Armando trabaja 12 h y no hará otros turnos, así que el motor solo maneja dos turnos intercambiables:

| Turno | Código | Horario |
|---|---|---|
| Diurno 12 h | celda vacía | 08:00–20:00 |
| Nocturno 12 h | N | 20:00–08:00 del día siguiente |

Los turnos de 7 h (M mañana 08–15, T tarde 15–22) y la noche de 10 h (22–08) quedan fuera por ahora: no se proponen ni se piden en cambios. Un compañero con M o T ese día cuenta como ocupado (no disponible). El personal fijo de MAÑANA queda fuera como candidato. El personal fijo de NOCHES A/B también queda fuera (decisión de Armando). Se podrán activar más adelante desde Ajustes.

Tipos confirmados:
- Trabajo intercambiable: vacío (diurno 12 h), N.
- Ocupado, no intercambiable: M, T.
- Libre disponible: L, Lh, y D salvo el inmediatamente posterior a una N (p. ej. el segundo D de N N D D).
- No disponible (ausencia): B, V, A, Lac, Ls, Pc, el D inmediatamente posterior a una N, y todos los códigos sin leyenda (x, OPE, NO, %, 12, 13, LC, *, For, ur, uci, ".", "n.").
- **Regla por defecto**: cualquier código nuevo o sin tipo asignado cuenta como no disponible hasta que Armando diga lo contrario. Nunca se trata como libre por omisión.

Reglas duras confirmadas:
- No se puede trabajar el D inmediatamente posterior a una N.
- No se pueden hacer 24 h seguidas: prohibido diurno + N el mismo día y N → diurno al día siguiente.
- N → N está permitido.
- Sin límite de noches ni de días seguidos en la fase 1 (se pueden añadir desde Ajustes).

Armando no figura todavía en este Excel (entrará en planilla). La app tiene un selector "yo soy" con el nombre tal como aparecerá en la columna B; mientras no aparezca, el motor se prueba eligiendo cualquier fila del Excel como "yo". Cuando llegue una versión con su nombre, el importador lo detecta y lo vincula.

Códigos encontrados (frecuencia) que hay que definir en la leyenda; no se asigna significado sin confirmación:
L 6925, D 2662, N 2648, Lh 1008, B 592, x 509, V 93, M 81 (en el bloque de mañana), Lac 60, OPE 53, NO 53, PC 19, % 19, pc 17, A 17, 12 12, Ls 10, * 6, LC 6, T 5, For 2, . 2, n. 2, ur 2, uci 2, Lh* 1, 13 1.
Variantes que conviene unificar: "PC"/"pc", "Lh"/"Lh*", "N"/"n.".

Con esto el importador de Excel de la fase 1 se diseña para este formato concreto (cabecera en filas 1–3, nombres en B, datos desde C), con el asistente de filas y columnas solo como respaldo si el centro cambia el formato.

## Actualización de la plantilla
El centro publica versiones nuevas de la plantilla con los cambios hechos. La app trata cada carga como una **versión** del mismo periodo, no como una plantilla nueva:
1. Subes la nueva foto, PDF o Excel y la app detecta que el periodo ya existe.
2. Compara celda a celda con la versión guardada y muestra solo las diferencias ("Ana, 12/11: L → N").
3. Cruza esas diferencias con los cambios que tienes registrados:
   - Cambio registrado que aparece en la plantilla oficial → pasa a "confirmado por el centro".
   - Cambio registrado que no aparece → aviso: pendiente o no aprobado.
   - Diferencia sin cambio registrado → aviso para revisar (cambio de otros compañeros, ajuste de supervisión o error de lectura).
4. Aceptas (o corriges) y la nueva versión pasa a ser la vigente. Las anteriores quedan en un historial con fecha.
También se puede editar a mano una celda concreta sin subir la plantilla entera, y esa edición queda marcada como "manual" hasta que una versión oficial la confirme.

## Modelo de datos
- `Trabajador`: nombre, preferencias (p. ej. "no noches en fin de semana"). Todas las plantillas son de tu misma categoría, así que no hace falta campo de categoría ni filtrarla.
- `CódigoTurno` (leyenda): código, nombre, hora de inicio, hora de fin (puede ser del día siguiente, como en la noche), tipo (trabajo / libre / ausencia). Totalmente editable desde Ajustes: añadir, modificar, borrar. Se rellena también desde el aviso de código desconocido.
- `Regla`: tipo, valor, activa/inactiva, dura/blanda (ver motor).
- `VersiónPlantilla`: periodo, fecha de carga, archivo de origen y formato (foto/PDF/Excel), vigente sí/no.
- `FormatoExcel`: fila de fechas, columna de nombres, rango del cuadrante (para reutilizar en cada carga).
- `Turno`: trabajador + fecha + código + versión + origen (oficial / manual / cambio).
- `Cambio`: quién, qué día, con quién, día de devolución, estado (propuesto/aceptado/aprobado por supervisión), saldo pendiente.

## Motor de recomendación
Principio: la app **simula el calendario resultante** de las dos personas tras el cambio y lo valida entero con las reglas. Un candidato o una devolución solo aparece si ambos calendarios simulados cumplen todas las reglas duras.

**Quitarme un día (día D, turno X)**
Un compañero es candidato solo si:
1. Ese día D no trabaja (su código es de tipo libre; no ausencia, vacaciones ni baja).
2. Su turno del día anterior (D-1) es compatible con empezar X: respeta las horas mínimas de descanso y ninguna secuencia prohibida.
3. Su turno del día siguiente (D+1) es compatible con haber hecho X (p. ej. si X es N y al día siguiente tiene M, queda descartado).
4. Su calendario con X añadido en D no rompe ninguna otra regla (días seguidos, noches seguidas, descanso semanal, fines de semana).

**Opciones de devolución para cada candidato**
Para cada candidato válido, la app busca días R en los que yo le devuelvo el turno (yo trabajo su turno Y en R y él libra). R es válido solo si:
1. Él trabaja en R y yo no trabajo en R (libre, no ausencia).
2. Mi turno de R-1 y R+1 es compatible con hacer Y, con las mismas reglas de descanso y secuencias.
3. Mi calendario resultante (sin X en D, con Y en R) cumple todas las reglas.
4. Su calendario resultante (con X en D, sin Y en R) cumple todas las reglas.
Las devoluciones se ordenan por cercanía a D, mismo tipo de turno (N por N, fin de semana por fin de semana) y menor carga resultante. Se muestran las 3–5 mejores y se puede ver la lista completa o buscar en un rango de fechas.
Si un candidato no tiene ninguna devolución válida en el periodo cargado, aparece igualmente marcado "sin devolución posible" (vale como cambio a deber).

**Ponerme a trabajar (día D, turno Y de un compañero)**
Mismo esquema invertido: el compañero trabaja Y en D, yo libro D y mi D-1 y D+1 son compatibles con Y; su calendario sin Y y el mío con Y cumplen las reglas. Las devoluciones son días en que él me hace a mí un turno, con las mismas cuatro condiciones.

**Reglas duras (descartan al candidato)**
Las reglas las defines tú en Ajustes. La app trae plantillas de regla que activas y ajustas, sin valores impuestos:
- Horas mínimas de descanso entre el fin de un turno y el inicio del siguiente (se calcula con las horas de la leyenda, así N→M queda descartado si no llega al mínimo).
- Secuencias prohibidas de códigos (p. ej. "N → M", "N → T").
- Máximo de días de trabajo seguidos y máximo de noches seguidas.
- Descanso mínimo semanal o en un periodo (horas o días libres).
- Máximo de fines de semana trabajados al mes.
- Códigos que bloquean el cambio (vacaciones, baja, permiso), definidos por su tipo en la leyenda.
Cada regla se puede marcar como dura (descarta) o blanda (solo resta puntos). Los valores deben coincidir con la normativa y el pacto de tu centro; los compruebas tú.

**Puntuación de candidatos (ordena de mejor a peor, solo entre los válidos)**
- Tiene devoluciones válidas, y cuántas (+ alto).
- Saldo de cambios: quién te debe un día puntúa más; a quien ya debes, menos.
- Carga resultante: no deja al compañero con racha larga ni fin de semana extra.
- Preferencias declaradas del compañero.
- Historial: compañeros que aceptaron cambios antes.
- Reglas blandas que incumpliría (resta).
Cada candidato se muestra con la explicación ("libra el 12, el 11 tiene T y el 13 libra, te debe 1 cambio") y debajo sus devoluciones ("14/11 N", "20/11 N"). Opción de ver los descartados y el motivo ("descartado: el 13 tiene M tras tu N").

## Pantallas
1. Subir foto, PDF o Excel (en Excel, la primera vez, indicar filas y columnas) → definir códigos desconocidos → revisión y corrección → guardar plantilla del mes. Si el periodo ya existe: pantalla de diferencias con la versión anterior.
2. Calendario propio y vista de unidad (cuadrante).
3. "Quiero cambiar un día": eliges día y tipo → lista ordenada de candidatos con motivo.
4. Registro de cambios y saldo con cada compañero.
5. Ajustes: leyenda de turnos (editable), reglas (crear, editar, activar, dura/blanda), compañeros.

## Fases
1. **MVP (uso personal)**: PWA, leyenda y reglas editables, carga desde Excel (o manual), detección de códigos desconocidos, versiones y comparación de diferencias, motor de reglas, recomendaciones con devoluciones y registro básico de cambios (necesario para puntuar por saldo). Sin foto todavía. El Excel entra aquí porque no depende de la IA y da datos exactos para probar el motor; los códigos desconocidos y las versiones también, porque no dependen del formato.
2. **Foto y PDF**: función serverless + Claude visión + pantalla de revisión. Reutiliza todo lo de la fase 1.
3. **Ampliar registro de cambios**: historial, estados (propuesto/aceptado/aprobado), exportar a calendario (.ics) o mensaje de WhatsApp para pedir el cambio.
4. **Opcional, compartida**: cuentas, cada compañero confirma su plantilla y acepta/rechaza cambios.

## Puntos a tener en cuenta
- **Protección de datos**: los turnos de compañeros con nombre son datos personales. Para uso exclusivamente personal el riesgo es bajo; si la app se comparte o guarda datos en la nube, hace falta su consentimiento y cumplir el RGPD. Recomiendo v1 local en el móvil.
- **El cambio oficial lo aprueba supervisión**: la app propone y registra, no sustituye el procedimiento del centro.
- **Coste**: cada foto o PDF procesado consume una llamada a la API de Anthropic (céntimos por archivo); el Excel no tiene coste salvo que se envíe a Claude por tener un diseño irregular; el alojamiento de la PWA puede ser gratuito.
- **Devoluciones limitadas al periodo cargado**: la app solo conoce los meses que has subido. Si la plantilla del mes siguiente no está, no puede proponer devoluciones en él.

## Verificación
- Tests unitarios del motor de reglas con cuadrantes de ejemplo: candidato que trabaja ese día (descartado), candidato con M al día siguiente de una N (descartado), devolución que me deja N→M a mí (descartada), devolución que rompe la racha máxima del compañero (descartada), candidato sin devolución, regla desactivada, días en el límite del periodo cargado (D-1 o D+1 fuera de la plantilla: avisar en vez de suponer).
- Probar la lectura con 3–5 plantillas reales (fotos y PDF) y medir cuántas celdas hay que corregir.
- Cargar el mismo mes en Excel y en foto y comprobar que salen cuadrantes idénticos tras la revisión; cargar un segundo Excel y comprobar que reutiliza el formato guardado.
- Subir dos versiones del mismo mes con 3 cambios conocidos y comprobar que la app muestra exactamente esas diferencias y marca como confirmados los cambios registrados.
- Meter una plantilla con un código inventado y comprobar que la app lo detecta, pide definirlo y lo reconoce en la siguiente carga.
- Prueba en el móvil: instalar la PWA, hacer foto, pedir un cambio y comprobar el orden de candidatos frente a lo que tú elegirías.

## Estado de los datos
- Recibido: Excel ene–may 2026 y leyenda oficial. Uso: solo Armando. Armando aún no figura en el Excel.
- Cerrado: alcance solo 12 h (diurno 08–20, N 20–08), tipos de cada código, reglas duras de la fase 1.
- Opcional, no bloquea: foto y PDF de ejemplo para la fase 2; reglas adicionales (máximos de días o noches seguidas, fines de semana) desde Ajustes.
