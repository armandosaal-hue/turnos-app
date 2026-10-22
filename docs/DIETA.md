# Mi dieta (app de macros)

App web instalable en `public/dieta/`. Se publica con el resto del proyecto en GitHub Pages, en la ruta `/dieta/`. No necesita compilación: HTML y JavaScript sin dependencias. Los datos del usuario (dieta, postres, favoritos y alimentos propios) se guardan en `localStorage` del dispositivo.

## Pantallas

1. **Equivalencias.** Se elige la comida. Arriba aparece su objetivo de hidratos, proteína y grasa. En comida y cena hay un hueco de postre: uno o varios postres, en unidades del envase o en gramos, que se restan del objetivo. Debajo, para cada macro, la lista de alimentos con los gramos que cubren lo que queda: peso seco o crudo y, en arroces, pastas, cereales, legumbres y tubérculos, también el peso cocido aproximado. Si la fuente da el peso de una medida casera, se muestra («≈ 2 rebanadas»). Cada fila indica lo que el alimento aporta de los otros macros. Hay buscador, filtro por origen (genéricos, Mercadona, Ahorramas, Lidl, Alcampo, propios) y favoritos.
2. **Ajuste fino.** Un alimento de cada grupo; la app reparte los gramos para cuadrar los tres macros a la vez (mínimos cuadrados no negativos ponderados en kcal 4/4/9), descontando el postre.
3. **Mi dieta.** Se pega el texto de la dieta («HC 60, P 30, G 15», «60 g de hidratos», una línea por macro o tres números en orden HC/P/G) y se revisa en una tabla antes de guardar.
4. **Alimentos.** Tabla con fuente de cada alimento y formulario para añadir productos propios con los datos de la etiqueta.

## Cálculo de equivalencias

Gramos = objetivo del macro × 100 / gramos del macro por 100 g del alimento. Se calcula solo por el macro principal. Legumbres, frutos secos, crema de cacahuete, huevo y queso curado aparecen también en su segundo grupo, marcados. Los gramos se redondean de 1 en 1 por debajo de 30 g y de 5 en 5 por encima.

## Datos

- **Genéricos:** USDA FoodData Central, base SR Legacy (2019). Hidratos = carbohidratos por diferencia (incluye fibra). Carnes y pescados en crudo. El peso cocido sale de la ficha del alimento cocido de la misma base y es aproximado.
- **Productos de supermercado:** tabla nutricional del envase recogida en Open Food Facts. Solo se incluyen productos con foto de la tabla nutricional, marca propia de la cadena y energía coherente con los macros (diferencia < 15 %). Hidratos según etiqueta europea (sin fibra). Cada producto lleva su código de barras y la fecha de la última edición de la ficha. Descartados: `3456775718416` (sin foto de la tabla), `8435177059162` (proteína incoherente), `20573768` (16 g de proteína por 100 g en atún al natural, valor atípico).

Para regenerar `public/dieta/alimentos.js`:

    python3 tools/dieta/generar_alimentos.py tools/dieta/datos/usda_sr_legacy.json tools/dieta/datos/productos_off.json public/dieta/alimentos.js

## Archivos

- `public/dieta/logic.js`: lector del texto, equivalencias, postres y ajuste fino (probado en `src/dieta/logic.test.js`).
- `public/dieta/alimentos.js`: generado; no editar a mano.
- `public/dieta/app.js`: pantallas.
- `tools/dieta/`: generador y datos de origen.
