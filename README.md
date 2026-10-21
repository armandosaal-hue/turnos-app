# Turnos UCI

App web instalable (PWA) para gestionar turnos de 12 h y cambios con compañeros. Los datos se guardan solo en el navegador del dispositivo (IndexedDB).

## Uso en desarrollo

    npm install
    npm run dev      # servidor local
    npm test         # pruebas del motor y del importador
    npm run build    # versión para publicar en dist/

Prueba opcional con una plantilla real (no se guarda en el proyecto):

    REAL_XLSX=/ruta/plantilla.xlsx npx vitest run src/domain/real.local.test.ts

## Estructura

- `src/domain/importer.ts`: lectura del Excel de la unidad (mes, días, bloques de turno fijo, filas repetidas).
- `src/domain/legend.ts`: leyenda oficial y significados propios del Excel.
- `src/domain/rules.ts`: reglas configurables y detección de infracciones.
- `src/domain/engine.ts`: candidatos y devoluciones.
- `src/domain/state.ts`: versiones, diferencias, cambios y ediciones manuales.
- `src/ui/`: pantallas.
