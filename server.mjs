import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_HTML_BYTES = 6 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const previewRequests = new Map();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; img-src 'self' https: data:; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

function clientAddress(request) {
  return String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function withinPreviewLimit(request) {
  const now = Date.now();
  const key = clientAddress(request);
  const recent = (previewRequests.get(key) || []).filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    previewRequests.set(key, recent);
    return false;
  }
  recent.push(now);
  previewRequests.set(key, recent);
  if (previewRequests.size > 1000) {
    for (const [address, times] of previewRequests) {
      if (!times.some(time => now - time < RATE_LIMIT_WINDOW_MS)) previewRequests.delete(address);
    }
  }
  return true;
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const value = address.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
}

async function validateRemoteUrl(input) {
  const match = String(input || '').match(/https?:\/\/[^\s<>"']+/i);
  if (!match) throw new Error('No product link was found in the shared text.');
  const cleaned = match[0].replace(/[),.;!?\]}]+$/g, '');
  const url = new URL(cleaned);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https product links are supported.');
  if (url.username || url.password) throw new Error('Links containing credentials are not supported.');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Local links are not supported.');
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(entry => isPrivateIp(entry.address))) throw new Error('This link cannot be accessed.');
  return url;
}

async function fetchProductPage(input) {
  let url = await validateRemoteUrl(input);
  for (let redirects = 0; redirects < 8; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache'
      }
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = await validateRemoteUrl(new URL(response.headers.get('location'), url).href);
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new Error('This store blocked automatic reading. Add the details manually, or try the product’s share link.');
    }
    if (!response.ok) throw new Error(`The product page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('This link is not an HTML product page.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_HTML_BYTES) throw new Error('This product page is too large to preview.');
    return { html: buffer.toString('utf8'), finalUrl: url };
  }
  throw new Error('The product link redirected too many times.');
}

function decodeHtml(value = '') {
  return value.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function metadata(html) {
  const values = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !values[key]) values[key] = decodeHtml(attrs.content);
  }
  return values;
}

function findProductJson(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findProductJson(item); if (found) return found; }
    return null;
  }
  const type = value['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return value;
  for (const child of Object.values(value)) {
    const found = findProductJson(child);
    if (found) return found;
  }
  return null;
}

function productJsonLd(html) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = decodeHtml(match[1].trim()).replace(/^<!--|-->$/g, '').replace(/;\s*$/, '');
      const product = findProductJson(JSON.parse(json));
      if (product) return product;
    } catch {}
  }
  return null;
}

function itemPropValue(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<[^>]+itemprop=["']${escaped}["'][^>]*>`, 'i'))?.[0];
  if (!tag) return null;
  const attrs = attributes(tag);
  return decodeHtml(attrs.content || attrs.href || attrs.src || '');
}

function firstImage(image) {
  const value = Array.isArray(image) ? image[0] : image;
  return typeof value === 'string' ? value : value?.url || value?.contentUrl || null;
}

function firstOffer(offers) {
  if (Array.isArray(offers)) return offers[0] || {};
  return offers || {};
}


function offerPrice(offer) {
  const specification = Array.isArray(offer.priceSpecification) ? offer.priceSpecification[0] : offer.priceSpecification;
  return offer.price ?? offer.lowPrice ?? specification?.price ?? specification?.minPrice;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const cleaned = String(value).replace(/[^0-9.,-]/g, '');
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function amazonFallback(html) {
  const imageTag = html.match(/<img\b[^>]*id=["']landingImage["'][^>]*>/i)?.[0];
  const imageAttrs = imageTag ? attributes(imageTag) : {};
  let image = imageAttrs['data-old-hires'] || imageAttrs.src || null;
  if (!image && imageAttrs['data-a-dynamic-image']) {
    try { image = Object.keys(JSON.parse(decodeHtml(imageAttrs['data-a-dynamic-image'])))[0] || null; } catch {}
  }

  const corePrice = html.match(/id=["']corePrice_feature_div["'][\s\S]{0,12000}/i)?.[0] || '';
  const whole = corePrice.match(/a-price-whole["'][^>]*>\s*([0-9,]+)/i)?.[1];
  const fraction = corePrice.match(/a-price-fraction["'][^>]*>\s*([0-9]{1,2})/i)?.[1] || '00';
  const symbol = corePrice.match(/a-price-symbol["'][^>]*>\s*([^<]+)/i)?.[1];
  const price = whole ? parsePrice(`${whole}.${fraction}`) : null;
  const currency = symbol?.includes('$') ? 'USD' : null;
  return { image, price, currency };
}

function extractProduct(html, finalUrl) {
  const meta = metadata(html);
  const product = productJsonLd(html) || {};
  const offer = firstOffer(product.offers);
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const name = decodeHtml(product.name || meta['og:title'] || meta['twitter:title'] || itemPropValue(html, 'name') || titleMatch?.[1] || '');
  const siteData = finalUrl.hostname.endsWith('amazon.com') ? amazonFallback(html) : {};
  const imageValue = firstImage(product.image) || meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || itemPropValue(html, 'image') || siteData.image || null;
  const image = imageValue ? new URL(imageValue, finalUrl).href : null;
  const rawPrice = offerPrice(offer) ?? product.price ?? meta['product:price:amount'] ?? meta['og:price:amount'] ?? itemPropValue(html, 'price');
  const price = parsePrice(rawPrice) ?? siteData.price ?? null;
  const currency = offer.priceCurrency || offer.priceSpecification?.priceCurrency || meta['product:price:currency'] || meta['og:price:currency'] || itemPropValue(html, 'priceCurrency') || siteData.currency || null;
  if (!name && !image) throw new Error('No product name or image was found on this page.');
  return { name: name || null, image, price, currency, url: finalUrl.href };
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10000) throw new Error('Request is too large.');
  }
  return JSON.parse(body || '{}');
}

function sendJson(response, status, value) {
  response.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, 'http://localhost');
  const pathname = requestUrl.pathname === '/' ? '/wishlist.html' : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) return sendJson(response, 403, { error: 'Forbidden.' });
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
    const content = await readFile(filePath);
    response.writeHead(200, { ...SECURITY_HEADERS, 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: 'Not found.' });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/api/product-preview') {
      if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
      if (!withinPreviewLimit(request)) {
        response.setHeader('retry-after', '60');
        return sendJson(response, 429, { error: 'Too many product lookups. Please wait a minute and try again.' });
      }
      const { url } = await readJson(request);
      if (!url) return sendJson(response, 400, { error: 'Paste a product link first.' });
      const page = await fetchProductPage(url);
      return sendJson(response, 200, extractProduct(page.html, page.finalUrl));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed.' });
    return serveStatic(request, response);
  } catch (error) {
    const message = error.name === 'TimeoutError' ? 'The product page took too long to respond.' : error.message || 'Product details could not be retrieved.';
    sendJson(response, 422, { error: message });
  }
});

server.listen(PORT, HOST, () => console.log(`Waitlist running at http://localhost:${PORT}/wishlist.html`));
