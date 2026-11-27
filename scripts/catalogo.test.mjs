import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicDataRow, isPublicProperty, statusLabel, propertyPageHtml, propertyCard, propertyCardsMarkup, propertySchema, metaAvailability, buildArchiveState, publicRowsSorted, sitemapXml, metaCatalogEventData, metaPixelHeadMarkup } from './actualizar-catalogo.mjs';
import { optimizeHtml } from './optimizar-web.mjs';
const row = { ID: 'TEST01', Nombre: 'Lote de prueba', Estado: 'Disponible', 'Tipo de propiedad': 'Lote', Localidad: 'Capilla del Señor', Operación: 'Venta', 'Precio USD': '30000', 'Mostrar precio': 'Sí' };
test('Frente y largo llegan al registro público y a fichas activas o archivadas', () => {
  const measured = { ...row, 'Frente (mts)': '31,15', 'Largo (mts)': '48.65', 'Foto 12': 'https://example.com/12.webp' };
  const published = publicDataRow(measured);
  assert.equal(published['Frente (mts)'], '31,15');
  assert.equal(published['Largo (mts)'], '48.65');
  assert.equal(published['Foto 12'], measured['Foto 12']);
  for (const Estado of ['Disponible', 'Vendida']) {
    const html = propertyPageHtml({ ...published, Estado });
    assert.match(html, /<strong>31,15 m<\/strong><span>Frente<\/span>/);
    assert.match(html, /<strong>48,65 m<\/strong><span>Largo<\/span>/);
  }
});
test('Las medidas ausentes o inválidas se muestran a consultar sin inventar valores', () => {
  for (const value of ['', '0', '-10', 'sin confirmar', '<img src=x onerror=alert(1)>']) {
    const html = propertyPageHtml({ ...row, 'Frente (mts)': value, 'Largo (mts)': value });
    assert.match(html, /<strong>A consultar<\/strong><span>Frente<\/span>/);
    assert.match(html, /<strong>A consultar<\/strong><span>Largo<\/span>/);
  }
});
test('Una columna nueva o privada no se copia al registro público', () => {
  const output = publicDataRow({ ...row, 'Teléfono dueño': 'dato privado', 'Propiedad propia/colega': 'Propia',
    'Nueva columna': 'no publicar por defecto', 'Dirección': 'exacta', 'Foto 12': 'https://example.com/foto.jpg',
    'Superficie semicubierta (m²)': '20', 'Descripción comercial': 'Texto público' });
  assert.equal(output['Teléfono dueño'], undefined);
  assert.equal(output['Propiedad propia/colega'], undefined);
  assert.equal(output['Nueva columna'], undefined);
  assert.equal(output['Dirección'], undefined);
  assert.equal(output['Foto 12'], 'https://example.com/foto.jpg');
  assert.equal(output['Superficie semicubierta (m²)'], '20');
  assert.equal(output['Descripción comercial'], 'Texto público');
});
test('Texto de Sheets no puede cerrar scripts ni inyectar HTML en la ficha', () => {
  const html = propertyPageHtml({ ...row, Nombre: '</script><img src=x onerror=alert(1)>',
    'Descripción comercial': '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<img src=x|<script>alert\(1\)/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
test('Las protecciones de las páginas no se duplican al volver a generar', async () => {
  const html = await optimizeHtml('<html><head></head><body><script src="/assets/js/main.js"></script></body></html>');
  assert.match(html, /base-uri 'self'; object-src 'none'; form-action 'self'/);
  assert.match(html, /strict-origin-when-cross-origin/);
  assert.equal(await optimizeHtml(html), html);
});
test('Vendida, pausada y oculta se retiran; reservada y último disponible siguen públicas', () => {
  for (const Estado of ['Disponible', 'Reservada', 'RESERVADO!', 'Último disponible!', ' último   disponible ', 'ULTIMA DISPONIBLE', 'Nuevo estado']) assert.equal(isPublicProperty({ ...row, Estado }), true, Estado);
  for (const Estado of ['Vendida', 'VENDIDO!', ' Pausada ', 'PAUSADO', 'OCULTA', ' oculta ', 'Oculta!', 'Oculto']) assert.equal(isPublicProperty({ ...row, Estado }), false, Estado);
});

test('Oculta sale de los listados y conserva su ficha noindex con alternativas', () => {
  const hidden = { ...row, ID: 'HIDDEN01', Estado: 'OCULTA', 'Descripción comercial': 'Descripción conservada.' };
  const publicRows = publicRowsSorted([hidden, row]);
  assert.deepEqual(publicRows, [row]);
  assert.equal(statusLabel(hidden), 'Oculta');
  assert.doesNotMatch(propertyCardsMarkup([hidden, row]), /HIDDEN01/);
  assert.doesNotMatch(sitemapXml(publicRows, '2026-11-24'), /hidden01/i);

  const archive = buildArchiveState([hidden, row], [{ ...hidden, Estado: 'Disponible' }, row], { rows: [] });
  assert.equal(archive.rowCount, 1);
  assert.equal(archive.rows[0].ID, hidden.ID);
  assert.equal(archive.rows[0]._archiveReason, 'Oculta');
  const html = propertyPageHtml(archive.rows[0], publicRows);
  assert.match(html, /<link rel="canonical" href="https:\/\/sabrinagigena.com\/propiedades\/lote-de-prueba-hidden01\/">/);
  assert.match(html, /noindex,follow/);
  assert.match(html, /Fuera de publicación/);
  assert.match(html, /Descripción conservada\./);
  assert.match(html, /data-property-id="TEST01"/);
  assert.doesNotMatch(html, /<strong>Vendida<\/strong>|fbq\('track', '(?:ViewContent|Lead)'/);
});

test('Una oculta puede volver al catálogo al cambiar a disponible', () => {
  const hidden = { ...row, Estado: 'Oculta' };
  const archive = buildArchiveState([hidden], [row], { rows: [] });
  assert.equal(buildArchiveState([row], [hidden], archive).rowCount, 0);
  assert.match(propertyCardsMarkup([row]), /data-property-id="TEST01"/);
  assert.doesNotMatch(propertyPageHtml(row), /noindex,follow|Fuera de publicación/);
});

test('Una venta conserva el enlace y prioriza alternativas disponibles sobre la ficha original', () => {
  const sold = { ...row, Estado: 'VENDIDO!', 'Descripción comercial': 'Descripción histórica completa.' };
  const candidates = [
    { ...row, ID: 'A1', Localidad: 'Otra localidad', 'Tipo de propiedad': 'Casa' },
    { ...row, ID: 'A2', Estado: 'Reservada' },
    { ...row, ID: 'A3', Estado: 'Último disponible!' },
    { ...row, ID: 'A4', Estado: 'Oculta' },
    { ...row, ID: 'A5', Estado: 'Vendida' },
    { ...row, ID: 'A6', Estado: 'Pausada' },
    { ...row, ID: 'A7', Localidad: 'Otra localidad' },
    { ...row, ID: 'A8', Estado: 'Estado sin confirmar' },
    { ...row, ID: 'A9', 'Tipo de propiedad': 'Casa' }
  ];
  const archive = buildArchiveState([sold, ...candidates], [row, ...candidates], { rows: [] });
  const html = propertyPageHtml(archive.rows.find(item => item.ID === row.ID), [row, ...candidates]);
  const canonical = propertyPageHtml(row).match(/<link rel="canonical"[^>]+>/)[0];
  assert.ok(html.includes(canonical));
  assert.match(html, /noindex,follow/);
  assert.doesNotMatch(propertyCardsMarkup([sold, ...candidates]), /data-property-id="TEST01"/);
  assert.doesNotMatch(sitemapXml(publicRowsSorted([sold, ...candidates]), '2026-11-27'), /test01/i);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /Propiedad vendida[\s\S]*?<h1>Lote de prueba<\/h1>[\s\S]*?Otras propiedades disponibles[\s\S]*?id="ficha-original"[\s\S]*?Descripción histórica completa\./);
  assert.deepEqual([...html.matchAll(/class="property-card" data-property-id="([^"]+)"/g)].map(m => m[1]), ['A3', 'A7', 'A9']);
  assert.match(html, /href="\/propiedades\/lote-de-prueba-a3\/"/);
  assert.doesNotMatch(html, /fbq\('track', '(?:ViewContent|Lead)'/);
  assert.doesNotMatch(propertyPageHtml(row), /class="sold-notice"/);
});

test('Una venta sin alternativas disponibles ofrece contacto desde el aviso', () => {
  const html = propertyPageHtml({ ...row, Estado: 'Vendida' }, [{ ...row, ID: 'R', Estado: 'Reservada' }]);
  assert.doesNotMatch(html, /class="property-card"|Otras propiedades disponibles/);
  assert.match(html, /href="#contacto-alternativas"/);
  assert.match(html, /<aside class="contact-card" id="contacto-alternativas">[\s\S]*?href="https:\/\/wa\.me\//);
  assert.match(html, /href="#ficha-original"/);
});
test('Los filtros de la home reciben todas las propiedades públicas, no solo las primeras seis', () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({
    ...row,
    ID: 'TEST' + String(index + 1).padStart(2, '0'),
    Nombre: 'Lote de prueba ' + (index + 1)
  }));
  rows.push({ ...row, ID: 'VENDIDA', Estado: 'Vendida' });
  const cards = propertyCardsMarkup(rows);
  assert.equal((cards.match(/class="property-card"/g) || []).length, 8);
  assert.match(cards, /data-property-id="TEST08"/);
  assert.doesNotMatch(cards, /data-property-id="VENDIDA"/);
});
test('Ultimo se recupera del archivo y aparece en tarjeta ficha sitemap y Meta', () => {
  const active = { ...row, Estado: 'Último disponible!' };
  assert.equal(statusLabel(active), 'Último disponible');
  assert.equal(buildArchiveState([active], [active], { rows: [active] }).rowCount, 0);
  assert.match(propertyCard(active), /status-ultimo-disponible/);
  const html = propertyPageHtml(active);
  assert.match(html, /property-status-ultimo-disponible/);
  assert.doesNotMatch(html, /is-archived|sold-alert|noindex,follow/);
  assert.match(sitemapXml(publicRowsSorted([active]), '2026-09-08'), /lote-de-prueba-test01/);
  assert.equal(metaAvailability(active), 'FOR_SALE');
  assert.match(propertySchema(active, 'https://example.com/lote/', []), /LimitedAvailability/);
});
test('Descripcion completa con saltos de linea y HTML escapado', () => {
  const description = 'Texto largo de la propiedad. '.repeat(100) + '\nFin de la descripción <privado> & detalles.';
  const html = propertyPageHtml({ ...row, 'Descripción comercial': description });
  const lead = html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1];
  assert.ok(lead.length > 2000);
  assert.match(lead, /\nFin de la descripción &lt;privado&gt; &amp; detalles\.$/);
  assert.doesNotMatch(lead, /…/);
});
test('Reservada publica y vendida noindex', () => {
  assert.match(propertyPageHtml({ ...row, Estado: 'Reservada!' }), /property-status-reservada/);
  assert.equal(metaAvailability({ ...row, Estado: 'Reservada!' }), 'SALE_PENDING');
  assert.match(propertyPageHtml({ ...row, Estado: 'Vendida' }), /noindex,follow/);
});
test('Cada ficha publica vincula ViewContent y Lead con el home_listing_id exacto', () => {
  const html = propertyPageHtml(row);
  assert.match(html, /fbq\('track', 'PageView'\)/);
  assert.match(html, /fbq\('track', 'ViewContent', \{"content_type":"home_listing","content_ids":\["TEST01"\],"content_name":"Lote de prueba","value":30000,"currency":"USD"\}\)/);
  assert.match(html, /fbq\('track', 'Lead', \{"content_type":"home_listing","content_ids":\["TEST01"\]/);
  assert.match(propertyCard(row), /data-property-id="TEST01"/);
  assert.deepEqual(metaCatalogEventData(row), {
    content_type: 'home_listing',
    content_ids: ['TEST01'],
    content_name: 'Lote de prueba',
    value: 30000,
    currency: 'USD'
  });
});
test('Las fichas retiradas no envian eventos contra articulos ausentes del catalogo', () => {
  const html = propertyPageHtml({ ...row, Estado: 'Vendida' });
  assert.match(html, /fbq\('track', 'PageView'\)/);
  assert.doesNotMatch(html, /fbq\('track', 'ViewContent'/);
  assert.doesNotMatch(html, /fbq\('track', 'Lead'/);
});
test('La busqueda del catalogo envia Search con IDs visibles y evita duplicados', () => {
  const html = metaPixelHeadMarkup({ catalogSearch: true });
  assert.match(html, /fbq\('track', 'Search'/);
  assert.match(html, /content_type: 'home_listing'/);
  assert.match(html, /\.property-card\[data-property-id\]:not\(\[hidden\]\)/);
  assert.match(html, /lastSearchKey/);
});
