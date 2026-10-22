# Mi dieta (app de macros)

App web instalable en `public/dieta/`. Se publica con el resto del proyecto en GitHub Pages, en la ruta `/dieta/`. No necesita compilación: HTML y JavaScript sin dependencias.

## Qué hace

1. Cargar dieta: se pega el texto con los macros (hidratos, proteína, grasa) de desayuno, comida, merienda y cena. El lector acepta «HC 60, P 30, G 15», «60 g de hidratos», una línea por macro o tres números en orden HC/P/G. Los valores se revisan en una tabla editable antes de guardar.
2. Comidas: para cada comida se elige un alimento de hidratos, uno de proteína y uno de grasa. La app calcula los gramos de los tres para cuadrar los macros de esa comida y muestra la diferencia con el objetivo.
3. Opciones: cada alimento de la lista muestra los gramos que harían falta si sustituyera al elegido, manteniendo los otros dos.
4. Alimentos: tabla de composición por 100 g y formulario para añadir productos propios con los datos de su etiqueta.

## Cálculo

Mínimos cuadrados no negativos sobre los tres macros, con el error ponderado en kcal (4/4/9). Si un alimento aporta más de un macro de lo pedido (salmón y grasa, por ejemplo), el alimento de ese grupo queda a 0 g y la app avisa de la diferencia. Los gramos se redondean de 1 en 1 por debajo de 30 g y de 5 en 5 por encima.

## Datos

USDA FoodData Central, base SR Legacy (2019). Cada alimento lleva su identificador FDC en `public/dieta/alimentos.js`. Pesos en crudo salvo indicación; los hidratos son carbohidratos por diferencia e incluyen la fibra.

## Archivos

- `public/dieta/logic.js`: lector del texto y cálculo de gramos (probado en `src/dieta/logic.test.js`).
- `public/dieta/alimentos.js`: tabla de alimentos y combinación inicial por comida.
- `public/dieta/app.js`: pantallas; los datos se guardan en `localStorage` del dispositivo.
