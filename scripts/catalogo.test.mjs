import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicDataRow, isPublicProperty, statusLabel, propertyPageHtml, propertyCard, propertyCardsMarkup, propertySchema, metaAvailability, buildArchiveState, publicRowsSorted, sitemapXml, metaCatalogEventData, metaPixelHeadMarkup } from './actualizar-catalogo.mjs';
import { optimizeHtml } from './optimizar-web.mjs';
const row = { ID: 'TEST01', Nombre: 'Lote de prueba', Estado: 'Disponible', 'Tipo de propiedad': 'Lote', Localidad: 'Capilla del Señor', Operación: 'Venta', 'Precio USD': '30000', 'Mostrar precio': 'Sí' };
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
test('Solo vendida o pausada se retiran', () => {
  for (const Estado of ['Disponible', 'Reservada', 'RESERVADO!', 'Último disponible!', ' último   disponible ', 'ULTIMA DISPONIBLE', 'Nuevo estado']) assert.equal(isPublicProperty({ ...row, Estado }), true, Estado);
  for (const Estado of ['Vendida', 'VENDIDO!', ' Pausada ', 'PAUSADO']) assert.equal(isPublicProperty({ ...row, Estado }), false, Estado);
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
