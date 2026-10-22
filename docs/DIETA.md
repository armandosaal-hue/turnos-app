# Mi dieta (app de macros)

App web instalable en `public/dieta/`. Se publica con el resto del proyecto en GitHub Pages, en la ruta `/dieta/`. No necesita compilación: HTML y JavaScript sin dependencias. Los datos del usuario (dieta, postres, favoritos y alimentos propios) se guardan en `localStorage` del dispositivo.

## Pantallas

1. **Comida.** Se elige la comida. Arriba, lo que llevas frente al objetivo (hidratos, proteína, grasa y kcal) y lo que queda. En comida y cena hay hueco de postre (uno o varios, en unidades o gramos). Debajo, **Tu plato**: los alimentos que añades desde las listas de hidratos, proteína y grasa. La app reparte los gramos de todo el plato a la vez: cada alimento cubre su macro y se descuenta lo que aportan los demás (si el arroz trae proteína, el pollo baja). Una cantidad se puede fijar con ±5 g y el resto se reajusta. Cada opción de la lista muestra los gramos que le tocarían si se añade en ese momento, con peso cocido y medida casera cuando hay dato. Pestaña **Todos** para buscar entre todos los alimentos a la vez (cada uno cuenta en su grupo principal) y pestañas por macro. Buscador, filtro por origen y favoritos. En los líquidos (leches, kéfir, batidos, aceites) se da también el volumen en mililitros y, desde 100 ml, en vasos de 250 ml.
2. **Mi dieta.** Se pega el texto de la dieta («HC 60, P 30, G 15», «60 g de hidratos», una línea por macro o tres números en orden HC/P/G) y se revisa en una tabla antes de guardar.
3. **Alimentos.** Tabla con fuente de cada alimento y formulario para añadir productos propios con los datos de su etiqueta.

## Ajuste del plato

Para los alimentos no fijados se resuelve un sistema lineal: cada alimento del grupo k cubre una parte igual de (objetivo_k − lo que aportan postre, alimentos fijados y alimentos de otros grupos). Si a algún alimento le saldría cantidad negativa, se pone a 0 g y se vuelve a resolver. Los gramos se redondean (de 1 en 1 por debajo de 30 g, de 5 en 5 por encima) y el resumen se calcula con los gramos redondeados.

## Equivalencias

Con el plato vacío, gramos = objetivo del macro × 100 / gramos del macro por 100 g del alimento. Se calcula solo por el macro principal. Legumbres, frutos secos, crema de cacahuete, huevo y queso curado aparecen también en su segundo grupo, marcados. Los gramos se redondean de 1 en 1 por debajo de 30 g y de 5 en 5 por encima.

## Datos

- **Genéricos:** USDA FoodData Central, base SR Legacy (2019). Hidratos = carbohidratos por diferencia (incluye fibra). Carnes y pescados en crudo. El peso cocido sale de la ficha del alimento cocido de la misma base y es aproximado.
- **Productos de supermercado:** tabla nutricional del envase recogida en Open Food Facts. Solo se incluyen productos con foto de la tabla nutricional, marca propia de la cadena y energía coherente con los macros (diferencia < 15 %). Hidratos según etiqueta europea (sin fibra). Cada producto lleva su código de barras y la fecha de la última edición de la ficha. Descartados: `3456775718416` (sin foto de la tabla), `8435177059162` (proteína incoherente), `20573768` (16 g de proteína por 100 g en atún al natural, valor atípico).

Densidad de los líquidos (g/ml), de los pesos de porción de USDA: leche desnatada 1,035 (1 fl oz = 30,6 g), leche entera 1,031 (30,5 g), kéfir 1,027 (1 taza = 243 g), aceite de oliva 0,913 (216 g), aceite de girasol 0,921 (218 g). Los dos lácteos líquidos de marca usan la densidad de la leche desnatada. El vaso de 250 ml es una convención de la app, no un dato de la fuente.

Para regenerar `public/dieta/alimentos.js`:

    python3 tools/dieta/generar_alimentos.py tools/dieta/datos/usda_sr_legacy.json tools/dieta/datos/productos_off.json public/dieta/alimentos.js

## Archivos

- `public/dieta/logic.js`: lector del texto, equivalencias, postres y ajuste fino (probado en `src/dieta/logic.test.js`).
- `public/dieta/alimentos.js`: generado; no editar a mano.
- `public/dieta/app.js`: pantallas.
- `tools/dieta/`: generador y datos de origen.
