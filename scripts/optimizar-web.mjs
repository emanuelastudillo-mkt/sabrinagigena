import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { publicDataRow } from './actualizar-catalogo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://sabrinagigena.com';
const version = '22.26';
const policy = "base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests";
const metadata = new Map();
const thumbnails = new Map();
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const attr = (tag, name) => tag.match(new RegExp('\\s' + name + '=["\']([^"\']*)["\']', 'i'))?.[1];
const setAttr = (tag, name, value) => tag.replace(new RegExp('\\s' + name + '=["\'][^"\']*["\']', 'gi'), '')
  .replace(/\s*\/?\s*>$/, ' ' + name + '="' + escape(value) + '">');

function assetPath(source) {
  try {
    const url = new URL(source, site);
    if (url.origin !== site) return null;
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    return file.startsWith(root + path.sep) ? file : null;
  } catch { return null; }
}

async function readMetadata(file) {
  if (!metadata.has(file)) metadata.set(file, await sharp(file).metadata());
  return metadata.get(file);
}

async function writeChanged(file, content) {
  const previous = await readFile(file).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (previous?.equals(buffer)) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
}

async function cardImage(tag) {
  const source = attr(tag, 'data-card-source') || attr(tag, 'src');
  const file = assetPath(source);
  if (!file || !/[/\\]assets[/\\]images[/\\]propiedades[/\\][\w-]+\.webp$/.test(file)) return tag;
  if (!thumbnails.has(file)) {
    const input = await readFile(file);
    const info = await readMetadata(file);
    const hash = createHash('sha256').update(input).update('card-v1').digest('hex').slice(0, 12);
    const variants = [];
    for (const width of [480, 800].filter(width => width < info.width)) {
      const name = path.basename(file, '.webp') + '-' + width + '.webp';
      const output = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await writeChanged(path.join(root, 'assets/images/miniaturas', name), output);
      variants.push({ width, src: '/assets/images/miniaturas/' + name + '?v=' + hash, bytes: output.length });
    }
    thumbnails.set(file, { info, variants, originalBytes: input.length });
  }
  const { info, variants } = thumbnails.get(file);
  if (!variants.length) return tag;
  tag = setAttr(tag, 'data-card-source', source);
  tag = setAttr(tag, 'src', variants[0].src);
  tag = setAttr(tag, 'srcset', [...variants.map(item => item.src + ' ' + item.width + 'w'), source + ' ' + info.width + 'w'].join(', '));
  tag = setAttr(tag, 'sizes', '(max-width: 560px) calc(100vw - 32px), (max-width: 980px) calc((100vw - 52px)/2), 380px');
  tag = setAttr(tag, 'width', info.width);
  return setAttr(tag, 'height', info.height);
}

export async function optimizeHtml(html) {
  html = html.replace(/<meta\b[^>]*(?:http-equiv=["']Content-Security-Policy["']|name=["']referrer["'])[^>]*>\s*/gi, '');
  html = html.replace(/<head>\s*/i, '<head>\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">\n<meta name="referrer" content="strict-origin-when-cross-origin">\n');
  const matches = [...html.matchAll(/<div class="card-media">(<img\b[^>]*>)/g)];
  for (const match of matches) html = html.replace(match[0], '<div class="card-media">' + await cardImage(match[1]));
  for (const match of [...html.matchAll(/<img\b[^>]*>/g)]) {
    let tag = match[0];
    if (attr(tag, 'width') || attr(tag, 'height')) continue;
    const file = assetPath(attr(tag, 'src'));
    if (!file || !/\.(?:webp|png|jpe?g)$/i.test(file)) continue;
    const info = await readMetadata(file).catch(() => null);
    if (!info?.width || !info?.height) continue;
    tag = setAttr(setAttr(tag, 'width', info.width), 'height', info.height);
    html = html.replace(match[0], tag);
  }
  return html
    .replace(/(\/assets\/(?:js\/main\.js|css\/site\.css))(?:\?[^"']*)?(?=["'])/g, '$1?v=' + version)
    .replace(/Versión V22\.\d+(?:\.\d+)?/g, 'Versión V' + version);
}

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'scripts', 'assets', 'data'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(file));
    else if (entry.name.endsWith('.html')) files.push(file);
  }
  return files;
}

async function main() {
  // También sanea los registros ya existentes; no cambia los datos comerciales.
  for (const name of ['propiedades.json', 'propiedades-no-index.json']) {
    const file = path.join(root, 'data', name);
    const state = JSON.parse(await readFile(file, 'utf8'));
    state.rows = state.rows.map(row => ({ ...publicDataRow(row),
      ...(row._archivedAt ? { _archivedAt: row._archivedAt } : {}),
      ...(row._archiveReason ? { _archiveReason: row._archiveReason } : {})
    }));
    state.contentHash = createHash('sha256').update(JSON.stringify(state.rows)).digest('hex');
    await writeChanged(file, JSON.stringify(state, null, 2) + '\n');
  }
  const files = await htmlFiles(root);
  for (const file of files) await writeChanged(file, await optimizeHtml(await readFile(file, 'utf8')));
  const images = [...thumbnails.values()];
  console.log(JSON.stringify({ pages: files.length, covers: images.length,
    originalBytes: images.reduce((sum, item) => sum + item.originalBytes, 0),
    smallBytes: images.reduce((sum, item) => sum + (item.variants[0]?.bytes || 0), 0),
    mediumBytes: images.reduce((sum, item) => sum + (item.variants[1]?.bytes || 0), 0)
  }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error('Error de optimización: ' + error.message); process.exitCode = 1; });
}
