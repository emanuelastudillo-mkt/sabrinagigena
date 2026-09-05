# Catálogo conectado a Google Sheets

Esta versión usa como fuente de verdad la pestaña **Propiedades** del archivo:

https://docs.google.com/spreadsheets/d/1Q58K5bHQQWj4rjAZlN9cNZ9LgbY7oj_If36COOmDnsI/edit?gid=779453685

La sincronización se ejecuta automáticamente una vez por día y también puede iniciarse de forma manual desde **GitHub → Actions → Actualizar catálogo e imágenes → Run workflow**.

## Qué actualiza

- data/propiedades.json: copia normalizada y pública del catálogo, sin campos clasificados ni ubicación exacta.
- data/propiedades-no-index.json: historial de propiedades vendidas, pausadas o retiradas.
- index.html: propiedades destacadas de la portada.
- propiedades/index.html: catálogo completo, buscador y filtros en /propiedades/.
- propiedades/NOMBRE-ID/index.html: URL pública estable de cada propiedad.
- propiedades-no-index/NOMBRE-ID/index.html: copia histórica no indexable.
- assets/images/propiedades/: imágenes del catálogo descargadas y optimizadas a WebP.
- assets/images/atencion-integral/: imágenes propias del bloque de atención integral de la portada.
- assets/images/meta/: copias JPEG de las imágenes necesarias para el catálogo de Meta.
- meta-catalog.csv: feed inmobiliario público, actualizado para Meta Commerce Manager.
- sitemap.xml y robots.txt.

## Estados que se publican

Se publican las filas con estado **Disponible** o **Reservada**. Las filas **Vendida** o **Pausada** dejan de aparecer en portada, catálogo y sitemap, pero no se eliminan.

Cuando una propiedad se vende:

- su URL original en /propiedades/NOMBRE-ID/ sigue existiendo;
- la página recibe noindex, destaca que fue vendida y muestra alternativas disponibles;
- se conserva otra copia en /propiedades-no-index/NOMBRE-ID/;
- sus datos e imágenes permanecen disponibles;
- si una fila desaparece del Sheet sin marcarse como vendida, se archiva automáticamente como retirada del catálogo.

Las filas vacías preparadas en el Sheet no se procesan.

## Plantilla única de las fichas

Todas las páginas individuales se generan con la misma estructura y en el mismo orden:

1. galería principal con tres espacios fijos;
2. título, ubicación, descripción breve y precios;
3. trece datos técnicos, incluida la superficie semicubierta;
4. descripción comercial;
5. siete características y servicios, incluida la aptitud para crédito hipotecario;
6. ubicación aproximada;
7. galería de fotos adicionales;
8. tarjeta de contacto.

Si un dato todavía no está cargado, su espacio no desaparece: muestra **A consultar**. Si faltan imágenes, la plantilla conserva los mismos lugares con la leyenda **Próximamente**. La cantidad de fotos puede variar sin cambiar el diseño del resto de la ficha.

## Imágenes

El catálogo usa primero **Imagen principal** y después las columnas **Foto 1** a **Foto 12**:

- **Imagen principal** es siempre la portada de la propiedad y crea `ID-foto-01.webp`.
- **Foto 1** a **Foto 12** aparecen después en ese orden y crean `ID-foto-02.webp` a `ID-foto-13.webp`.
- No se usan letras fijas de columna: al insertar nuevas columnas, el generador localiza las imágenes por sus encabezados.
- Cada columna no vacía genera su propio archivo y conserva su posición. Si falta una foto intermedia, las siguientes no cambian de nombre.
- La relación columna/archivo se mantiene incluso si dos celdas tienen temporalmente el mismo enlace. En ese caso se crearán dos WebP iguales hasta que se carguen enlaces diferentes.
- Cada enlace se descarga y se convierte a WebP conservando la proporción vertical 1080 × 1350.
- Durante esa conversión se incrusta la marca de agua **Sabrina Gigena Inmobiliaria** en la parte inferior de cada WebP.
- La fotografía original de Google Drive no se modifica: la marca solo queda incorporada en la copia optimizada que se publica en GitHub.
- Si cambia el enlace de una columna, se reemplaza su WebP estable.
- Si el enlace se vacía, el WebP anterior se elimina del repositorio en la siguiente sincronización.
- Si se vacía **Imagen principal** o cualquiera de las columnas **Foto**, su WebP anterior se elimina en la siguiente sincronización.

El bloque de portada **Menos vueltas. Más información útil para decidir** utiliza exclusivamente las imágenes guardadas en `assets/images/atencion-integral/`; ya no toma fotografías del catálogo. Cada visita muestra una al azar. Para ampliar la rotación, alcanza con subir más archivos `.webp`, `.jpg`, `.jpeg`, `.png` o `.avif` a esa carpeta: el siguiente workflow los incorpora automáticamente.

El workflow define `SITE_URL` como `https://sabrinagigena.com`. Al ser un dominio propio publicado desde la raíz, el generador crea rutas como `/assets/` y `/propiedades/`, sin el antiguo prefijo `/sabrinagigena/`.

El archivo `CNAME` conserva `sabrinagigena.com` como dominio personalizado de GitHub Pages. Cada sincronización también actualiza canonical, Open Graph, sitemap y robots para utilizar el dominio propio.

## SEO local y franja superior

La versión V22.10 concentra el posicionamiento local en **Capilla del Señor**, **Parque Sakura** y **Exaltación de la Cruz**:

- La franja superior muestra únicamente esas tres zonas y ya no incluye **Consultas por WhatsApp**.
- La portada y el catálogo reciben títulos y descripciones propios, canonical del dominio y etiquetas Open Graph/Twitter coherentes.
- El catálogo incorpora las tres zonas en su título principal y la portada las menciona en contenido visible.
- Los datos estructurados `RealEstateAgent` declaran las tres zonas mediante `areaServed`, tanto en las páginas generales como en cada ficha.
- El generador vuelve a aplicar estos ajustes en cada sincronización para evitar que un workflow posterior restaure el contenido anterior.

## Contenido simplificado de la home

La versión V22.15 evita repetir la misma propuesta en varias secciones:

- el hero utiliza un título y una frase breve propios;
- el listado conserva la etiqueta `Disponibles` pero no muestra el título `Propiedades destacadas`;
- se elimina el bloque redundante de acompañamiento y servicios;
- el enlace del menú a `#servicios` continúa funcionando y apunta al bloque informativo de Sabrina.

La versión V22.16 mantiene un único `H1` en la portada y cambia al azar solamente el nombre visible de la zona entre **Exaltación de la Cruz**, **Parque Sakura** y **Capilla del Señor**. El `<title>`, la descripción, el canonical y los datos estructurados permanecen estables e incluyen las tres zonas para conservar señales SEO consistentes. El bloque final usa imágenes institucionales independientes del catálogo y comunica atención integral, seguimiento personalizado y calidez.

## Ajustes posteriores a la auditoría SEO

La versión V22.17 corrige los hallazgos verificables de la auditoría del 4 de septiembre de 2026:

- acorta los títulos de la portada y el catálogo, manteniendo el contexto geográfico completo en las descripciones, encabezados y datos estructurados;
- asigna un texto alternativo descriptivo a los logos del encabezado y el pie;
- genera descripciones SEO específicas con ubicación, precio y características reales de cada fila;
- cuando falta `Descripción comercial`, construye un texto visible útil únicamente con datos existentes en la hoja;
- identifica cada ficha mediante `RealEstateListing`, la propiedad mediante `House`, `Apartment` o `Place`, y su disponibilidad/precio mediante `Offer`;
- amplía el texto institucional de la portada con las zonas atendidas sin reponer bloques redundantes.

La auditoría no pudo leer el HTML fuente y por eso informó falsos positivos. El sitio ya tenía JSON-LD, `robots.txt`, `sitemap.xml`, carga diferida de imágenes y `rel="noopener noreferrer"`; V22.17 los conserva sin duplicarlos.

## Meta Pixel

La versión V22.11 instala el píxel de Meta con el identificador `1421470373195307`:

- registra el evento estándar `PageView` en la portada, el catálogo y todas las fichas;
- también queda presente en las copias históricas de propiedades vendidas o retiradas;
- incluye la alternativa `noscript` para navegadores sin JavaScript;
- el generador elimina cualquier copia anterior del mismo bloque antes de insertarlo, por lo que el píxel no se duplica al ejecutar nuevamente el workflow.

## Nuevas columnas en Google Sheets

Agregar columnas no rompe la web siempre que cada encabezado sea único. El generador busca los datos por el **nombre del encabezado**, no por la letra de la columna; por eso se pueden insertar o mover columnas sin perder la relación con el catálogo.

No se deben borrar ni renombrar estas columnas base:

- `ID`
- `Estado`
- `Nombre` o `Título`
- `Tipo de propiedad`
- `Localidad`

También deben conservarse exactamente `Imagen principal` y `Foto 1` a `Foto 12` para mantener el orden de las fotografías. No hay que reutilizar un `ID` para otra propiedad ni duplicar nombres de columnas. Si el generador detecta encabezados duplicados, detiene el workflow antes de modificar la web.

Una columna interna o clasificada debe comenzar con `Privado -`, `Interno -` o `No publicar -`. Esas columnas se excluyen automáticamente de los JSON públicos. También continúan protegidas las columnas `Propiedad propia / colega`, `Dirección`, `Link Google Maps` y `Carpeta Google Drive`.

El mejor proceso para solicitar una columna nueva es informar:

1. nombre exacto del encabezado;
2. dos o tres valores de ejemplo;
3. si es pública o privada;
4. en qué lugar debe mostrarse o utilizarse;
5. qué debe ocurrir cuando la celda esté vacía;
6. si existen valores permitidos, por ejemplo `Sí / No` o una lista de estados.

Primero conviene crear el encabezado y completar una sola propiedad de prueba. Después de adaptar y validar el generador se puede completar el resto de las filas.

## Catálogo inmobiliario para Meta

La versión V22.12 genera automáticamente:

    https://sabrinagigena.com/meta-catalog.csv

El archivo utiliza el esquema de inmuebles con `home_listing_id`. Sólo incluye propiedades `Disponible` o `Reservada` que tengan precio público, al menos una imagen sincronizada y ubicación aproximada completa. Las imágenes del feed se convierten a JPEG y se guardan en `assets/images/meta/`.

Para que una propiedad pueda ingresar al feed se deben agregar y completar estas columnas públicas:

- `Código postal`
- `Latitud aproximada`
- `Longitud aproximada`

La versión V22.13 reconoce directamente los encabezados actuales de la hoja: `Código Postal`, `Latitud aproximada` y `Longitud aproximada`. No es necesario moverlos a una letra específica.

La versión V22.14 también normaliza automáticamente coordenadas que Google Sheets exporta con separadores regionales. Por ejemplo, `-34.316.898` se publica correctamente como `-34.316898`. Si hay propiedades públicas pero ninguna puede incorporarse, el workflow falla antes de reemplazar el feed por un CSV vacío.

Las coordenadas deben señalar el centro aproximado del barrio o localidad, nunca la puerta de la propiedad. El feed no utiliza `Dirección` ni `Link Google Maps`. Las instrucciones de conexión se encuentran en `META-CATALOGO.md`.

## Indexación en Google

La versión V22.14 refuerza las señales técnicas para Google Search:

- todas las páginas públicas declaran `index,follow` y permiten vistas previas grandes de imágenes;
- las propiedades vendidas o retiradas declaran `noindex,follow` y permanecen fuera del sitemap;
- portada, catálogo y fichas usan canonical absolutos del dominio `https://sabrinagigena.com`;
- los enlaces internos usan `/` y `/propiedades/`, sin enlazar copias con `/index.html`;
- las fichas con nombres repetidos reciben títulos SEO diferenciados por superficie;
- el JSON-LD incorpora `RealEstateAgent`, `WebSite`, `WebPage`, ubicación aproximada, imagen principal y migas de pan;
- el sitemap sólo contiene URLs públicas y conserva las imágenes sincronizadas.

Después de publicar el ajuste hay que enviar `https://sabrinagigena.com/sitemap.xml` una sola vez en Google Search Console. Google puede tardar en volver a rastrear las URLs; una cobertura previa no desaparece de inmediato.

Cada archivo de Google Drive debe estar compartido como **Cualquier persona con el enlace**. Una URL de carpeta por sí sola no permite una descarga estable en GitHub Actions; por eso el proceso avisa cuando encuentra únicamente **Carpeta Google Drive**.

Las fichas y las tarjetas usan exclusivamente archivos sincronizados dentro de `assets/images/propiedades/`. El bloque institucional de la portada usa `assets/images/atencion-integral/`. Las fotografías antiguas guardadas fuera de esas dos carpetas no se usan como respaldo, por lo que pueden eliminarse sin generar imágenes rotas.

La versión del procesamiento forma parte del registro de cada imagen. Por eso, cuando cambia el diseño de la marca de agua, el siguiente workflow vuelve a procesar también las fotos cuyo enlace no cambió.

## Información pública y privacidad

- Las fichas de portada y del catálogo muestran más datos útiles: descripción breve, superficies, ambientes, dormitorios, baños, cocheras, pileta y expensas cuando corresponda.
- Cuando están cargados ambos importes, se muestran **Precio USD** y **Precio ARS**. **Moneda principal** define cuál aparece primero.
- La columna **Propiedad propia / colega** es información clasificada: no se imprime en el HTML ni se guarda en los JSON públicos.
- La dirección y el enlace exacto de Google Maps tampoco se publican.
- Cada ficha genera un mapa de zona usando solamente **Barrio / Zona** y **Localidad**, acompañado por una aclaración de que la ubicación es aproximada.
- `Superficie semicubierta(m²)` aparece como dato técnico fijo en todas las fichas y como dato resumido en las tarjetas cuando tiene valor.
- `Apta para Crédito Hipotecario` aparece con `Sí`, `No` o `A consultar` en todas las fichas. Cuando el valor es `Sí`, también se destaca en las tarjetas y se incorpora a la búsqueda del catálogo.

## ¿Hace falta Apps Script en Google Sheets?

No. El Sheet ya puede funcionar como fuente de datos sin instalar ningún script:

1. GitHub Actions lee el CSV público.
2. El generador actualiza catálogo, páginas, imágenes y archivo histórico.
3. GitHub publica los cambios.

Apps Script solo sería necesario si más adelante se quisiera disparar una actualización instantánea al editar una celda, recorrer automáticamente carpetas completas de Drive o usar permisos privados. Para la actualización programada una vez por día no hace falta.

## Ejecución local

Requiere Node.js 24:

    npm install --no-save --no-package-lock sharp@0.34.3
    node scripts/actualizar-catalogo.mjs

Para probar con un CSV local sin conectarse a Google:

    PROPERTIES_CSV_FILE=/ruta/propiedades.csv node scripts/actualizar-catalogo.mjs

En PowerShell:

    $env:PROPERTIES_CSV_FILE = "C:\ruta\propiedades.csv"
    node scripts/actualizar-catalogo.mjs

Si Google Sheets deja de estar disponible públicamente o cambia su estructura, el script termina con error antes de reemplazar el catálogo existente.

## Mercado Libre y agenda de reuniones

Desde la versión V22.18 se integran dos accesos externos permanentes:

- **Mercado Libre:** aparece en el menú principal y en el pie de página. El perfil también se incorpora al dato estructurado `sameAs` del negocio.
- **Agendar una reunión:** aparece como acción destacada del encabezado, en el bloque institucional de la portada, en cada ficha de propiedad y en el pie de página.

Los dos enlaces se abren en una pestaña nueva con `noopener noreferrer`. WhatsApp continúa disponible en la portada, las fichas, el botón flotante y el pie de página.

## Redirección de URL antigua

Desde la versión V22.19, la ruta antigua `/sabrinagigena-inmobiliaria-propiedades/` conserva un `index.html` mínimo que redirige inmediatamente a la portada. La página incluye `noindex,follow` y una URL canónica hacia `https://sabrinagigena.com/`, por lo que no compite con la home en los resultados de búsqueda.
