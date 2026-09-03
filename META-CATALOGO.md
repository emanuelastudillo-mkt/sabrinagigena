# Catálogo inmobiliario para Meta

La sincronización diaria genera este feed público:

    https://sabrinagigena.com/meta-catalog.csv

Está preparado para un catálogo de tipo **Inmuebles / Real estate** y utiliza el `ID` estable de Google Sheets como `home_listing_id`.

## Datos necesarios por propiedad

El feed incluye únicamente propiedades con estado `Disponible` o `Reservada` que tengan:

- `ID`, `Nombre`, `Tipo de propiedad`, `Operación` y `Localidad`;
- precio público en `Precio USD` o `Precio ARS`;
- `Imagen principal` sincronizada;
- `Barrio / Zona`;
- `Código postal`;
- `Latitud aproximada`;
- `Longitud aproximada`.

Las coordenadas deben corresponder al centro aproximado del barrio o localidad. El archivo público no utiliza la dirección exacta ni el enlace privado de Google Maps.

El generador acepta tanto el formato decimal normal (`-34.316898`) como el formato que Google Sheets puede exportar según la configuración regional argentina (`-34.316.898`). En ambos casos publica la coordenada normalizada `-34.316898`.

Cada foto sincronizada se convierte también a JPEG dentro de `assets/images/meta/`. Si la propiedad deja de estar disponible, desaparece del feed y se eliminan sus JPEG de Meta en la próxima actualización, sin borrar su ficha histórica.

## Conexión en Meta

1. Crear o abrir un catálogo de tipo Inmuebles / Real estate en Commerce Manager.
2. Agregar una fuente de datos programada mediante URL.
3. Ingresar `https://sabrinagigena.com/meta-catalog.csv`.
4. Programar la lectura una vez por día, preferentemente después de las 07:00 de Argentina.
5. Revisar el diagnóstico de la primera importación antes de activar anuncios.

El workflow de GitHub se ejecuta a las 06:20 de Argentina y reconstruye el CSV, las imágenes JPEG y las URLs. El archivo no debe editarse manualmente porque la siguiente sincronización lo reemplaza.

## Campos generados

El feed publica identificador, nombre, disponibilidad, ubicación aproximada, hasta trece imágenes, precio, URL, descripción, dormitorios, baños, ambientes, tipo, operación, superficie, antigüedad calculada y datos de contacto de Sabrina.

La sincronización se detiene antes de reemplazar el archivo si existen propiedades públicas pero el resultado quedaría completamente vacío. Esto evita volver a publicar accidentalmente un CSV que sólo contenga encabezados.

La disponibilidad usa `FOR_SALE`, `FOR_RENT` o `SALE_PENDING`. Los tipos se normalizan a valores compatibles como `HOUSE`, `APARTMENT`, `LAND`, `CONDO` u `OTHER`.
