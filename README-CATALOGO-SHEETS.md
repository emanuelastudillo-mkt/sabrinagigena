# Catálogo conectado a Google Sheets

Esta versión usa como fuente de verdad la pestaña **Propiedades** del archivo:

https://docs.google.com/spreadsheets/d/1Q58K5bHQQWj4rjAZlN9cNZ9LgbY7oj_If36COOmDnsI/edit?gid=779453685

La sincronización se ejecuta automáticamente cada seis horas y también puede iniciarse de forma manual desde **GitHub → Actions → Actualizar catálogo e imágenes → Run workflow**.

## Qué actualiza

- data/propiedades.json: copia normalizada del catálogo publicado.
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

## Imágenes

La columna **Imagen principal** se descarga como portada. Para agregar una galería automática, crear columnas con enlaces individuales:

- Imagen 2
- Imagen 3
- Imagen 4
- etc.

También se aceptan los nombres **Foto 2**, **Foto 3** o **Imagen principal 2**, **Imagen principal 3**, etc. El orden siempre comienza por Imagen principal y continúa según la secuencia numérica.

El workflow define `SITE_URL` con la dirección pública de GitHub Pages. El generador obtiene de allí el prefijo `/sabrinagigena/`, necesario para que imágenes, estilos y enlaces internos funcionen dentro de un sitio de proyecto.

Cada archivo de Google Drive debe estar compartido como **Cualquier persona con el enlace**. Una URL de carpeta por sí sola no permite una descarga estable en GitHub Actions; por eso el proceso avisa cuando encuentra únicamente **Carpeta Google Drive**.

data/imagenes-manuales.json conserva como respaldo las galerías que ya existían en la web. Cuando una fila tenga enlaces individuales en el Sheet, las fotos nuevas se anteponen y se actualizan automáticamente.

## ¿Hace falta Apps Script en Google Sheets?

No. El Sheet ya puede funcionar como fuente de datos sin instalar ningún script:

1. GitHub Actions lee el CSV público.
2. El generador actualiza catálogo, páginas, imágenes y archivo histórico.
3. GitHub publica los cambios.

Apps Script solo sería necesario si más adelante se quisiera disparar una actualización instantánea al editar una celda, recorrer automáticamente carpetas completas de Drive o usar permisos privados. Para la actualización programada cada seis horas no hace falta.

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
