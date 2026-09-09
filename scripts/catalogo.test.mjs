import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPublicProperty, statusLabel, propertyPageHtml, propertyCard, propertySchema, metaAvailability, buildArchiveState, publicRowsSorted, sitemapXml, metaCatalogEventData, metaPixelHeadMarkup } from './actualizar-catalogo.mjs';
const row = { ID: 'TEST01', Nombre: 'Lote de prueba', Estado: 'Disponible', 'Tipo de propiedad': 'Lote', Localidad: 'Capilla del Señor', Operación: 'Venta', 'Precio USD': '30000', 'Mostrar precio': 'Sí' };
test('Solo vendida o pausada se retiran', () => {
  for (const Estado of ['Disponible', 'Reservada', 'RESERVADO!', 'Último disponible!', ' último   disponible ', 'ULTIMA DISPONIBLE', 'Nuevo estado']) assert.equal(isPublicProperty({ ...row, Estado }), true, Estado);
  for (const Estado of ['Vendida', 'VENDIDO!', ' Pausada ', 'PAUSADO']) assert.equal(isPublicProperty({ ...row, Estado }), false, Estado);
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
