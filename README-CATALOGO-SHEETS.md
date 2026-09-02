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
- assets/images/propiedades/: imágenes descargadas y optimizadas a WebP.
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
3. doce datos técnicos;
4. descripción comercial;
5. seis características y servicios;
6. ubicación aproximada;
7. galería de fotos adicionales;
8. tarjeta de contacto.

Si un dato todavía no está cargado, su espacio no desaparece: muestra **A consultar**. Si faltan imágenes, la plantilla conserva los mismos lugares con la leyenda **Próximamente**. La cantidad de fotos puede variar sin cambiar el diseño del resto de la ficha.

## Imágenes

El catálogo usa primero **Imagen principal** y después las columnas **Foto 1** a **Foto 10**:

- **Imagen principal**, ubicada en la columna Q, es siempre la portada de la propiedad y crea `ID-foto-01.webp`.
- **Foto 1** a **Foto 10**, ubicadas de AM a AV, aparecen después en ese orden y crean `ID-foto-02.webp` a `ID-foto-11.webp`.
- Cada columna no vacía genera su propio archivo y conserva su posición. Si falta una foto intermedia, las siguientes no cambian de nombre.
- La relación columna/archivo se mantiene incluso si dos celdas tienen temporalmente el mismo enlace. En ese caso se crearán dos WebP iguales hasta que se carguen enlaces diferentes.
- Cada enlace se descarga y se convierte a WebP conservando la proporción vertical 1080 × 1350.
- Durante esa conversión se incrusta la marca de agua **Sabrina Gigena Inmobiliaria** en la parte inferior de cada WebP.
- La fotografía original de Google Drive no se modifica: la marca solo queda incorporada en la copia optimizada que se publica en GitHub.
- Si cambia el enlace de una columna, se reemplaza su WebP estable.
- Si el enlace se vacía, el WebP anterior se elimina del repositorio en la siguiente sincronización.
- Si se vacía **Imagen principal** o cualquiera de las columnas **Foto**, su WebP anterior se elimina en la siguiente sincronización.

El bloque de portada **Menos vueltas. Más información útil para decidir** utiliza exclusivamente imágenes descargadas desde esas columnas del Sheet. Solo considera propiedades con estado **Disponible** o **Reservada**: al marcar una propiedad como Vendida o Pausada, todas sus imágenes se retiran automáticamente de esa rotación.

El workflow define `SITE_URL` como `https://sabrinagigena.com`. Al ser un dominio propio publicado desde la raíz, el generador crea rutas como `/assets/` y `/propiedades/`, sin el antiguo prefijo `/sabrinagigena/`.

El archivo `CNAME` conserva `sabrinagigena.com` como dominio personalizado de GitHub Pages. Cada sincronización también actualiza canonical, Open Graph, sitemap y robots para utilizar el dominio propio.

Cada archivo de Google Drive debe estar compartido como **Cualquier persona con el enlace**. Una URL de carpeta por sí sola no permite una descarga estable en GitHub Actions; por eso el proceso avisa cuando encuentra únicamente **Carpeta Google Drive**.

Las fichas, las tarjetas y el bloque rotativo usan exclusivamente archivos sincronizados dentro de `assets/images/propiedades/`. Las fotografías antiguas guardadas fuera de esa carpeta no se usan como respaldo, por lo que pueden eliminarse sin generar imágenes rotas.

La versión del procesamiento forma parte del registro de cada imagen. Por eso, cuando cambia el diseño de la marca de agua, el siguiente workflow vuelve a procesar también las fotos cuyo enlace no cambió.

## Información pública y privacidad

- Las fichas de portada y del catálogo muestran más datos útiles: descripción breve, superficies, ambientes, dormitorios, baños, cocheras, pileta y expensas cuando corresponda.
- Cuando están cargados ambos importes, se muestran **Precio USD** y **Precio ARS**. **Moneda principal** define cuál aparece primero.
- La columna **Propiedad propia / colega** es información clasificada: no se imprime en el HTML ni se guarda en los JSON públicos.
- La dirección y el enlace exacto de Google Maps tampoco se publican.
- Cada ficha genera un mapa de zona usando solamente **Barrio / Zona** y **Localidad**, acompañado por una aclaración de que la ubicación es aproximada.

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
