/**
 * Responsive image URLs.
 *
 * The catalogue holds three kinds of image and they need three different
 * treatments, so this module keys off what the URL actually is rather than
 * asking a caller to say.
 *
 * 1. **Our own uploads** (`/media/products/{seller}/{uuid}@{width}w.webp`)
 *    The API writes a rendition ladder at upload time and encodes the width in
 *    the filename -- see `app/storage/local.py`. That is deliberate: it lets a
 *    srcSet be built from one stored URL by rewriting the `@<w>w` token, with
 *    no manifest lookup and no per-image database row. The trade is that the
 *    ladder is only correct if the frontend knows which widths exist, so
 *    `VARIANT_WIDTHS` below mirrors `IMAGE_VARIANT_WIDTHS` in `app/config.py`
 *    and `applyUploadConfig()` re-syncs it from `GET /api/uploads/config`.
 *
 * 2. **Unsplash** (`images.unsplash.com`)
 *    Verified to honour `w`, `q` and `fm=webp`. Worth a real srcSet: a 400w
 *    WebP came back at 13.6 kB against 42 kB for the 800w JPEG the components
 *    used to hardcode.
 *
 * 3. **Everything else** -- notably `cdn.dummyjson.com`, which serves all
 *    10,057 seeded product photos. Measured: `?w=200` returns byte-identical
 *    output to the unsized URL. Emitting a srcSet there would make the browser
 *    download the same 63 kB file five times to save nothing, so `srcSet` is
 *    deliberately `null` and the single `src` is used.
 *
 * Everything degrades to a plain `src`. A missing srcSet costs bandwidth; a
 * wrong one costs a broken image.
 */

import api from '../services/api';

/**
 * Must match `IMAGE_VARIANT_WIDTHS` in `backend-core-py/app/config.py`.
 * Kept as a literal rather than only fetched, because the catalogue renders
 * before the config request resolves, and a grid of single-candidate images on
 * first paint is a worse regression than a stale width list.
 */
export const VARIANT_WIDTHS = [200, 400, 800, 1200, 1600];

/** Hosts that resize on a query parameter. Verified, not assumed. */
const PARAMETRIC_HOSTS = {
  'images.unsplash.com': (url, width) => {
    const next = new URL(url);
    next.searchParams.set('w', String(width));
    // WebP at the same visual quality is roughly a third of the JPEG bytes.
    // `fm` rather than `auto`: `auto` also negotiates format via Accept, and
    // a srcSet that changes format per candidate makes the comparison the
    // browser prints misleading.
    next.searchParams.set('fm', 'webp');
    next.searchParams.set('q', '75');
    return next.toString();
  }
};

/** Our rendition filename: `{stem}@{width}w.{ext}`. */
const VARIANT_RE = /@(\d+)w(\.[a-z0-9]+)$/i;

let variantWidths = VARIANT_WIDTHS;

/**
 * Re-sync the known ladder from the API.
 *
 * Called once at startup. If the backend ever changes `IMAGE_VARIANT_WIDTHS`,
 * the frontend follows instead of emitting a srcSet full of 404s -- which is
 * the failure mode of hardcoding the list alone.
 */
export async function applyUploadConfig() {
  try {
    const response = await api.get('/uploads/config');
    const widths = response.data?.data?.variant_widths;
    if (Array.isArray(widths) && widths.length > 0) {
      variantWidths = [...widths].sort((a, b) => a - b);
    }
  } catch {
    // A catalogue page must not depend on this succeeding. The defaults are
    // the same numbers the backend ships with.
  }
  return variantWidths;
}

export const currentVariantWidths = () => variantWidths;

/** True for a URL this app stored, whose width is recoverable from the name. */
export function isRenditionUrl(url) {
  if (typeof url !== 'string') return false;
  if (!url.includes('/media/')) return false;
  return VARIANT_RE.test(url.split('/').pop() || '');
}

function renditionsFor(url) {
  const match = VARIANT_RE.exec(url.split('/').pop() || '');
  if (!match) return null;
  const masterWidth = Number(match[1]);
  const extension = match[2];
  const base = url.replace(VARIANT_RE, '');
  // Only widths the API actually wrote, and never wider than the master:
  // asking for a 2000w rendition of a 1600w master would 404.
  return variantWidths.filter((width) => width <= masterWidth).map((width) => ({
    width,
    url: `${base}@${width}w${extension}`
  }));
}

function hostOf(url) {
  try {
    return new URL(url, 'http://placeholder.invalid').host;
  } catch {
    return '';
  }
}

/**
 * Build a `srcSet` string, or `null` when one would not help.
 *
 * @param {string} url  the stored or remote image URL
 * @returns {string|null} e.g. `"url 200w, url 400w, ..."` or `null`
 */
export function buildSrcSet(url) {
  if (typeof url !== 'string' || !url) return null;

  const renditions = renditionsFor(url);
  if (renditions) {
    return renditions.map((r) => `${r.url} ${r.width}w`).join(', ');
  }

  const resizer = PARAMETRIC_HOSTS[hostOf(url)];
  if (!resizer) return null;

  // A known set of widths rather than every one, so the browser is choosing
  // between five real files instead of eight speculative requests' worth of
  // candidates it will mostly discard.
  return variantWidths.map((width) => `${resizer(url, width)} ${width}w`).join(', ');
}

/**
 * Normalise the several shapes an `images` column has been seen in.
 *
 * `products.images` is a jsonb array of URL strings, and the API has returned it
 * as a list, as a JSON string, and as null. Components used to each re-derive
 * this with their own try/catch, and a parse failure in one of them produced a
 * blank card rather than a fallback image.
 */
export function imageList(images) {
  if (Array.isArray(images)) return images.filter((i) => typeof i === 'string' && i);
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed.filter((i) => typeof i === 'string' && i) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';

/**
 * Props for one `<img>`: `src`, `srcSet`, `sizes`, intrinsic `width`/`height`
 * and the right loading hint.
 *
 * `sizes` is the part everyone skips. A srcSet without it is a suggestion the
 * browser cannot act on: it assumes the image fills the viewport, so a 200px
 * thumbnail in a four-across grid still downloads the 1600w file. The defaults
 * below describe the layouts that actually exist in this app.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.sizes]     the `sizes` attribute; omit to emit none
 * @param {number} [options.width]     intrinsic px, for aspect-ratio reservation
 * @param {number} [options.height]
 * @param {boolean} [options.eager]    above the fold: skip lazy, ask for high
 * @param {string} [options.alt]
 */
export function responsiveImageProps(url, options = {}) {
  const { sizes, width, height, eager = false, alt = '' } = options;
  const src = url || FALLBACK_IMAGE;
  const srcSet = buildSrcSet(src);

  const props = {
    src,
    alt,
    // `async` hands decoding off the main thread, so a large image cannot block
    // scrolling on a mid-range phone. Costs nothing when there is no decode to
    // do, which is the case for the lazy ones.
    decoding: eager ? 'sync' : 'async',
    loading: eager ? 'eager' : 'lazy',
    // React 18 spells it camelCase; React 19 and the DOM spell it
    // `fetchpriority`. Both are passed through to the DOM, and the attribute is
    // simply ignored by a browser that does not understand it.
    fetchPriority: eager ? 'high' : undefined
  };

  if (srcSet) props.srcSet = srcSet;
  if (sizes) props.sizes = sizes;
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    props.width = Math.round(width);
    props.height = Math.round(height);
  }
  return props;
}

/**
 * Track the real size of an image the API could not tell us.
 *
 * `width`/`height` attributes are the only thing that stops a grid from
 * reflowing as images arrive, and for the 10,057 seeded products the API has no
 * dimensions to give -- the column is an array of URL strings. So the first
 * load measures `naturalWidth`/`naturalHeight` and hands them back, and the
 * caller can apply them. One entry per URL, capped, because this is a cache and
 * not a database.
 *
 * @returns {() => {width: number, height: number}|null} a reader to call on load
 */
const measured = new Map();
const MEASURED_CAP = 500;

export function measureOnLoad(event) {
  const img = event?.currentTarget;
  if (!img || !img.naturalWidth) return null;
  const currentSrc = img.currentSrc || img.src;
  if (!currentSrc) return null;
  if (measured.size >= MEASURED_CAP) {
    measured.clear();
  }
  measured.set(currentSrc, { width: img.naturalWidth, height: img.naturalHeight });
  return measured.get(currentSrc);
}

/** Look up a previously measured size. Used to seed width/height on remount. */
export function measuredSize(url) {
  return measured.get(url) || null;
}

export { FALLBACK_IMAGE };
