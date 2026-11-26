import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { syncPropertyImages } from './actualizar-catalogo.mjs';

const row = { ID: 'PHOTO_TEST', 'Imagen principal': 'https://example.com/foto.png' };
const report = () => ({ downloaded: 0, unchanged: 0, deleted: 0, errors: [] });
const photo = color => sharp({ create: { width: 1080, height: 1350, channels: 3, background: color } }).png().toBuffer();
const workspace = () => mkdtemp(path.join(tmpdir(), 'sabrina-image-sync-'));
const mockDownload = (t, handler) => t.mock.method(globalThis, 'fetch', handler);

test('Mismo enlace con nueva imagen reemplaza el WebP; repetirla no reescribe el archivo', async t => {
  const directory = await workspace();
  let input = await photo('#777777');
  const fetch = mockDownload(t, async () => new Response(input, { headers: { 'content-type': 'image/png' } }));
  const firstReport = report();
  const first = await syncPropertyImages(row, { items: [] }, firstReport, directory);
  const file = path.join(directory, first.items[0].file);
  const oldBytes = await readFile(file);
  assert.equal(firstReport.downloaded, 1);

  input = await photo('#123456');
  const secondReport = report();
  const second = await syncPropertyImages(row, first, secondReport, directory);
  assert.equal(second.items[0].source, first.items[0].source);
  assert.notEqual(second.items[0].inputHash, first.items[0].inputHash);
  assert.notDeepEqual(await readFile(file), oldBytes);
  assert.equal(secondReport.downloaded, 1);

  const modified = (await stat(file)).mtimeMs;
  const thirdReport = report();
  const third = await syncPropertyImages(row, second, thirdReport, directory);
  assert.deepEqual(third, second);
  assert.equal(thirdReport.unchanged, 1);
  assert.equal(thirdReport.downloaded, 0);
  assert.equal((await stat(file)).mtimeMs, modified);
  assert.equal(fetch.mock.callCount(), 3);
});

test('Registros anteriores sin hash se verifican y los enlaces duplicados se descargan una vez', async t => {
  const directory = await workspace();
  const input = await photo('#335566');
  const fetch = mockDownload(t, async () => new Response(input, { headers: { 'content-type': 'image/png' } }));
  const repeated = { ...row, 'Foto 1': row['Imagen principal'] };
  const first = await syncPropertyImages(repeated, { items: [] }, report(), directory);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(first.items.length, 2);
  assert.equal(first.items[0].inputHash, first.items[1].inputHash);
  const legacy = { items: first.items.map(({ inputHash, ...item }) => item) };
  const result = await syncPropertyImages(repeated, legacy, report(), directory);
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(result, first);
});

test('Una descarga fallida conserva la imagen y permite reintentar sin perder su estado', async t => {
  const directory = await workspace();
  const input = await photo('#225588');
  let failing = false;
  mockDownload(t, async () => failing
    ? new Response('Temporalmente no disponible', { status: 503 })
    : new Response(input, { headers: { 'content-type': 'image/png' } }));
  const first = await syncPropertyImages(row, { items: [] }, report(), directory);
  const file = path.join(directory, first.items[0].file);
  const bytes = await readFile(file);
  failing = true;
  const failedReport = report();
  assert.deepEqual(await syncPropertyImages(row, first, failedReport, directory), first);
  assert.deepEqual(await readFile(file), bytes);
  assert.equal(failedReport.errors.length, 1);
  assert.equal(failedReport.deleted, 0);
  failing = false;
  const retryReport = report();
  assert.deepEqual(await syncPropertyImages(row, first, retryReport, directory), first);
  assert.equal(retryReport.errors.length, 0);
});

test('Drive usa primero el original y mantiene alternativas si devuelve HTML', async t => {
  const directory = await workspace();
  const input = await photo('#669955');
  const urls = [];
  mockDownload(t, async (url, options) => {
    urls.push(url);
    assert.equal(options.headers['cache-control'], 'no-cache');
    if (urls.length === 1) return new Response('<html>Confirmación</html>', { headers: { 'content-type': 'text/html' } });
    return new Response(input, { headers: { 'content-type': 'image/png' } });
  });
  const summary = report();
  await syncPropertyImages({ ...row, 'Imagen principal': 'https://drive.google.com/file/d/12345678901234567890/view' }, { items: [] }, summary, directory);
  assert.match(urls[0], /^https:\/\/drive.google.com\/uc\?export=download/);
  assert.match(urls[1], /^https:\/\/drive.usercontent.google.com\/download/);
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.errors.length, 0);
});
