// Composición por 100 g de porción comestible. Fuente: USDA FoodData Central, SR Legacy (abril 2019).
// hc = carbohidratos por diferencia (incluye fibra), p = proteína, g = grasa total.
// fdc = identificador del alimento: https://fdc.nal.usda.gov/food-details/<fdc>/nutrients
export const ALIMENTOS = [
  // Hidratos de carbono
  { id: 'arroz', nombre: 'Arroz blanco', estado: 'crudo', grupo: 'hc', hc: 80.0, p: 7.13, g: 0.66, fdc: 169756 },
  { id: 'pasta', nombre: 'Pasta', estado: 'cruda', grupo: 'hc', hc: 74.7, p: 13.0, g: 1.51, fdc: 169736 },
  { id: 'avena', nombre: 'Copos de avena', estado: 'secos', grupo: 'hc', hc: 67.7, p: 13.2, g: 6.52, fdc: 173904 },
  { id: 'pan', nombre: 'Pan blanco', estado: '', grupo: 'hc', hc: 49.4, p: 8.85, g: 3.33, fdc: 174924 },
  { id: 'pan-integral', nombre: 'Pan integral', estado: '', grupo: 'hc', hc: 42.7, p: 12.4, g: 3.5, fdc: 172688 },
  { id: 'patata', nombre: 'Patata', estado: 'cruda', grupo: 'hc', hc: 17.5, p: 2.05, g: 0.09, fdc: 170026 },
  { id: 'boniato', nombre: 'Boniato', estado: 'crudo', grupo: 'hc', hc: 20.1, p: 1.57, g: 0.05, fdc: 168482 },
  { id: 'platano', nombre: 'Plátano', estado: 'pelado', grupo: 'hc', hc: 22.8, p: 1.09, g: 0.33, fdc: 173944 },
  { id: 'tortitas', nombre: 'Tortitas de arroz', estado: '', grupo: 'hc', hc: 81.5, p: 8.2, g: 2.8, fdc: 170250 },
  { id: 'quinoa', nombre: 'Quinoa', estado: 'cruda', grupo: 'hc', hc: 64.2, p: 14.1, g: 6.07, fdc: 168874 },
  { id: 'cuscus', nombre: 'Cuscús', estado: 'crudo', grupo: 'hc', hc: 77.4, p: 12.8, g: 0.64, fdc: 169699 },
  { id: 'lentejas', nombre: 'Lentejas', estado: 'crudas', grupo: 'hc', hc: 63.4, p: 24.6, g: 1.06, fdc: 172420 },
  { id: 'garbanzos', nombre: 'Garbanzos', estado: 'crudos', grupo: 'hc', hc: 63.0, p: 20.5, g: 6.04, fdc: 173756 },
  // Proteína
  { id: 'pollo', nombre: 'Pechuga de pollo', estado: 'cruda', grupo: 'p', hc: 0, p: 22.5, g: 2.62, fdc: 171077 },
  { id: 'pavo', nombre: 'Pechuga de pavo', estado: 'cruda', grupo: 'p', hc: 0.14, p: 23.7, g: 1.48, fdc: 171098 },
  { id: 'ternera', nombre: 'Ternera magra (redondo)', estado: 'cruda', grupo: 'p', hc: 0, p: 23.4, g: 2.52, fdc: 171761 },
  { id: 'cerdo', nombre: 'Solomillo de cerdo', estado: 'crudo', grupo: 'p', hc: 0, p: 21.0, g: 2.17, fdc: 168249 },
  { id: 'bacalao', nombre: 'Bacalao fresco', estado: 'crudo', grupo: 'p', hc: 0, p: 17.8, g: 0.67, fdc: 171955 },
  { id: 'salmon', nombre: 'Salmón', estado: 'crudo', grupo: 'p', hc: 0, p: 20.4, g: 13.4, fdc: 175167 },
  { id: 'atun', nombre: 'Atún al natural', estado: 'escurrido', grupo: 'p', hc: 0, p: 25.5, g: 0.82, fdc: 171986 },
  { id: 'huevo', nombre: 'Huevo entero', estado: 'sin cáscara', grupo: 'p', hc: 0.72, p: 12.6, g: 9.51, fdc: 171287 },
  { id: 'claras', nombre: 'Claras de huevo', estado: '', grupo: 'p', hc: 0.73, p: 10.9, g: 0.17, fdc: 172183 },
  { id: 'yogur-griego', nombre: 'Yogur griego 0 %', estado: '', grupo: 'p', hc: 3.6, p: 10.2, g: 0.39, fdc: 170894 },
  { id: 'cottage', nombre: 'Queso cottage 1 %', estado: '', grupo: 'p', hc: 2.72, p: 12.4, g: 1.02, fdc: 173417 },
  // Grasa
  { id: 'aceite', nombre: 'Aceite de oliva', estado: '', grupo: 'g', hc: 0, p: 0, g: 100, fdc: 171413 },
  { id: 'aguacate', nombre: 'Aguacate', estado: '', grupo: 'g', hc: 8.53, p: 2.0, g: 14.7, fdc: 171705 },
  { id: 'almendras', nombre: 'Almendras', estado: '', grupo: 'g', hc: 21.6, p: 21.2, g: 49.9, fdc: 170567 },
  { id: 'nueces', nombre: 'Nueces', estado: '', grupo: 'g', hc: 13.7, p: 15.2, g: 65.2, fdc: 170187 },
  { id: 'cacahuete', nombre: 'Crema de cacahuete', estado: '', grupo: 'g', hc: 22.3, p: 22.2, g: 51.4, fdc: 172470 },
  { id: 'aceitunas', nombre: 'Aceitunas negras', estado: '', grupo: 'g', hc: 6.04, p: 0.84, g: 10.9, fdc: 169094 },
]

// Combinación inicial de cada comida; se cambia tocando otro alimento.
export const POR_DEFECTO = {
  desayuno: { hc: 'avena', p: 'claras', g: 'cacahuete' },
  comida: { hc: 'arroz', p: 'pollo', g: 'aceite' },
  merienda: { hc: 'tortitas', p: 'yogur-griego', g: 'nueces' },
  cena: { hc: 'patata', p: 'bacalao', g: 'aceite' },
}
