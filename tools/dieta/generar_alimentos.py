"""Genera public/dieta/alimentos.js a partir de:
- sr_all.json: macros de USDA FoodData Central SR Legacy (descargados de api.nal.usda.gov, foods/list).
- products.json: productos de supermercado verificados en Open Food Facts (con foto de la tabla nutricional).
Uso: python3 generar_alimentos.py <sr_all.json> <products.json> <salida.js>
"""
import json, sys, datetime

sr = {f['id']: f for f in json.load(open(sys.argv[1]))}
off = json.load(open(sys.argv[2]))


def u(fdc):
    f = sr[fdc]
    return {'hc': round(f['hc'] or 0, 2), 'p': round(f['p'] or 0, 2), 'g': round(f['g'] or 0, 2), 'fdc': fdc}


# id, nombre, grupo, [también], fdc crudo/seco, fdc cocido, medida (nombre, g, fdc de la medida), nota de estado
GENERICOS = [
    # Hidratos: cereales
    ('arroz', 'Arroz blanco', 'hc', None, 168877, 168878, None, 'seco'),
    ('arroz-integral', 'Arroz integral', 'hc', None, 169703, 169704, None, 'seco'),
    ('pasta', 'Pasta', 'hc', None, 169736, 169737, None, 'seca'),
    ('pasta-integral', 'Pasta integral', 'hc', None, 169738, 168910, None, 'seca'),
    ('cuscus', 'Cuscús', 'hc', None, 169699, 169700, None, 'seco'),
    ('quinoa', 'Quinoa', 'hc', None, 168874, 168917, None, 'cruda'),
    ('bulgur', 'Bulgur', 'hc', None, 170688, 170287, None, 'seco'),
    ('avena', 'Copos de avena', 'hc', None, 173904, None, None, ''),
    ('harina-avena', 'Harina de avena', 'hc', None, 169741, None, None, ''),
    ('crema-arroz', 'Crema de arroz', 'hc', None, 173900, None, None, 'en polvo'),
    ('corn-flakes', 'Copos de maíz (corn flakes)', 'hc', None, 174648, None, None, ''),
    ('pan-barra', 'Pan de barra', 'hc', None, 172675, None, None, ''),
    ('pan-integral', 'Pan integral', 'hc', None, 172688, None, ('rebanada', 32), ''),
    ('pan-molde', 'Pan de molde blanco', 'hc', None, 174924, None, ('rebanada', 25), ''),
    ('biscotes', 'Biscotes', 'hc', None, 174977, None, None, ''),
    ('tortitas-arroz', 'Tortitas de arroz', 'hc', None, 170250, None, ('tortita', 9), ''),
    ('tortitas-maiz', 'Tortitas de maíz', 'hc', None, 168857, None, ('tortita', 9), ''),
    ('tortilla-trigo', 'Tortilla de trigo (wrap)', 'hc', None, 167535, None, ('tortilla', 49), ''),
    # Hidratos: tubérculos y legumbres
    ('patata', 'Patata', 'hc', None, 170026, 170440, None, 'cruda'),
    ('boniato', 'Boniato', 'hc', None, 168482, 168483, None, 'crudo'),
    ('lentejas', 'Lentejas', 'hc', 'p', 172420, 172421, None, 'secas'),
    ('garbanzos', 'Garbanzos', 'hc', 'p', 173756, 173757, None, 'secos'),
    ('alubias', 'Alubias blancas', 'hc', 'p', 175202, 175203, None, 'secas'),
    ('guisantes', 'Guisantes', 'hc', None, 170419, None, None, 'crudos'),
    ('maiz-dulce', 'Maíz dulce', 'hc', None, 169998, None, None, 'crudo'),
    # Hidratos: fruta
    ('platano', 'Plátano', 'hc', None, 173944, None, ('plátano mediano', 118), 'pelado'),
    ('manzana', 'Manzana', 'hc', None, 171688, None, ('manzana mediana', 182), 'con piel'),
    ('pera', 'Pera', 'hc', None, 169118, None, None, ''),
    ('naranja', 'Naranja', 'hc', None, 169097, None, ('naranja', 131), 'pelada'),
    ('mandarina', 'Mandarina', 'hc', None, 169105, None, ('mandarina mediana', 88), 'pelada'),
    ('uva', 'Uva', 'hc', None, 174683, None, None, ''),
    ('kiwi', 'Kiwi', 'hc', None, 168153, None, ('kiwi', 69), 'pelado'),
    ('fresas', 'Fresas', 'hc', None, 167762, None, None, ''),
    ('arandanos', 'Arándanos', 'hc', None, 171711, None, None, ''),
    ('mango', 'Mango', 'hc', None, 169910, None, None, 'pelado'),
    ('pina', 'Piña', 'hc', None, 169124, None, None, 'pelada'),
    ('melocoton', 'Melocotón', 'hc', None, 169928, None, None, ''),
    ('melon', 'Melón cantalupo', 'hc', None, 169092, None, None, 'pelado'),
    ('sandia', 'Sandía', 'hc', None, 167765, None, None, 'pelada'),
    ('datiles', 'Dátiles medjool', 'hc', None, 168191, None, ('dátil sin hueso', 24), ''),
    ('pasas', 'Pasas', 'hc', None, 168165, None, None, ''),
    ('miel', 'Miel', 'hc', None, 169640, None, ('cucharada', 21), ''),
    # Proteína
    ('pollo', 'Pechuga de pollo', 'p', None, 171077, None, None, 'cruda'),
    ('contramuslo', 'Contramuslo de pollo', 'p', None, 173627, None, None, 'crudo, sin piel'),
    ('pavo', 'Pechuga de pavo', 'p', None, 171098, None, None, 'cruda'),
    ('ternera', 'Ternera magra (redondo)', 'p', None, 171761, None, None, 'cruda'),
    ('picada', 'Carne picada de vacuno 5 %', 'p', None, 171790, None, None, 'cruda'),
    ('solomillo-cerdo', 'Solomillo de cerdo', 'p', None, 168249, None, None, 'crudo'),
    ('lomo-cerdo', 'Lomo de cerdo', 'p', None, 168263, None, None, 'crudo'),
    ('conejo', 'Conejo', 'p', None, 172521, None, None, 'crudo'),
    ('bacalao', 'Bacalao fresco', 'p', None, 171955, None, None, 'crudo'),
    ('lubina', 'Lubina', 'p', None, 175142, None, None, 'cruda'),
    ('rape', 'Rape', 'p', None, 173676, None, None, 'crudo'),
    ('salmon', 'Salmón', 'p', None, 175167, None, None, 'crudo'),
    ('atun-fresco', 'Atún fresco', 'p', None, 175159, None, None, 'crudo'),
    ('caballa', 'Caballa', 'p', None, 175119, None, None, 'cruda'),
    ('sardinas-lata', 'Sardinas en aceite (lata)', 'p', None, 175139, None, None, 'escurridas'),
    ('atun-natural', 'Atún al natural (lata)', 'p', None, 171986, None, None, 'escurrido'),
    ('atun-aceite', 'Atún en aceite (lata)', 'p', None, 173708, None, None, 'escurrido'),
    ('gambas', 'Gambas o langostinos', 'p', None, 175179, None, None, 'crudos, pelados'),
    ('calamar', 'Calamar', 'p', None, 174223, None, None, 'crudo'),
    ('sepia', 'Sepia', 'p', None, 174215, None, None, 'cruda'),
    ('pulpo', 'Pulpo', 'p', None, 174218, None, None, 'crudo'),
    ('mejillones', 'Mejillones', 'p', None, 174216, None, None, 'crudos, sin concha'),
    ('huevo', 'Huevo entero', 'p', 'g', 171287, None, ('huevo L', 50), 'sin cáscara'),
    ('claras', 'Claras de huevo', 'p', None, 172183, None, ('clara de huevo L', 33), ''),
    ('yogur-griego-0', 'Yogur griego 0 %', 'p', None, 170894, None, None, ''),
    ('cottage', 'Queso cottage 1 %', 'p', None, 173417, None, None, ''),
    ('leche-desnatada', 'Leche desnatada', 'p', None, 171269, None, None, ''),
    ('tofu', 'Tofu firme', 'p', None, 172475, None, None, ''),
    ('tempeh', 'Tempeh', 'p', None, 174272, None, None, ''),
    ('whey', 'Proteína whey en polvo', 'p', None, 173180, None, None, 'genérica'),
    # Grasa
    ('aceite', 'Aceite de oliva', 'g', None, 171413, None, ('cucharada', 13.5), ''),
    ('aceite-girasol', 'Aceite de girasol', 'g', None, 171025, None, None, ''),
    ('mantequilla', 'Mantequilla', 'g', None, 173430, None, ('cucharada', 14.2), ''),
    ('tahini', 'Tahini', 'g', None, 170189, None, None, ''),
    ('aguacate', 'Aguacate', 'g', None, 171705, None, ('aguacate entero', 201), 'sin piel ni hueso'),
    ('aceitunas', 'Aceitunas negras', 'g', None, 169094, None, None, ''),
    ('almendras', 'Almendras', 'g', 'p', 170567, None, None, ''),
    ('nueces', 'Nueces', 'g', 'p', 170187, None, None, ''),
    ('avellanas', 'Avellanas', 'g', 'p', 170581, None, None, ''),
    ('anacardos', 'Anacardos', 'g', 'p', 170162, None, None, ''),
    ('pistachos', 'Pistachos', 'g', 'p', 170184, None, None, 'pelados'),
    ('cacahuetes', 'Cacahuetes', 'g', 'p', 172430, None, None, ''),
    ('crema-cacahuete', 'Crema de cacahuete', 'g', 'p', 172470, None, ('cucharada', 16), ''),
    ('chia', 'Semillas de chía', 'g', None, 170554, None, None, ''),
    ('lino', 'Semillas de lino', 'g', None, 169414, None, None, ''),
    ('pipas-calabaza', 'Pipas de calabaza', 'g', 'p', 170556, None, None, 'peladas'),
    ('chocolate-85', 'Chocolate negro 70-85 %', 'g', None, 170273, None, None, ''),
    ('queso-curado', 'Queso curado tipo parmesano', 'g', 'p', 170848, None, None, ''),
    ('coco', 'Coco rallado', 'g', None, 170170, None, None, 'sin azúcar'),
]

# Postres genéricos (se miden en gramos)
POSTRES_GENERICOS = [
    ('yogur-natural', 'Yogur natural', 171284, ('yogur', 125)),
    ('yogur-desnatado', 'Yogur natural desnatado', 170887, ('yogur', 125)),
    ('yogur-griego-0-postre', 'Yogur griego 0 %', 170894, None),
    ('kefir', 'Kéfir bajo en grasa', 170904, None),
    ('gelatina-0', 'Gelatina sin azúcar (preparada)', 169598, None),
    ('compota', 'Compota de manzana sin azúcar', 171695, None),
]

# Productos verificados: código, cadena, grupo, también, unidad (nombre, g), postre, nombre corto
PRODUCTOS = [
    # Mercadona (Hacendado)
    ('8480000209085', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas natural'),
    ('8480000210616', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas chocolate'),
    ('8480000223111', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas natillas vainilla'),
    ('8480000209962', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas fresa'),
    ('8480000211514', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas mango y maracuyá'),
    ('8480000223128', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas limón'),
    ('8402001010484', 'mercadona', 'p', None, ('envase', 125), True, '+Proteínas stracciatella'),
    ('8480000609564', 'mercadona', 'p', None, ('envase', 120), True, '+Proteínas pudding caramelo'),
    ('8480000676351', 'mercadona', 'p', None, ('flan', 100), True, '+Proteínas flan de huevo'),
    ('8480000158024', 'mercadona', 'p', None, None, True, '+Proteínas mousse chocolate'),
    ('8480000682741', 'mercadona', 'p', None, ('envase', 100), True, '+Proteínas gelatina frutos rojos'),
    ('8480000510716', 'mercadona', 'p', None, None, True, 'Queso fresco batido desnatado'),
    ('8402001012051', 'mercadona', 'p', None, ('yogur', 125), True, 'Yogur griego ligero'),
    ('8480000202109', 'mercadona', 'p', None, ('yogur', 125), True, 'Yogur natural 0 %'),
    ('8480000682659', 'mercadona', 'hc', None, ('flan', 100), True, 'Flan de huevo sin azúcares'),
    ('8480000681379', 'mercadona', 'hc', None, ('natillas', 125), True, 'Natillas de vainilla'),
    ('8480000180186', 'mercadona', 'p', None, None, False, 'Atún claro al natural'),
    ('8480000679727', 'mercadona', 'p', None, None, False, 'Pechuga de pavo finas lonchas'),
    ('8480000561565', 'mercadona', 'p', None, None, False, 'Pechuga de pollo finas lonchas'),
    ('8480000592569', 'mercadona', 'p', None, None, False, 'Jamón cocido'),
    ('8480000566614', 'mercadona', 'p', None, None, False, 'Tiras de pollo al natural'),
    ('8480000621283', 'mercadona', 'p', None, None, False, 'Filetes de merluza del Cabo'),
    ('8480000829719', 'mercadona', 'p', None, None, False, 'Langostino cocido'),
    ('8480000230058', 'mercadona', 'p', None, None, False, 'Seitán'),
    ('8480000383150', 'mercadona', 'p', None, None, False, 'Tofu firme'),
    ('8480000609632', 'mercadona', 'p', None, None, False, 'Queso fresco cottage'),
    ('8480000510747', 'mercadona', 'p', None, ('tarrina', 62.5), False, 'Queso fresco de Burgos 0 %'),
    ('8480000106780', 'mercadona', 'p', None, ('vaso', 250), False, 'Leche desnatada +Proteínas'),
    ('8480000140135', 'mercadona', 'hc', None, None, False, 'Tortitas de arroz'),
    ('8480000141583', 'mercadona', 'hc', None, None, False, 'Tortitas de maíz'),
    ('8480000808707', 'mercadona', 'hc', None, ('tortilla', 60), False, 'Maxi tortillas de trigo'),
    ('8480000809421', 'mercadona', 'hc', None, ('tortilla', 36), False, 'Tortillas de trigo integrales'),
    ('8480000823229', 'mercadona', 'hc', None, None, False, 'Pan de molde blanco sin corteza'),
    ('8480000826466', 'mercadona', 'hc', None, None, False, 'Pan de molde espelta integral'),
    ('8480000860088', 'mercadona', 'hc', None, None, False, 'Pan tostado 100 % integral'),
    ('8480000094308', 'mercadona', 'hc', None, None, False, 'Quinoa'),
    ('8480000094919', 'mercadona', 'hc', None, None, False, 'Muesli de frutas'),
    ('8480000671400', 'mercadona', 'g', 'p', None, False, 'Crema de cacahuete'),
    ('8480000348654', 'mercadona', 'g', 'p', None, False, 'Almendra natural'),
    ('8480000340245', 'mercadona', 'g', 'p', None, False, 'Nuez natural pelada'),
    ('8480000233653', 'mercadona', 'g', 'p', None, False, 'Anacardo natural'),
    ('8480000861900', 'mercadona', 'g', 'p', None, False, 'Pistacho tostado 0 % sal'),
    # Ahorramas (Alipende)
    ('8421691512894', 'ahorramas', 'p', None, None, False, 'Atún claro al natural'),
    ('8421691843547', 'ahorramas', 'p', None, None, False, 'Filetes de merluza sin piel'),
    ('8421691484030', 'ahorramas', 'p', None, None, False, 'Pechuga de pavo finas lonchas'),
    ('8421691707368', 'ahorramas', 'p', None, None, False, 'Jamón cocido'),
    ('8421691604247', 'ahorramas', 'p', None, None, False, 'Jamón cocido extra'),
    ('8421691836020', 'ahorramas', 'p', None, None, False, 'Mejillones al natural'),
    ('8421691768550', 'ahorramas', 'p', None, None, True, 'Queso blanco 0 %'),
    ('8421691694354', 'ahorramas', 'p', None, None, True, 'Yogur natural 0 %'),
    ('8421691846265', 'ahorramas', 'hc', None, ('yogur', 125), True, 'Yogur griego'),
    ('8421691813281', 'ahorramas', 'hc', None, None, False, 'Tortitas de arroz'),
    ('8421691813267', 'ahorramas', 'hc', None, ('tortita', 7.5), False, 'Tortitas de maíz'),
    ('8421691846708', 'ahorramas', 'hc', None, None, False, 'Arroz basmati'),
    ('8421691277892', 'ahorramas', 'hc', None, None, False, 'Pan de molde'),
    ('8421691504165', 'ahorramas', 'hc', None, None, False, 'Pan de molde 100 % integral'),
    ('8421691752054', 'ahorramas', 'hc', None, None, False, 'Pan tostado integral'),
    ('8421691741348', 'ahorramas', 'hc', None, None, False, 'Copos de avena integral'),
    ('8421691693111', 'ahorramas', 'hc', 'p', None, False, 'Lentejas cocidas (bote)'),
    ('8421691786394', 'ahorramas', 'hc', 'p', None, False, 'Garbanzos cocidos (bote)'),
    ('8421691525764', 'ahorramas', 'g', 'p', None, False, 'Crema 100 % cacahuete'),
    ('8421691661400', 'ahorramas', 'g', 'p', None, False, 'Nueces peladas'),
    ('8421691851306', 'ahorramas', 'g', 'p', None, False, 'Cacahuete frito con sal'),
    # Alcampo (Auchan)
    ('8429583011241', 'alcampo', 'p', None, ('lata', 56), False, 'Atún al natural'),
    ('8429583006469', 'alcampo', 'p', None, ('lata', 56), False, 'Atún claro al natural'),
    ('8411477902476', 'alcampo', 'p', None, None, False, 'Pechuga de pavo'),
    ('8427546072742', 'alcampo', 'p', None, None, False, 'Jamón serrano'),
    ('8432022001710', 'alcampo', 'p', None, None, False, 'Queso fresco cottage'),
    ('8432022001574', 'alcampo', 'p', None, None, True, 'Queso fresco batido'),
    ('8432022001741', 'alcampo', 'p', None, None, False, 'Queso madurado en lonchas Protein+'),
    ('8410285190273', 'alcampo', 'p', None, None, False, 'Queso fresco 0 %'),
    ('8432022001697', 'alcampo', 'p', None, ('envase', 150), True, 'Skyr natural'),
    ('8432022001703', 'alcampo', 'p', None, ('envase', 150), True, 'Skyr con fresa'),
    ('8432022001734', 'alcampo', 'p', None, ('botella', 350), True, 'Batido de vainilla Protein+'),
    ('8410324161103', 'alcampo', 'hc', None, None, False, 'Arroz integral'),
    ('8423519007032', 'alcampo', 'hc', None, None, False, 'Pan de molde 100 % integral'),
    ('8423519076038', 'alcampo', 'hc', None, None, False, 'Pan de molde integral sin corteza'),
    ('8423519075031', 'alcampo', 'hc', None, None, False, 'Pan de molde sin corteza'),
    ('8422424700038', 'alcampo', 'hc', None, None, False, 'Tortillas de trigo integrales'),
    ('8422424100074', 'alcampo', 'hc', None, ('tortilla', 40), False, 'Tortillas de trigo'),
    ('3596710323210', 'alcampo', 'hc', None, ('tortita', 7), False, 'Tortitas de maíz bio'),
    ('8437019616076', 'alcampo', 'hc', None, None, False, 'Corn flakes'),
    ('3596710446599', 'alcampo', 'hc', None, None, False, 'Muesli crujiente frutos rojos'),
    ('8423266010705', 'alcampo', 'g', 'p', None, False, 'Crema de cacahuete'),
    # Lidl (Milbona, Nixe, Realvalle, Crownfield, Alesto)
    ('4056489724070', 'lidl', 'p', None, ('envase', 175), True, 'High Protein mousse chocolate'),
    ('4056489654926', 'lidl', 'p', None, ('envase', 200), True, 'High Protein pudding coco'),
    ('4056489216155', 'lidl', 'p', None, ('envase', 200), True, 'High Protein pudding vainilla'),
    ('4056489216162', 'lidl', 'p', None, ('envase', 200), True, 'High Protein pudding chocolate'),
    ('4056489382720', 'lidl', 'p', None, ('envase', 170), True, 'High Protein yogur con fruta'),
    ('20987442', 'lidl', 'p', None, ('envase', 180), True, 'High Protein quark natural'),
    ('20987435', 'lidl', 'p', None, ('envase', 180), True, 'Queso batido melocotón y maracuyá'),
    ('20692230', 'lidl', 'p', None, ('envase', 150), True, 'Skyr natural'),
    ('4056489450085', 'lidl', 'p', None, None, True, 'Skyr bio vainilla'),
    ('4056489518273', 'lidl', 'p', None, None, True, 'Yogur estilo griego 0 %'),
    ('20248321', 'lidl', 'p', None, ('yogur', 125), True, 'Yogur natural'),
    ('20337223', 'lidl', 'p', None, None, True, 'Queso fresco batido'),
    ('4056489187813', 'lidl', 'p', None, None, False, 'Queso cottage bio'),
    ('20131968', 'lidl', 'p', None, None, False, 'Requesón tipo cottage light'),
    ('40889023', 'lidl', 'p', None, ('tarrina', 62.5), False, 'Queso fresco de Burgos'),
    ('4056489143970', 'lidl', 'p', None, None, False, 'Atún claro al natural'),
    ('20125332', 'lidl', 'p', None, None, False, 'Jamón cocido'),
    ('4056489256212', 'lidl', 'p', None, None, False, 'Pechuga de pavo finas lonchas'),
    ('20125325', 'lidl', 'p', None, None, False, 'Pechuga de pavo baja en grasa'),
    ('20657352', 'lidl', 'p', None, None, False, 'Jamón serrano reserva'),
    ('20878399', 'lidl', 'p', None, None, False, 'Mejillones al natural'),
    ('4056489871880', 'lidl', 'hc', None, None, False, 'Copos de avena'),
    ('14595271', 'lidl', 'hc', None, None, False, 'Corn flakes'),
    ('4056489287513', 'lidl', 'hc', None, ('rebanada', 30), False, 'Pan integral sin azúcares añadidos'),
    ('4056489515951', 'lidl', 'hc', None, None, False, 'Muesli de frutas integral'),
    ('20764074', 'lidl', 'g', 'p', None, False, 'Almendra natural'),
    ('20188023', 'lidl', 'g', 'p', None, False, 'Cacahuete tostado sin sal'),
    ('4056489168690', 'lidl', 'g', 'p', None, False, 'Nuez natural'),
]


def num(x):
    return round(float(x), 2)


out = []
for id_, nombre, grupo, tambien, fdc, fdc_c, medida, estado in GENERICOS:
    a = {'id': id_, 'nombre': nombre, 'grupo': grupo, **u(fdc)}
    if tambien:
        a['tambien'] = tambien
    if estado:
        a['estado'] = estado
    if fdc_c:
        a['cocido'] = u(fdc_c)
    if medida:
        a['medida'] = {'nombre': medida[0], 'g': medida[1]}
    out.append(a)
for id_, nombre, fdc, medida in POSTRES_GENERICOS:
    a = {'id': id_, 'nombre': nombre, 'grupo': 'postre', 'postre': True, **u(fdc)}
    if medida:
        a['medida'] = {'nombre': medida[0], 'g': medida[1]}
    out.append(a)
vistos = set()
for code, cadena, grupo, tambien, unidad, postre, nombre in PRODUCTOS:
    assert code not in vistos, code
    vistos.add(code)
    r = off[code]
    assert not r.get('excluded') and r.get('img'), code
    fecha = datetime.datetime.fromtimestamp(r['t'], datetime.timezone.utc).strftime('%Y-%m') if r.get('t') else None
    a = {'id': 'off-' + code, 'nombre': nombre, 'grupo': grupo, 'cadena': cadena, 'hc': num(r['hc']), 'p': num(r['p']), 'g': num(r['g']), 'off': code}
    if fecha:
        a['fecha'] = fecha
    if tambien:
        a['tambien'] = tambien
    if postre:
        a['postre'] = True
    if unidad:
        a['medida'] = {'nombre': unidad[0], 'g': unidad[1]}
    out.append(a)

cabecera = '''// Archivo generado por tools/dieta/generar_alimentos.py; no editar a mano.
// Valores por 100 g de porción comestible.
// - Alimentos con "fdc": USDA FoodData Central, SR Legacy (2019). Hidratos = carbohidratos por diferencia (incluye fibra).
//   Ficha: https://fdc.nal.usda.gov/food-details/<fdc>/nutrients
// - Alimentos con "off": tabla nutricional del envase recogida en Open Food Facts, contrastada con su foto.
//   Hidratos según etiqueta europea (sin fibra). Ficha: https://world.openfoodfacts.org/product/<off>
// grupo: hc | p | g | postre. tambien: segundo grupo en el que aparece. cocido: valores del alimento cocido.
// medida: peso de una medida casera o de una unidad del envase según la fuente.
'''
with open(sys.argv[3], 'w') as f:
    f.write(cabecera)
    f.write('export const ALIMENTOS = [\n')
    for a in out:
        f.write('  ' + json.dumps(a, ensure_ascii=False, separators=(', ', ': ')) + ',\n')
    f.write(']\n')
print(len(out), 'alimentos;', sum(1 for a in out if 'off' in a), 'productos')
