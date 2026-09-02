# Catálogo conectado a Google Sheets

Esta versión usa como fuente de verdad la pestaña **Propiedades** del archivo:

https://docs.google.com/spreadsheets/d/1Q58K5bHQQWj4rjAZlN9cNZ9LgbY7oj_If36COOmDnsI/edit?gid=779453685

La sincronización se ejecuta automáticamente cada seis horas y también puede iniciarse de forma manual desde **GitHub → Actions → Actualizar catálogo e imágenes → Run workflow**.

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

## Imágenes

El catálogo usa las columnas **Foto 1** a **Foto 12**:

- **Foto 1** es la portada de la propiedad.
- **Foto 2** a **Foto 12** forman la galería en ese orden.
- Cada columna no vacía genera su propio archivo: por ejemplo, AM (**Foto 1**) crea `ID-foto-01.webp` y AV (**Foto 10**) crea `ID-foto-10.webp`.
- La relación columna/archivo se mantiene incluso si dos celdas tienen temporalmente el mismo enlace. En ese caso se crearán dos WebP iguales hasta que se carguen enlaces diferentes.
- Cada enlace se descarga y se convierte a WebP conservando la proporción vertical 1080 × 1350.
- Si cambia el enlace de una columna, se reemplaza su WebP estable.
- Si el enlace se vacía, el WebP anterior se elimina del repositorio en la siguiente sincronización.
- En hojas antiguas que todavía no tengan columnas Foto, **Imagen principal** funciona como respaldo de compatibilidad. En la hoja actual, vaciar una columna Foto elimina su imagen sincronizada.

El bloque de portada **Menos vueltas. Más información útil para decidir** utiliza exclusivamente imágenes descargadas desde esas columnas del Sheet. Solo considera propiedades con estado **Disponible** o **Reservada**: al marcar una propiedad como Vendida o Pausada, todas sus imágenes se retiran automáticamente de esa rotación.

El workflow define `SITE_URL` con la dirección pública de GitHub Pages. El generador obtiene de allí el prefijo `/sabrinagigena/`, necesario para que imágenes, estilos y enlaces internos funcionen dentro de un sitio de proyecto.

Cada archivo de Google Drive debe estar compartido como **Cualquier persona con el enlace**. Una URL de carpeta por sí sola no permite una descarga estable en GitHub Actions; por eso el proceso avisa cuando encuentra únicamente **Carpeta Google Drive**.

data/imagenes-manuales.json conserva como respaldo las galerías que ya existían en la web. Cuando una fila tenga enlaces en **Foto 1** a **Foto 12**, esas imágenes se muestran primero y se actualizan automáticamente.

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
