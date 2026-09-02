import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  unlink
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const CSV_URL =
  process.env.PROPERTIES_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1Q58K5bHQQWj4rjAZlN9cNZ9LgbY7oj_If36COOmDnsI/export?format=csv&gid=779453685';

const SITE_URL = (process.env.SITE_URL || 'https://sabrinagigena.com').replace(/\/+$/, '');
const SITE_NAME = 'Sabrina Gigena Servicios Inmobiliarios';
const CONTACT_PHONE = '+54 9 2304 56-7715';
const CONTACT_WHATSAPP = '5492304567715';
const CONTACT_EMAIL = 'sabrinagigena.inmobiliaria@gmail.com';
const IMAGE_WIDTH = 1800;
const IMAGE_QUALITY = 82;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const dataDir = path.join(repoRoot, 'data');
const imagesDir = path.join(repoRoot, 'assets', 'images', 'propiedades');
const stockPath = path.join(dataDir, 'propiedades.json');
const imageStatePath = path.join(dataDir, 'image-sync.json');
const imageManifestPath = path.join(imagesDir, 'manifest.json');
const manualImagesPath = path.join(dataDir, 'imagenes-manuales.json');
const generatedPagesPath = path.join(dataDir, 'generated-pages.json');
const archivedPropertiesPath = path.join(dataDir, 'propiedades-no-index.json');
const indexPath = path.join(repoRoot, 'index.html');
const catalogIndexPath = path.join(repoRoot, 'propiedades', 'index.html');
const sitemapPath = path.join(repoRoot, 'sitemap.xml');
const robotsPath = path.join(repoRoot, 'robots.txt');

let currentImageManifest = { _version: 'empty' };
let manualImages = {};

function clean(value) {
  return (value ?? '').toString().trim();
}

function normalize(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizedHeader(value) {
  return normalize(value)
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(clean(value).replace(/\s+/g, ' '));
}

function escapeXml(value) {
  return escapeHtml(value);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (current === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (current === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((current === '\n' || current === '\r') && !quoted) {
      if (current === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => clean(value))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += current;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(value => clean(value))) rows.push(row);
  }

  if (!rows.length) throw new Error('El CSV está vacío.');

  const headers = rows.shift().map((header, index) =>
    clean(header).replace(/^\uFEFF/, '') || ('col_' + index)
  );

  return rows.map(values =>
    Object.fromEntries(headers.map((header, index) => [header, clean(values[index])]))
  );
}

function findHeader(headers, expected) {
  const wanted = normalize(expected);
  return headers.find(header => normalize(header) === wanted);
}

function rowValue(row, ...names) {
  for (const name of names) {
    const wanted = normalize(name);
    for (const [key, value] of Object.entries(row || {})) {
      if (normalize(key) === wanted && clean(value)) return clean(value);
    }
  }
  return '';
}

function propertyId(row) {
  return rowValue(row, 'ID')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function propertyTitle(row) {
  return rowValue(row, 'Nombre', 'Título', 'Titulo');
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No se encontraron filas en la hoja.');
  }

  const headers = Object.keys(rows[0] || {});
  const required = ['ID', 'Estado', 'Tipo de propiedad', 'Localidad'];
  const missing = required.filter(name => !findHeader(headers, name));
  const hasTitle = findHeader(headers, 'Nombre') || findHeader(headers, 'Título');

  if (!hasTitle) missing.push('Nombre o Título');
  if (missing.length) {
    throw new Error('Faltan columnas requeridas: ' + missing.join(', '));
  }

  const usable = rows.filter(row =>
    propertyId(row) &&
    propertyTitle(row) &&
    rowValue(row, 'Estado')
  );

  if (!usable.length) {
    throw new Error('La hoja no contiene propiedades utilizables.');
  }

  const seen = new Set();
  for (const row of usable) {
    const id = propertyId(row);
    if (seen.has(id)) throw new Error('ID duplicado en el Sheet: ' + id);
    seen.add(id);
  }

  return usable;
}

function isPublicProperty(row) {
  const status = normalize(rowValue(row, 'Estado'));
  return status === 'DISPONIBLE' || status === 'RESERVADA' || status === 'RESERVADO';
}

function isSoldProperty(row) {
  const status = normalize(rowValue(row, 'Estado'));
  return status === 'VENDIDA' || status === 'VENDIDO';
}

function statusLabel(row) {
  const status = normalize(rowValue(row, 'Estado'));
  const labels = {
    DISPONIBLE: 'Disponible',
    RESERVADA: 'Reservada',
    RESERVADO: 'Reservada',
    VENDIDA: 'Vendida',
    VENDIDO: 'Vendida',
    PAUSADA: 'Pausada',
    PAUSADO: 'Pausada'
  };
  return labels[status] || rowValue(row, 'Estado');
}

function propertySlug(row) {
  return slugify(propertyTitle(row) + '-' + propertyId(row).toLowerCase());
}

function propertyRoute(row) {
  return '/propiedades/' + propertySlug(row) + '/';
}

function propertyOutputPath(row) {
  return path.join('propiedades', propertySlug(row), 'index.html');
}

function archivedPropertyRoute(row) {
  return '/propiedades-no-index/' + propertySlug(row) + '/';
}

function archivedPropertyOutputPath(row) {
  return path.join('propiedades-no-index', propertySlug(row), 'index.html');
}

function numberValue(value) {
  const text = clean(value)
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');
  if (!text) return 0;

  const commaCount = (text.match(/,/g) || []).length;
  const dotCount = (text.match(/\./g) || []).length;
  let normalized = text;

  if (commaCount && dotCount) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (commaCount) {
    const decimals = text.length - text.lastIndexOf(',') - 1;
    normalized = commaCount > 1 || decimals === 3
      ? text.replace(/,/g, '')
      : text.replace(',', '.');
  } else if (dotCount) {
    const decimals = text.length - text.lastIndexOf('.') - 1;
    normalized = dotCount > 1 || decimals === 3
      ? text.replace(/\./g, '')
      : text;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, maximumFractionDigits = 2) {
  const number = numberValue(value);
  if (!number) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits }).format(number);
}

function formatArea(value) {
  const formatted = formatNumber(value, 2);
  return formatted ? formatted + ' m²' : '';
}

function showPrice(row) {
  const setting = normalize(rowValue(row, 'Mostrar precio'));
  return setting !== 'NO' && setting !== 'N';
}

function priceInfo(row) {
  if (!showPrice(row)) return { label: 'Consultar valor', amount: 0, currency: '' };

  const primary = normalize(rowValue(row, 'Moneda principal'));
  const usd = numberValue(rowValue(row, 'Precio USD'));
  const ars = numberValue(rowValue(row, 'Precio ARS'));

  if ((primary === 'USD' && usd) || (!ars && usd)) {
    return {
      label: 'U$S ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(usd),
      amount: usd,
      currency: 'USD'
    };
  }

  if (ars) {
    return {
      label: '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(ars),
      amount: ars,
      currency: 'ARS'
    };
  }

  return { label: 'Consultar valor', amount: 0, currency: '' };
}

function isDriveFolderUrl(url) {
  return /drive\.google\.com\/(?:drive\/u\/\d+\/)?folders\//i.test(clean(url)) ||
    /\/folders\//i.test(clean(url));
}

function driveFileId(url) {
  const input = clean(url);
  if (!input || isDriveFolderUrl(input)) return '';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/i,
    /[?&]id=([a-zA-Z0-9_-]{20,})/i,
    /\/d\/([a-zA-Z0-9_-]{20,})/i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return '';
}

function isDirectImageReference(url) {
  const input = clean(url);
  if (!input || isDriveFolderUrl(input)) return false;
  return Boolean(driveFileId(input) || /^https?:\/\//i.test(input));
}

function sourceKey(url) {
  const id = driveFileId(url);
  if (id) return 'drive:' + id;
  const input = clean(url);
  if (!input) return '';
  return 'url:' + createHash('sha256').update(input).digest('hex').slice(0, 24);
}

function photoSources(row) {
  const sources = [];
  const primary = rowValue(row, 'Imagen principal');

  if (isDirectImageReference(primary)) {
    sources.push({ order: 0, url: primary });
  }

  for (const [key, rawValue] of Object.entries(row || {})) {
    const header = normalizedHeader(key);
    if (header === 'IMAGEN PRINCIPAL') continue;

    const match = header.match(/^(?:FOTO|IMAGEN)\s*(\d+)(?:\s|$)/);
    const url = clean(rawValue);
    if (!match || !isDirectImageReference(url)) continue;

    sources.push({ order: Number(match[1]) || 999, url });
  }

  sources.sort((a, b) => a.order - b.order);

  const unique = [];
  const seen = new Set();
  for (const source of sources) {
    const key = sourceKey(source.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
  }
  return unique;
}

function imageDownloadCandidates(url) {
  const input = clean(url);
  const id = driveFileId(input);
  if (!id) return [input];

  return [
    'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w2400',
    'https://lh3.googleusercontent.com/d/' + id + '=w2400',
    'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id),
    'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(id) + '&export=download&confirm=t'
  ];
}

async function downloadImageBuffer(url) {
  const errors = [];
  for (const candidate of imageDownloadCandidates(url)) {
    try {
      const response = await fetch(candidate, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
        headers: {
          'user-agent': 'SabrinaGigenaCatalogSync/1.0',
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        errors.push(response.status + ' ' + candidate);
        continue;
      }

      const contentType = clean(response.headers.get('content-type')).toLowerCase();
      if (contentType.includes('text/html')) {
        errors.push('HTML en ' + candidate);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 512) {
        errors.push('archivo demasiado pequeño en ' + candidate);
        continue;
      }

      const metadata = await sharp(buffer, { failOn: 'none' }).metadata();
      if (!metadata.width || !metadata.height) {
        errors.push('imagen inválida en ' + candidate);
        continue;
      }

      return buffer;
    } catch (error) {
      errors.push(error.message + ' en ' + candidate);
    }
  }

  throw new Error(errors.join(' | ') || 'no se pudo descargar la imagen');
}

async function toOptimizedWebp(buffer) {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: IMAGE_WIDTH,
      height: IMAGE_WIDTH,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: IMAGE_QUALITY, effort: 5 })
    .toBuffer();
}

async function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function stableJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function writeTextIfChanged(filePath, content) {
  if (existsSync(filePath)) {
    const current = await readFile(filePath, 'utf8');
    if (current === content) return false;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return true;
}

async function writeJsonIfChanged(filePath, value) {
  return writeTextIfChanged(filePath, stableJson(value));
}

async function syncPropertyImages(row, previousState, report) {
  const id = propertyId(row);
  const previousItems = Array.isArray(previousState?.items) ? previousState.items : [];
  const previousByFile = new Map(previousItems.map(item => [clean(item.file), item]));
  const sources = photoSources(row);
  const nextItems = [];

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const file = index === 0 ? id + '.webp' : id + '-' + index + '.webp';
    const filePath = path.join(imagesDir, file);
    const key = sourceKey(source.url);
    const previous = previousByFile.get(file);

    if (previous && previous.source === key && existsSync(filePath)) {
      nextItems.push(previous);
      report.unchanged += 1;
      continue;
    }

    try {
      const input = await downloadImageBuffer(source.url);
      const output = await toOptimizedWebp(input);
      let written = true;

      if (existsSync(filePath)) {
        const current = await readFile(filePath);
        written = !current.equals(output);
      }

      if (written) await writeFile(filePath, output);
      nextItems.push({ file, source: key, logicalOrder: source.order });
      if (written) report.downloaded += 1;
      else report.unchanged += 1;
    } catch (error) {
      report.errors.push(id + ' · ' + file + ': ' + error.message);
      if (previous && existsSync(filePath)) nextItems.push(previous);
    }
  }

  const nextFiles = new Set(nextItems.map(item => item.file));
  for (const previous of previousItems) {
    const file = clean(previous.file);
    if (!file || nextFiles.has(file)) continue;
    const filePath = path.join(imagesDir, file);
    if (existsSync(filePath)) {
      await unlink(filePath);
      report.deleted += 1;
    }
  }

  return { items: nextItems };
}

async function buildImageManifest(rows, state) {
  const entries = {};
  const hashParts = [];

  for (const row of rows) {
    const id = propertyId(row);
    const items = Array.isArray(state.properties?.[id]?.items)
      ? state.properties[id].items
      : [];
    const files = [];

    for (const item of items) {
      const file = clean(item.file);
      const filePath = path.join(imagesDir, file);
      if (!file || !existsSync(filePath)) continue;
      files.push(file);
      const buffer = await readFile(filePath);
      const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      hashParts.push(file + ':' + digest);
    }

    if (files.length) entries[id] = files;
  }

  const version = createHash('sha256')
    .update(hashParts.sort().join('|'))
    .digest('hex')
    .slice(0, 12);

  return { _version: version || 'empty', ...entries };
}

async function syncImages(rows) {
  await mkdir(imagesDir, { recursive: true });
  const previousState = await readJson(imageStatePath, { schemaVersion: 1, properties: {} });
  const nextProperties = {};
  const report = {
    downloaded: 0,
    unchanged: 0,
    deleted: 0,
    foldersOnly: 0,
    errors: []
  };
  const rowIds = new Set(rows.map(propertyId));

  for (const row of rows) {
    const id = propertyId(row);
    const previous = previousState.properties?.[id] || { items: [] };

    const folder = rowValue(row, 'Carpeta Google Drive');
    if (isDriveFolderUrl(folder) && !photoSources(row).length) report.foldersOnly += 1;
    nextProperties[id] = await syncPropertyImages(row, previous, report);
  }

  for (const [id, previous] of Object.entries(previousState.properties || {})) {
    if (rowIds.has(id)) continue;
    for (const item of previous.items || []) {
      const filePath = path.join(imagesDir, clean(item.file));
      if (clean(item.file) && existsSync(filePath)) {
        await unlink(filePath);
        report.deleted += 1;
      }
    }
  }

  const nextState = { schemaVersion: 1, properties: nextProperties };
  await writeJsonIfChanged(imageStatePath, nextState);
  currentImageManifest = await buildImageManifest(rows, nextState);
  await writeJsonIfChanged(imageManifestPath, currentImageManifest);
  return report;
}

async function loadManualImages() {
  const config = await readJson(manualImagesPath, { schemaVersion: 1, properties: {} });
  manualImages = config && typeof config.properties === 'object'
    ? config.properties
    : {};
}

function propertyImages(row) {
  const id = propertyId(row);
  const version = clean(currentImageManifest._version) || '1';
  const generated = Array.isArray(currentImageManifest[id])
    ? currentImageManifest[id].map(file =>
      '/assets/images/propiedades/' + encodeURIComponent(file) + '?v=' + encodeURIComponent(version)
    )
    : [];
  const manual = Array.isArray(manualImages[id])
    ? manualImages[id]
      .map(clean)
      .filter(Boolean)
      .map(image => '/' + image.replace(/^\.?\//, ''))
    : [];
  return [...new Set([...generated, ...manual])];
}

function absoluteUrl(relative) {
  const value = clean(relative);
  if (/^https?:\/\//i.test(value)) return value;
  return SITE_URL + '/' + value.replace(/^\.?\//, '');
}

function propertyLocation(row) {
  return [
    rowValue(row, 'Barrio / Zona'),
    rowValue(row, 'Localidad')
  ].filter(Boolean).join(', ');
}

function summaryText(row, maxLength = 220) {
  const source = rowValue(row, 'Descripción comercial', 'Descripcion comercial');
  if (!source) {
    return [
      rowValue(row, 'Tipo de propiedad'),
      rowValue(row, 'Operación', 'Operacion'),
      propertyLocation(row)
    ].filter(Boolean).join(' en ');
  }

  const compact = clean(source).replace(/\s+/g, ' ');
  if (compact.length <= maxLength) return compact;
  const sliced = compact.slice(0, maxLength - 1);
  const boundary = sliced.lastIndexOf(' ');
  return (boundary > 80 ? sliced.slice(0, boundary) : sliced) + '…';
}

function isYes(value) {
  const normalized = normalize(value);
  return normalized === 'SI' || normalized === 'SÍ' || normalized === 'YES';
}

function hasNoExpenses(row) {
  const raw = rowValue(row, 'Expensas');
  const value = normalize(raw);
  if (value === 'NO' || value === 'SIN EXPENSAS') return true;
  return /^[$€£]?\s*0(?:[.,]0+)?$/.test(clean(raw));
}

function propertyFacts(row) {
  const facts = [];
  const total = formatArea(rowValue(row, 'Superficie total (m²)', 'Superficie total (m2)'));
  const bedrooms = numberValue(rowValue(row, 'Dormitorios'));
  const bathrooms = numberValue(rowValue(row, 'Baños', 'Banos'));

  if (total) facts.push(total);
  if (bedrooms) facts.push(formatNumber(bedrooms, 0) + (bedrooms === 1 ? ' dormitorio' : ' dormitorios'));
  if (bathrooms) facts.push(formatNumber(bathrooms, 0) + (bathrooms === 1 ? ' baño' : ' baños'));
  if (isYes(rowValue(row, 'Pileta'))) facts.push('Pileta');
  if (hasNoExpenses(row)) facts.push('Sin expensas');

  return facts.slice(0, 3);
}

function propertyTags(row) {
  const tags = [
    rowValue(row, 'Tipo de propiedad'),
    rowValue(row, 'Operación', 'Operacion'),
    rowValue(row, 'Localidad'),
    rowValue(row, 'Barrio / Zona'),
    rowValue(row, 'Servicios disponibles'),
    isYes(rowValue(row, 'Pileta')) ? 'pileta' : '',
    isYes(rowValue(row, 'Jardín / parque', 'Jardin / parque')) ? 'jardin parque' : '',
    hasNoExpenses(row) ? 'sin expensas' : ''
  ];

  const type = normalize(rowValue(row, 'Tipo de propiedad'));
  if (type === 'LOTE') tags.push('terreno lote');
  if (type === 'CASA') tags.push('casa');
  return tags.filter(Boolean).join(' ');
}

function propertySearchText(row) {
  return [
    propertyTitle(row),
    propertyLocation(row),
    rowValue(row, 'Tipo de propiedad'),
    summaryText(row, 600),
    propertyTags(row)
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

function propertyCard(row) {
  const title = propertyTitle(row);
  const location = propertyLocation(row) || rowValue(row, 'Localidad');
  const type = rowValue(row, 'Tipo de propiedad');
  const images = propertyImages(row);
  const imageMarkup = images.length
    ? '<img src="' + escapeAttribute(images[0]) + '" alt="' + escapeAttribute(title) + '" loading="lazy" decoding="async">'
    : '<div class="photo-empty">Fotos próximamente</div>';
  const facts = propertyFacts(row)
    .map(fact => '<span class="fact">' + escapeHtml(fact) + '</span>')
    .join('');
  const status = statusLabel(row);

  return '<article class="property-card" data-search="' +
    escapeAttribute(propertySearchText(row)) +
    '" data-tags="' + escapeAttribute(propertyTags(row)) +
    '"><a href="' + escapeAttribute(propertyRoute(row)) +
    '"><div class="card-media">' + imageMarkup +
    '<span class="tag">' + escapeHtml(type) + '</span>' +
    '<span class="status status-' + slugify(status) + '">' + escapeHtml(status) + '</span>' +
    '</div><div class="card-body"><div class="location">' + escapeHtml(location) +
    '</div><h3>' + escapeHtml(title) + '</h3><div class="facts">' + facts +
    '</div><div class="price-label">Valor</div><div class="price">' +
    escapeHtml(priceInfo(row).label) +
    '</div><div class="card-action"><span>Ver propiedad</span><span class="arrow" aria-hidden="true">→</span>' +
    '</div></div></a></article>';
}

function publicRowsSorted(rows) {
  return rows
    .filter(isPublicProperty)
    .sort((a, b) => {
      const featuredDiff =
        (isYes(rowValue(b, 'Destacada en web')) ? 1 : 0) -
        (isYes(rowValue(a, 'Destacada en web')) ? 1 : 0);
      if (featuredDiff) return featuredDiff;

      const orderA = numberValue(rowValue(a, 'Orden de publicación', 'Orden de publicacion')) || 999999;
      const orderB = numberValue(rowValue(b, 'Orden de publicación', 'Orden de publicacion')) || 999999;
      if (orderA !== orderB) return orderA - orderB;

      return propertyId(a).localeCompare(propertyId(b), 'es', { numeric: true });
    });
}

function replaceMarkedContent(html, markerName, content) {
  const startMarker = '<!-- ' + markerName + '_START -->';
  const endMarker = '<!-- ' + markerName + '_END -->';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);

  if (start === -1 || end === -1 || end < start) return '';
  const contentStart = start + startMarker.length;
  return html.slice(0, contentStart) + '\n' + content.trim() + '\n' + html.slice(end);
}

function injectCatalogIntoGrid(html, markerName, content) {
  const marked = replaceMarkedContent(html, markerName, content);
  if (marked) return marked;

  const gridToken = '<div class="property-grid">';
  const gridStart = html.indexOf(gridToken);
  const emptyStart = html.indexOf('<div class="empty-state"', gridStart);

  if (gridStart === -1 || emptyStart === -1) {
    throw new Error('No se encontró la grilla de propiedades para ' + markerName);
  }

  const insertAt = gridStart + gridToken.length;
  const startMarker = '<!-- ' + markerName + '_START -->';
  const endMarker = '<!-- ' + markerName + '_END -->';
  return html.slice(0, insertAt) + '\n' + startMarker + '\n' + content.trim() +
    '\n' + endMarker + '\n' + html.slice(emptyStart);
}

async function updateCatalogPages(rows) {
  const publicRows = publicRowsSorted(rows);
  const catalogCards = publicRows.length
    ? publicRows.map(propertyCard).join('\n')
    : '';
  const featuredCards = publicRows.length
    ? publicRows.slice(0, 6).map(propertyCard).join('\n')
    : '';

  let indexHtml = await readFile(indexPath, 'utf8');
  indexHtml = injectCatalogIntoGrid(indexHtml, 'SHEET_FEATURED', featuredCards);
  indexHtml = indexHtml.replace(/href=["']\/?propiedades\.html["']/g, 'href="/propiedades/"');
  indexHtml = indexHtml.replace(/Versión V\d+(?:\.\d+)?/g, 'Versión V22');
  await writeTextIfChanged(indexPath, indexHtml);

  let catalogHtml = await readFile(catalogIndexPath, 'utf8');
  catalogHtml = injectCatalogIntoGrid(catalogHtml, 'SHEET_CATALOG', catalogCards);
  catalogHtml = catalogHtml.replace(
    /<span class="count-number">\d+<\/span>/,
    '<span class="count-number">' + publicRows.length + '</span>'
  );
  catalogHtml = catalogHtml
    .replace(/<meta name=["']robots["'][^>]*>/gi, '')
    .replace(/https:\/\/sabrinagigena\.com\/propiedades\.html/g, SITE_URL + '/propiedades/')
    .replace(/href=["']\/?propiedades\.html["']/g, 'href="/propiedades/"')
    .replace(/\b(href|src)=["'](assets\/|favicon\.png|index\.html)/g, '$1="/$2');
  catalogHtml = catalogHtml.replace(/Versión V\d+(?:\.\d+)?/g, 'Versión V22');
  await writeTextIfChanged(catalogIndexPath, catalogHtml);

}

function specificationItems(row) {
  const specs = [];
  const add = (label, value) => {
    if (clean(value)) specs.push({ label, value });
  };

  add('Superficie total', formatArea(rowValue(row, 'Superficie total (m²)', 'Superficie total (m2)')));
  add('Superficie cubierta', formatArea(rowValue(row, 'Superficie cubierta (m²)', 'Superficie cubierta (m2)')));
  add('Superficie libre', formatArea(rowValue(row, 'Superficie libre (m²)', 'Superficie libre (m2)')));

  const numericSpecs = [
    ['Ambientes', 'Ambientes'],
    ['Dormitorios', 'Dormitorios'],
    ['Baños', 'Baños'],
    ['Cocheras', 'Cocheras'],
    ['Plantas', 'Plantas']
  ];

  for (const [label, field] of numericSpecs) {
    const number = numberValue(rowValue(row, field));
    if (number) add(label, formatNumber(number, 0));
  }

  const age = numberValue(rowValue(row, 'Antigüedad (años)', 'Antiguedad (anos)'));
  if (age) add('Antigüedad', formatNumber(age, 0) + ' años');
  add('Estado general', rowValue(row, 'Estado general'));

  const expenses = rowValue(row, 'Expensas');
  if (expenses) add('Expensas', hasNoExpenses(row) ? 'Sin expensas' : expenses);
  return specs;
}

function featureText(row) {
  const features = [];
  const booleanFields = [
    ['Cocina', 'Cocina'],
    ['Living / comedor', 'Living / comedor'],
    ['Jardín / parque', 'Jardín / parque'],
    ['Pileta', 'Pileta'],
    ['Quincho / parrilla', 'Quincho / parrilla']
  ];

  for (const [label, field] of booleanFields) {
    if (isYes(rowValue(row, field))) features.push(label);
  }

  const services = rowValue(row, 'Servicios disponibles');
  if (services) features.push('Servicios: ' + services);
  return features.join(' · ');
}

function siteHeader() {
  return '<div class="topbar" aria-hidden="true"><div class="topbar-track">' +
    '<span>CAPILLA DEL SEÑOR</span><span>CAMPANA</span><span>PAVÓN</span>' +
    '<span>PARQUE SAKURA</span><span>EXALTACIÓN DE LA CRUZ</span><span>CONSULTAS POR WHATSAPP</span>' +
    '</div></div><header class="site-header"><div class="container header-inner">' +
    '<a class="brand" href="/index.html" aria-label="' + SITE_NAME + '">' +
    '<span class="brand-mark"><img src="/favicon.png" alt=""></span><span class="brand-copy">' +
    '<strong>Sabrina Gigena</strong><small>Servicios Inmobiliarios</small></span></a>' +
    '<button class="menu-btn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="site-nav">' +
    '<span></span><span></span><span></span></button><nav class="nav" id="site-nav" aria-label="Navegación principal">' +
    '<a href="/index.html">Inicio</a><a class="active" href="/propiedades/" aria-current="page">Propiedades</a>' +
    '<a href="/index.html#servicios">Servicios</a><a class="header-cta" href="https://wa.me/' +
    CONTACT_WHATSAPP + '?text=Hola%20Sabrina%2C%20quiero%20hacer%20una%20consulta%20inmobiliaria" ' +
    'target="_blank" rel="noopener noreferrer">Consultar</a></nav></div></header>';
}

function siteFooter() {
  return '<footer class="footer"><div class="container"><div class="footer-grid"><div>' +
    '<a class="brand footer-brand" href="/index.html"><span class="brand-mark"><img src="/favicon.png" alt=""></span>' +
    '<span class="brand-copy"><strong>Sabrina Gigena</strong><small>Servicios Inmobiliarios</small></span></a>' +
    '<p>Servicios inmobiliarios con foco en Capilla del Señor, Campana, Pavón, Parque Sakura y Exaltación de la Cruz.</p>' +
    '</div><div><h4>Navegación</h4><div class="footer-links"><a href="/index.html">Inicio</a>' +
    '<a href="/propiedades/">Propiedades</a><a href="/index.html#servicios">Servicios</a></div></div>' +
    '<div><h4>Contacto</h4><div class="footer-links"><a href="tel:+5492304567715">' + CONTACT_PHONE + '</a>' +
    '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>' +
    '<a href="https://wa.me/' + CONTACT_WHATSAPP + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
    '<a href="https://www.instagram.com/sabrina_gigena_inmobiliaria/" target="_blank" rel="noopener noreferrer">Instagram</a>' +
    '<a href="https://www.facebook.com/profile.php?id=61579988094625" target="_blank" rel="noopener noreferrer">Facebook</a>' +
    '</div></div></div><div class="copyright">© 2026 ' + SITE_NAME + '. · Versión V22</div></div></footer>';
}

function propertySchema(row, canonical, images) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateAgent',
        '@id': SITE_URL + '/#business',
        name: SITE_NAME,
        url: SITE_URL,
        telephone: CONTACT_PHONE,
        email: CONTACT_EMAIL
      },
      {
        '@type': 'WebPage',
        '@id': canonical + '#webpage',
        url: canonical,
        name: propertyTitle(row) + ' | ' + SITE_NAME,
        description: summaryText(row, 300),
        about: {
          '@type': 'Place',
          name: propertyTitle(row),
          image: images.map(absoluteUrl),
          address: {
            '@type': 'PostalAddress',
            streetAddress: rowValue(row, 'Dirección', 'Direccion'),
            addressLocality: rowValue(row, 'Localidad'),
            addressRegion: 'Buenos Aires',
            addressCountry: 'AR'
          }
        },
        isPartOf: { '@id': SITE_URL + '/#website' }
      },
      {
        '@type': 'WebSite',
        '@id': SITE_URL + '/#website',
        url: SITE_URL,
        name: SITE_NAME
      }
    ]
  };
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}

function heroGallery(title, images) {
  if (!images.length) {
    return '<div class="gallery-hero is-empty"><div class="gallery-empty">Fotos próximamente</div></div>';
  }

  const main = '<img class="gallery-main" src="' + escapeAttribute(images[0]) + '" alt="' +
    escapeAttribute(title) + '" data-lightbox fetchpriority="high">';
  const sideImages = images.slice(1, 3)
    .map((image, index) => '<img src="' + escapeAttribute(image) + '" alt="' +
      escapeAttribute(title + ' · foto ' + (index + 2)) +
      '" data-lightbox loading="lazy" decoding="async">')
    .join('');
  const side = sideImages ? '<div class="gallery-side">' + sideImages + '</div>' : '';
  return '<div class="gallery-hero' + (side ? '' : ' is-single') + '">' + main + side + '</div>';
}

function detailGallery(title, images) {
  const galleryImages = images.slice(3);
  if (!galleryImages.length) return '';

  const items = galleryImages
    .map((image, index) => '<img src="' + escapeAttribute(image) + '" alt="' +
      escapeAttribute(title + ' · foto ' + (index + 4)) +
      '" loading="lazy" decoding="async" data-lightbox>')
    .join('');

  return '<section class="content-block gallery-block"><div class="content-head"><div>' +
    '<span class="eyebrow">Imágenes</span><h2>Galería</h2></div><span class="gallery-count">' +
    galleryImages.length + (galleryImages.length === 1 ? ' foto' : ' fotos') +
    '</span></div><div class="detail-gallery">' + items + '</div></section>';
}

function contentSections(row) {
  const sections = [];
  const description = rowValue(row, 'Descripción comercial', 'Descripcion comercial');

  if (description) {
    const paragraphs = description
      .split(/\n+/)
      .map(clean)
      .filter(Boolean)
      .map(paragraph => '<p>' + escapeHtml(paragraph) + '</p>')
      .join('');
    sections.push('<section class="content-block"><h2>Descripción</h2>' + paragraphs + '</section>');
  }

  const features = featureText(row);
  if (features) {
    sections.push('<section class="content-block"><h2>Características y servicios</h2><p>' +
      escapeHtml(features) + '</p></section>');
  }

  const address = rowValue(row, 'Dirección', 'Direccion');
  const location = propertyLocation(row);
  const mapUrl = rowValue(row, 'Link Google Maps');
  if (address || location || mapUrl) {
    let locationHtml = '<p>' + escapeHtml([address, location].filter(Boolean).join(' · ')) + '</p>';
    if (mapUrl) {
      locationHtml += '<p><a class="text-link" href="' + escapeAttribute(mapUrl) +
        '" target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps →</a></p>';
    }
    sections.push('<section class="content-block"><h2>Ubicación</h2>' + locationHtml + '</section>');
  }

  return sections.join('');
}

function archivedLabel(row) {
  return isSoldProperty(row) ? 'Vendida' : 'Fuera de publicación';
}

function contactCard(row, archived = false) {
  const title = propertyTitle(row);
  const message = archived
    ? 'Hola Sabrina, vi la propiedad ' + title + ' (' + propertyId(row) +
      ') y quiero conocer opciones similares disponibles.'
    : 'Hola Sabrina, quiero consultar por ' + title + ' (' + propertyId(row) + ').';
  const whatsapp = 'https://wa.me/' + CONTACT_WHATSAPP + '?text=' + encodeURIComponent(message);
  const heading = archived ? 'Encontrá una alternativa' : '¿Querés conocerla?';
  const description = archived
    ? 'Esta propiedad ya no está disponible. Escribime y buscamos opciones similares según tu necesidad.'
    : 'Escribime para verificar disponibilidad, recibir información adicional o coordinar una visita.';
  const buttonLabel = archived ? 'Consultar por opciones similares' : 'Consultar por WhatsApp';

  return '<aside class="contact-card"><div class="contact-person"><span class="contact-person-photo">' +
    '<img src="/assets/images/sabrina-gigena-persona.webp" alt="Sabrina Gigena" loading="lazy"></span>' +
    '<span><strong>Sabrina Gigena</strong><small>Asesoramiento inmobiliario</small></span></div>' +
    '<span class="eyebrow">Consulta directa</span><h3>' + escapeHtml(heading) + '</h3>' +
    '<p>' + escapeHtml(description) + '</p>' +
    '<a class="btn" href="' + escapeAttribute(whatsapp) + '" target="_blank" rel="noopener noreferrer">' +
    escapeHtml(buttonLabel) + '</a><div class="contact-mini"><a href="tel:+5492304567715">' + CONTACT_PHONE + '</a>' +
    '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a></div></aside>';
}

function similarProperties(row, activeRows, limit = 3) {
  const type = normalize(rowValue(row, 'Tipo de propiedad'));
  const locality = normalize(rowValue(row, 'Localidad'));
  const zone = normalize(rowValue(row, 'Barrio / Zona'));

  return activeRows
    .filter(candidate => propertyId(candidate) !== propertyId(row))
    .map(candidate => {
      let score = 0;
      if (normalize(rowValue(candidate, 'Tipo de propiedad')) === type) score += 4;
      if (normalize(rowValue(candidate, 'Localidad')) === locality) score += 3;
      if (zone && normalize(rowValue(candidate, 'Barrio / Zona')) === zone) score += 2;
      return { candidate, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return propertyId(a.candidate).localeCompare(propertyId(b.candidate), 'es', { numeric: true });
    })
    .slice(0, limit)
    .map(item => item.candidate);
}

function similarPropertiesSection(row, activeRows) {
  const rows = similarProperties(row, activeRows);
  if (!rows.length) {
    return '<section class="content-block similar-properties"><span class="eyebrow">Alternativas</span>' +
      '<h2>Consultanos por propiedades similares</h2>' +
      '<p>El catálogo cambia con frecuencia. Sabrina puede ayudarte a encontrar una opción equivalente.</p></section>';
  }

  return '<section class="content-block similar-properties"><div class="content-head"><div>' +
    '<span class="eyebrow">Alternativas disponibles</span><h2>Propiedades similares</h2></div>' +
    '<a class="text-link" href="/propiedades/">Ver catálogo completo →</a></div>' +
    '<div class="property-grid">' + rows.map(propertyCard).join('') + '</div></section>';
}

function propertyPageHtml(row, activeRows = []) {
  const title = propertyTitle(row);
  const images = propertyImages(row);
  const archived = !isPublicProperty(row);
  const archiveStatus = archivedLabel(row);
  const canonical = SITE_URL + propertyRoute(row);
  const baseDescription = summaryText(row, 155);
  const metaDescription = archived
    ? archiveStatus + ': ' + baseDescription
    : baseDescription;
  const ogImage = images.length
    ? absoluteUrl(images[0])
    : SITE_URL + '/assets/images/favicon.png';
  const specs = specificationItems(row)
    .map(item => '<div class="spec"><strong>' + escapeHtml(item.value) +
      '</strong><span>' + escapeHtml(item.label) + '</span></div>')
    .join('');
  const price = priceInfo(row).label;
  const pageTitle = archived
    ? archiveStatus + ' · ' + title
    : title;
  const locationType = [
    propertyLocation(row),
    rowValue(row, 'Tipo de propiedad')
  ].filter(Boolean).join(' · ');

  return [
    '<!doctype html><html lang="es-AR"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="theme-color" content="#071b26"><meta name="color-scheme" content="dark">',
    archived ? '<meta name="robots" content="noindex,nofollow,noarchive">' : '',
    '<link rel="icon" href="/favicon.png" type="image/png"><link rel="stylesheet" href="/assets/css/site.css">',
    '<title>' + escapeHtml(pageTitle) + ' | Sabrina Gigena Inmobiliaria</title>',
    '<meta name="description" content="' + escapeAttribute(metaDescription) + '">',
    '<link rel="canonical" href="' + escapeAttribute(canonical) + '">',
    '<meta property="og:type" content="website"><meta property="og:locale" content="es_AR">',
    '<meta property="og:site_name" content="' + SITE_NAME + '">',
    '<meta property="og:title" content="' + escapeAttribute(pageTitle + ' | Sabrina Gigena Inmobiliaria') + '">',
    '<meta property="og:description" content="' + escapeAttribute(metaDescription) + '">',
    '<meta property="og:url" content="' + escapeAttribute(canonical) + '">',
    '<meta property="og:image" content="' + escapeAttribute(ogImage) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escapeAttribute(pageTitle + ' | Sabrina Gigena Inmobiliaria') + '">',
    '<meta name="twitter:description" content="' + escapeAttribute(metaDescription) + '">',
    '<meta name="twitter:image" content="' + escapeAttribute(ogImage) + '">',
    '<script type="application/ld+json">' + propertySchema(row, canonical, images) + '</script>',
    '</head><body class="property-page' + (archived ? ' is-archived' : '') +
      '" data-property-id="' + escapeAttribute(propertyId(row)) + '">',
    siteHeader(),
    '<main><section class="detail-hero"><div class="container">',
    '<div class="property-nav-row"><button class="back-button" type="button" data-back-button>' +
      '<span aria-hidden="true">←</span> Volver</button><nav class="breadcrumbs" aria-label="Migas de pan">' +
      '<a href="/index.html">Inicio</a><span>/</span><a href="/propiedades/">Propiedades</a>' +
      '<span>/</span><span aria-current="page">' + escapeHtml(title) + '</span></nav></div>',
    heroGallery(title, images),
    '</div></section><section class="property-detail"><div class="container detail-layout"><article class="detail-main">',
    '<header class="detail-title">' +
      (archived
        ? '<div class="sold-alert" role="status"><strong>' + escapeHtml(archiveStatus) +
          '</strong><span>Esta propiedad ya no forma parte del catálogo disponible.</span></div>'
        : '') +
      '<div class="location">' + escapeHtml(locationType) + '</div><h1>' +
      escapeHtml(title) + '</h1><p class="lead">' + escapeHtml(summaryText(row, 320)) +
      '</p><div class="detail-price">' + escapeHtml(archived ? archiveStatus : price) + '</div>' +
      (archived && price !== 'Consultar valor'
        ? '<p class="historic-price">Último valor publicado: ' + escapeHtml(price) + '</p>'
        : '') +
      '</header>',
    specs ? '<div class="spec-grid">' + specs + '</div>' : '',
    contentSections(row),
    detailGallery(title, images),
    archived ? similarPropertiesSection(row, activeRows) : '',
    '</article>',
    contactCard(row, archived),
    '</div></section></main>',
    '<div class="lightbox" role="dialog" aria-modal="true" aria-label="Galería ampliada" aria-hidden="true">' +
      '<button class="lightbox-close" type="button" aria-label="Cerrar">×</button>' +
      '<button class="lightbox-prev" type="button" aria-label="Imagen anterior">‹</button>' +
      '<img alt="Imagen ampliada"><button class="lightbox-next" type="button" aria-label="Imagen siguiente">›</button></div>',
    siteFooter(),
    '<a class="wa-float" href="https://wa.me/' + CONTACT_WHATSAPP +
      '?text=' + encodeURIComponent(archived
        ? 'Hola Sabrina, vi ' + title + ' (' + propertyId(row) + ') y quiero opciones similares.'
        : 'Hola Sabrina, quiero consultar por ' + title + ' (' + propertyId(row) + ').') +
      '" target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp">WhatsApp</a>',
    '<script src="/assets/js/main.js" defer></script></body></html>'
  ].join('\n') + '\n';
}

function normalizedGeneratedPath(file) {
  return clean(file).replace(/\\/g, '/').replace(/^\.\//, '');
}

function isSafeGeneratedPath(file) {
  const normalized = normalizedGeneratedPath(file);
  return /^propiedad-[a-z0-9-]+\.html$/.test(normalized) ||
    /^(?:propiedades|propiedades-no-index)\/[a-z0-9-]+\/index\.html$/.test(normalized);
}

async function generatePropertyPages(rows, archiveRows) {
  const publicRows = publicRowsSorted(rows);
  const previous = await readJson(generatedPagesPath, { schemaVersion: 1, files: [] });
  const desired = new Set();

  for (const row of publicRows) {
    const file = normalizedGeneratedPath(propertyOutputPath(row));
    desired.add(file);
    await writeTextIfChanged(path.join(repoRoot, file), propertyPageHtml(row, publicRows));
  }

  for (const row of archiveRows) {
    const publicFile = normalizedGeneratedPath(propertyOutputPath(row));
    const archiveFile = normalizedGeneratedPath(archivedPropertyOutputPath(row));
    const html = propertyPageHtml(row, publicRows);

    desired.add(publicFile);
    desired.add(archiveFile);
    await writeTextIfChanged(path.join(repoRoot, publicFile), html);
    await writeTextIfChanged(path.join(repoRoot, archiveFile), html);
  }

  for (const file of previous.files || []) {
    const safeFile = normalizedGeneratedPath(file);
    if (!safeFile || desired.has(safeFile)) continue;
    if (!isSafeGeneratedPath(safeFile)) continue;
    const filePath = path.join(repoRoot, safeFile);
    if (existsSync(filePath)) await unlink(filePath);
  }

  await writeJsonIfChanged(generatedPagesPath, {
    schemaVersion: 2,
    files: [...desired].sort(),
    activeRoutes: publicRows.map(propertyRoute),
    archivedRoutes: archiveRows.map(archivedPropertyRoute)
  });

  return { publicRows, archiveRows };
}

function sitemapXml(rows, generatedAt) {
  const lastmod = generatedAt
    ? new Date(generatedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const staticUrls = [
    { loc: SITE_URL + '/', priority: '1.0', changefreq: 'daily' },
    { loc: SITE_URL + '/propiedades/', priority: '0.9', changefreq: 'daily' }
  ];
  const propertyUrls = rows.map(row => ({
    loc: SITE_URL + propertyRoute(row),
    priority: '0.8',
    changefreq: 'daily',
    title: propertyTitle(row),
    images: propertyImages(row).map(absoluteUrl)
  }));
  const items = [...staticUrls, ...propertyUrls];

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    items.map(item =>
      '  <url>\n' +
      '    <loc>' + escapeXml(item.loc) + '</loc>\n' +
      '    <lastmod>' + lastmod + '</lastmod>\n' +
      '    <changefreq>' + item.changefreq + '</changefreq>\n' +
      '    <priority>' + item.priority + '</priority>' +
      (Array.isArray(item.images)
        ? item.images.map(image =>
          '\n    <image:image>\n' +
          '      <image:loc>' + escapeXml(image) + '</image:loc>\n' +
          '      <image:title>' + escapeXml(item.title || SITE_NAME) + '</image:title>\n' +
          '    </image:image>'
        ).join('')
        : '') +
      '\n  </url>'
    ).join('\n') +
    '\n</urlset>\n';
}

async function writeRobots() {
  const content = 'User-agent: *\n' +
    'Allow: /\n' +
    'Disallow: /metricas/\n' +
    'Disallow: /visor/\n\n' +
    'Sitemap: ' + SITE_URL + '/sitemap.xml\n';
  await writeTextIfChanged(robotsPath, content);
}

async function loadCsvText() {
  const fixture = process.env.PROPERTIES_CSV_FILE;
  if (fixture) return readFile(path.resolve(fixture), 'utf8');

  const separator = CSV_URL.includes('?') ? '&' : '?';
  const url = CSV_URL + separator + '_=' + Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: {
      'user-agent': 'Sabrina-Gigena-Catalog-Sync/1.0',
      accept: 'text/csv,text/plain;q=0.9,*/*;q=0.1'
    }
  });

  if (!response.ok) {
    throw new Error('Google Sheets respondió HTTP ' + response.status);
  }

  const text = await response.text();
  const compact = text.slice(0, 5000);
  if (!text || !compact.includes('ID') || !compact.includes('Estado')) {
    throw new Error('La respuesta no parece ser el CSV esperado. Verificá que el Sheet siga publicado para lectura.');
  }
  return text;
}

function hashRows(rows) {
  return createHash('sha256')
    .update(JSON.stringify(rows))
    .digest('hex');
}

function buildArchiveState(rows, previousStockRows, previousState) {
  const now = new Date().toISOString();
  const currentById = new Map(rows.map(row => [propertyId(row), row]));
  const archiveById = new Map(
    (previousState?.rows || [])
      .map(row => [propertyId(row), row])
      .filter(([id]) => id)
  );

  for (const row of rows) {
    const id = propertyId(row);
    if (isPublicProperty(row)) {
      archiveById.delete(id);
      continue;
    }

    const previous = archiveById.get(id);
    archiveById.set(id, {
      ...row,
      _archivedAt: previous?._archivedAt || now,
      _archiveReason: statusLabel(row) || 'Fuera de publicación'
    });
  }

  for (const previousRow of previousStockRows || []) {
    const id = propertyId(previousRow);
    if (!id || currentById.has(id) || archiveById.has(id)) continue;

    archiveById.set(id, {
      ...previousRow,
      Estado: isPublicProperty(previousRow)
        ? 'Pausada'
        : (rowValue(previousRow, 'Estado') || 'Pausada'),
      _archivedAt: now,
      _archiveReason: 'Retirada del catálogo'
    });
  }

  const archiveRows = [...archiveById.values()]
    .sort((a, b) => propertyId(a).localeCompare(propertyId(b), 'es', { numeric: true }));
  const contentHash = hashRows(archiveRows);
  const unchanged = previousState?.contentHash === contentHash;

  return {
    schemaVersion: 1,
    updatedAt: unchanged && previousState?.updatedAt ? previousState.updatedAt : now,
    rowCount: archiveRows.length,
    contentHash,
    rows: archiveRows
  };
}

function rowsForImageSync(rows, archiveRows) {
  const byId = new Map(archiveRows.map(row => [propertyId(row), row]));
  for (const row of rows) byId.set(propertyId(row), row);
  return [...byId.values()];
}

async function main() {
  const csvText = await loadCsvText();
  const rows = validateRows(parseCSV(csvText));
  const contentHash = hashRows(rows);
  const existing = await readJson(stockPath, null);
  const previousArchive = await readJson(archivedPropertiesPath, {
    schemaVersion: 1,
    rows: []
  });
  const archiveState = buildArchiveState(
    rows,
    Array.isArray(existing?.rows) ? existing.rows : [],
    previousArchive
  );
  const sameStock = Boolean(
    existing &&
    existing.contentHash === contentHash &&
    Array.isArray(existing.rows) &&
    existing.rows.length === rows.length
  );
  const generatedAt = sameStock && existing.generatedAt
    ? existing.generatedAt
    : new Date().toISOString();

  if (!sameStock) {
    await writeJsonIfChanged(stockPath, {
      schemaVersion: 1,
      generatedAt,
      source: CSV_URL,
      spreadsheetId: '1Q58K5bHQQWj4rjAZlN9cNZ9LgbY7oj_If36COOmDnsI',
      sheetGid: '779453685',
      rowCount: rows.length,
      contentHash,
      rows
    });
  }

  await writeJsonIfChanged(archivedPropertiesPath, archiveState);
  await loadManualImages();
  const imageReport = await syncImages(rowsForImageSync(rows, archiveState.rows));
  const generation = await generatePropertyPages(rows, archiveState.rows);
  const publicRows = generation.publicRows;
  await updateCatalogPages(rows);
  await writeTextIfChanged(sitemapPath, sitemapXml(publicRows, generatedAt));
  await writeRobots();

  console.log(sameStock
    ? 'Catálogo sin cambios: ' + rows.length + ' filas válidas.'
    : 'Catálogo actualizado: ' + rows.length + ' filas válidas.'
  );
  console.log('Propiedades públicas generadas: ' + publicRows.length + '.');
  console.log('Propiedades no index conservadas: ' + archiveState.rowCount + '.');
  console.log(
    'Imágenes: ' + imageReport.downloaded + ' nuevas/actualizadas · ' +
    imageReport.unchanged + ' sin cambios · ' +
    imageReport.deleted + ' eliminadas.'
  );

  if (imageReport.foldersOnly) {
    console.warn(
      'Aviso: ' + imageReport.foldersOnly +
      ' propiedad(es) tienen solamente una carpeta de Drive. ' +
      'Agregá enlaces individuales en Imagen principal, Foto 2, Foto 3...'
    );
  }

  if (imageReport.errors.length) {
    console.warn('Advertencias de imágenes (' + imageReport.errors.length + '):');
    imageReport.errors.forEach(message => console.warn('- ' + message));
  }

  console.log('Manifest de imágenes: ' + (clean(currentImageManifest._version) || 'empty') + '.');
  console.log('Hash del catálogo: ' + contentHash.slice(0, 12));
}

main().catch(error => {
  console.error('ERROR: ' + error.message);
  process.exitCode = 1;
});
