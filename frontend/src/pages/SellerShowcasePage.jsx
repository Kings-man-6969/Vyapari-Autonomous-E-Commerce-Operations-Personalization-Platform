import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Store, Star, ShieldCheck, Play, ShoppingBag, Grid3x3, Package,
  ArrowLeft, Heart, X, ChevronLeft, ChevronRight, ImageOff, Loader2, Eye
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/ProductCard';
import { measureOnLoad, responsiveImageProps } from '../lib/imageUrl';
import { EnquiryForm } from '../components/EnquiryForm';

const GRID_PAGE_SIZE = 24;

// theme_accent is CHECK-constrained to ^#[0-9a-fA-F]{6}$ in the database, but it
// lands in a style attribute, so re-validate before trusting it.
const safeAccent = (value) => (/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#38bdf8');

/**
 * cta_href is seller-supplied text stored in seller_page_blocks and handed
 * straight to a router Link. Only same-origin paths and explicit http(s) are
 * allowed, so a "javascript:" or "data:" value cannot become a click target.
 */
const safeHref = (value) => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v;
  return '/explore';
};

const VIEW_KEY = (handle) => `vyapari:viewed:${handle}`;

/**
 * Should this page view be counted?
 *
 * The backend records views on an explicit POST rather than as a side effect of
 * GET, so the write happens once per page open. sessionStorage (not
 * localStorage) means a reload is not double counted but a genuine return visit
 * is.
 */
const shouldCountView = (handle) => {
  try {
    if (sessionStorage.getItem(VIEW_KEY(handle))) return false;
    sessionStorage.setItem(VIEW_KEY(handle), '1');
    return true;
  } catch {
    return true; // private mode / storage disabled: prefer counting over not
  }
};

const StatBlock = ({ value, label }) => (
  <div style={{ textAlign: 'center', minWidth: '68px' }}>
    <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--color-pure-white)' }}>
      {value}
    </div>
    <span
      style={{
        fontSize: '10px', color: 'var(--color-ash-label)',
        textTransform: 'uppercase', letterSpacing: '0.06em'
      }}
    >
      {label}
    </span>
  </div>
);

// `ratio` lets the reels block render 9:16 without a second component; the
// main grid keeps the default square.
const MediaTile = ({ item, accent, onOpen, ratio = '1 / 1' }) => (
  <button
    type="button"
    onClick={() => onOpen(item)}
    aria-label={item.caption || (item.media_type === 'video' ? 'Play video' : 'View image')}
    style={{
      position: 'relative', aspectRatio: ratio, width: '100%', padding: 0,
      border: '1px solid var(--color-border-steel)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', cursor: 'pointer', backgroundColor: 'var(--color-gunmetal-dark)'
    }}
  >
    <img
      {...responsiveImageProps(item.thumbnail_url || item.url, {
        alt: item.alt_text || item.caption || '',
        // Seller media sits in a grid of unknown column count, so the honest
        // sizes string is a range rather than a fixed guess. Video posters are
        // the same story -- a seller uploading a promo reel should not push a
        // 4K frame through a 300px tile.
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
        // Lazy, but not because of the observer: `loading="lazy"` covers it, and
        // the IntersectionObserver that used to drive this was doing the same job
        // with more code and a second layout read.
        eager: false
      })}
      onLoad={measureOnLoad}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      onError={(e) => {
        // A dead CDN link should degrade to a placeholder, not a broken icon.
        e.currentTarget.onerror = null;
        e.currentTarget.style.visibility = 'hidden';
        e.currentTarget.parentElement?.querySelector('[data-fallback]')?.removeAttribute('hidden');
      }}
    />
    <span
      data-fallback
      hidden
      style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: 'var(--color-ash-label)'
      }}
    >
      <ImageOff size={20} />
    </span>

    {item.media_type === 'video' && (
      <span
        style={{
          position: 'absolute', top: '8px', right: '8px', display: 'flex',
          alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: 'var(--radius-pills)',
          backgroundColor: 'rgba(9, 10, 13, 0.75)', color: '#fff', fontSize: '11px'
        }}
      >
        <Play size={11} fill="currentColor" stroke="none" />
        {item.duration_ms ? `${Math.round(item.duration_ms / 1000)}s` : ''}
      </span>
    )}

    {item.product_id && (
      <span
        style={{
          position: 'absolute', bottom: '8px', left: '8px', display: 'flex',
          alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: 'var(--radius-pills)',
          backgroundColor: 'rgba(9, 10, 13, 0.75)', color: accent, fontSize: '11px'
        }}
      >
        <ShoppingBag size={11} />
        Shop
      </span>
    )}

    {item.caption && (
      <span
        style={{
          position: 'absolute', inset: 0, padding: '10px', display: 'flex',
          alignItems: 'flex-end', color: '#fff', fontSize: '11px', lineHeight: 1.35,
          background: 'linear-gradient(transparent 55%, rgba(9,10,13,0.88))',
          opacity: 0, transition: 'opacity 0.18s ease', textAlign: 'left'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
      >
        {item.caption}
      </span>
    )}
  </button>
);

const Lightbox = ({ items, index, onClose, onStep }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onStep(1);
      if (e.key === 'ArrowLeft') onStep(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onStep]);

  const item = items[index];
  if (!item) return null;
  const isVideo = item.media_type === 'video';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 10, 13, 0.94)'
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
      >
        <X size={24} />
      </button>

      {items.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStep(-1); }}
          aria-label="Previous"
          style={{ position: 'absolute', left: '18px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          <ChevronLeft size={30} />
        </button>
      )}

      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(720px, 92vw)', width: '100%' }}>
        {isVideo ? (
          <video
            src={item.url}
            poster={item.poster_url || item.thumbnail_url}
            controls
            autoPlay
            playsInline
            style={{ width: '100%', maxHeight: '76vh', borderRadius: 'var(--radius-md)', background: '#000' }}
          />
        ) : (
          <img
            {...responsiveImageProps(item.url, {
              alt: item.alt_text || item.caption || '',
              // A lightbox is the one place a full-width image is wanted, so
              // this is the single candidate most likely to want the master.
              sizes: '92vw',
              eager: true
            })}
            onLoad={measureOnLoad}
            style={{ width: '100%', maxHeight: '76vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
          />
        )}

        {item.caption && (
          <p style={{ color: 'var(--color-ghost-white)', fontSize: '14px', marginTop: '14px', marginBottom: 0 }}>
            {item.caption}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--color-ash-label)', fontSize: '12px' }}>
            <Eye size={13} /> {item.view_count}
          </span>
          {item.product_id && (
            <Link
              to={`/products/${item.product_id}`}
              onClick={onClose}
              className="btn-outline btn-small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ShoppingBag size={13} /> View tagged product
            </Link>
          )}
        </div>
      </div>

      {items.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStep(1); }}
          aria-label="Next"
          style={{ position: 'absolute', right: '18px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          <ChevronRight size={30} />
        </button>
      )}
    </div>
  );
};

/**
 * A page block other than announcement / hero_banner.
 *
 * seller_page_blocks.config is seller-writable JSONB, so every read here is
 * defensive: a block whose config is missing or the wrong shape degrades to its
 * title, subtitle and CTA rather than throwing and taking the whole page down.
 * The default branch means a block_type added by a future migration still shows
 * something instead of vanishing.
 */
const ContentBlock = ({ block, media = [], products = [], accent, onOpenMedia }) => {
  // config is JSONB and has arrived both as an object and as raw text, so accept
  // either rather than assuming. Anything unusable degrades to {}.
  const raw = block.config;
  let config = {};
  if (raw && typeof raw === 'object') config = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') config = parsed;
    } catch {
      config = {};
    }
  }
  // Capitalised on purpose: a lowercase JSX name is treated as a host element,
  // so <tag> would emit a literal <tag> rather than an <h3>.
  const header = (Heading = 'h3') =>
    (block.title || block.subtitle) && (
      <div style={{ marginBottom: '14px' }}>
        {block.title && (
          <Heading className="heading-whisper" style={{ fontSize: '18px', color: 'var(--color-pure-white)', margin: 0 }}>
            {block.title}
          </Heading>
        )}
        {block.subtitle && (
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.8, fontSize: '13px', margin: '6px 0 0', lineHeight: 1.55 }}>
            {block.subtitle}
          </p>
        )}
      </div>
    );

  const cta = (block.cta_label && block.cta_href) && (
    <Link to={safeHref(block.cta_href)} className="btn-outline btn-small" style={{ display: 'inline-block', marginTop: '14px' }}>
      {block.cta_label}
    </Link>
  );

  const shell = (children) => (
    <section style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: '20px' }}>
      {children}
    </section>
  );

  const scroller = (children) => (
    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
      {children}
    </div>
  );

  // Resolve an id list from config against what is actually loaded, preserving
  // the seller's ordering and dropping ids that no longer resolve.
  const pickById = (list, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const byId = new Map(list.map((m) => [String(m.id), m]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
  };

  const asArray = (v) => (Array.isArray(v) ? v : []);

  if (block.block_type === 'featured_collection') {
    const pinned = pickById(products, config.product_ids);
    const shown = (pinned.length ? pinned : products).slice(0, 8);
    if (!shown.length) return shell(<>{header()}{cta}</>);
    return shell(
      <>
        {header()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '16px' }}>
          {shown.map((p, i) => <ProductCard key={p.id} product={p} priority={i === 0} />)}
        </div>
        {cta}
      </>
    );
  }

  if (block.block_type === 'media_grid') {
    const limit = Number.isInteger(config.limit) ? Math.min(Math.max(config.limit, 1), 24) : 9;
    const pinned = pickById(media, config.media_ids);
    const shown = (pinned.length ? pinned : media).slice(0, limit);
    if (!shown.length) return shell(<>{header()}{cta}</>);
    return shell(
      <>
        {header()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {shown.map((m, i) => (
            <div key={m.id} style={{ aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
              <MediaTile item={m} accent={accent} onOpen={() => onOpenMedia?.(media.indexOf(m))} />
            </div>
          ))}
        </div>
        {cta}
      </>
    );
  }

  if (block.block_type === 'reels') {
    const pinned = pickById(media, config.media_ids);
    const reels = (pinned.length ? pinned : media).filter((m) => m.media_type === 'video');
    if (!reels.length) return null;
    return shell(
      <>
        {header()}
        {scroller(
          reels.map((m) => (
            <div key={m.id} style={{ width: '160px', flexShrink: 0, aspectRatio: '9 / 16', overflow: 'hidden', borderRadius: 'var(--radius-md)', position: 'relative' }}>
              <MediaTile item={m} accent={accent} onOpen={() => onOpenMedia?.(media.indexOf(m))} ratio="9 / 16" />
              <span style={{ position: 'absolute', left: '8px', bottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(9,10,13,0.72)', color: 'var(--color-pure-white)', fontSize: '11px', padding: '3px 8px', borderRadius: 'var(--radius-pills)' }}>
                <Eye size={11} /> {Number(m.view_count || 0).toLocaleString('en-IN')}
              </span>
            </div>
          ))
        )}
        {cta}
      </>
    );
  }

  if (block.block_type === 'testimonials') {
    const quotes = asArray(config.quotes).filter((q) => q && typeof q === 'object' && (q.quote || q.text));
    if (!quotes.length) return shell(<>{header()}{cta}</>);
    return shell(
      <>
        {header()}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {quotes.slice(0, 6).map((q, i) => (
            <figure key={q.id || `${block.id}-${i}`} style={{ margin: 0, backgroundColor: 'var(--color-obsidian-graphite)', border: '1px solid var(--color-border-steel)', borderRadius: 'var(--radius-md)', padding: '18px' }}>
              <blockquote style={{ margin: 0, color: 'var(--color-silver-glow)', fontSize: '14px', lineHeight: 1.65 }}>
                &ldquo;{q.quote || q.text}&rdquo;
              </blockquote>
              {Number(q.rating) > 0 && (
                <div style={{ display: 'flex', gap: '2px', margin: '10px 0 8px' }}>
                  {Array.from({ length: Math.min(5, Math.round(Number(q.rating))) }).map((_, s) => (
                    <Star key={s} size={12} fill="var(--color-warning)" color="var(--color-warning)" />
                  ))}
                </div>
              )}
              {(q.author || q.name) && (
                <figcaption style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>{q.author || q.name}</figcaption>
              )}
            </figure>
          ))}
        </div>
        {cta}
      </>
    );
  }

  // Unknown or future block_type: still show the seller's copy rather than
  // dropping it on the floor.
  return shell(<>{header()}{cta}</>);
};

/**
 * The loaded page, as a pure function of props.
 *
 * Split out from SellerShowcasePage so it can be rendered without an effect
 * running: effects never fire under renderToString, so a test that renders the
 * page component directly only ever sees the loading skeleton. Keeping the
 * presentational half separate also means every field the API must supply is
 * visible in one prop list instead of scattered through a fetch callback.
 */
export const StoreView = ({
  payload,
  media,
  products,
  tab = 'grid',
  onTabChange,
  onOpenMedia,
  loadingMore = false,
  gridRef = null,
  isAuthenticated = false,
  isSelf = false,
  following = false,
  followBusy = false,
  onToggleFollow,
  error = null,
}) => {
  if (!payload) return null;

  const { page, seller, blocks = [], highlights = [] } = payload;
  const accent = safeAccent(page.theme_accent);
  const isOwner = Boolean(payload.viewer?.is_owner);
  const announcement = blocks.find((b) => b.block_type === 'announcement');
  const heroBlock = blocks.find((b) => b.block_type === 'hero_banner');
  // One announcement and one hero, in sort order. Everything else renders below
  // the profile header in the order the seller arranged it.
  const otherBlocks = blocks
    .filter((b) => b.block_type !== 'announcement' && b.block_type !== 'hero_banner')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.id).localeCompare(String(b.id)));

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', paddingBottom: '80px' }}>
      {/* Announcement strip */}
      {announcement && (
        <div style={{ backgroundColor: accent, color: '#090a0d', textAlign: 'center', padding: '9px 16px', fontSize: '13px', fontWeight: 600 }}>
          {announcement.title}
          {announcement.subtitle ? ` — ${announcement.subtitle}` : ''}
        </div>
      )}

      {/* Draft banner for the owner */}
      {isOwner && !page.is_published && (
        <div style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', textAlign: 'center', padding: '10px 16px', fontSize: '13px', borderBottom: '1px solid var(--color-border-steel)' }}>
          This page is a private draft. Only you can see it.{' '}
          <Link to="/seller/page" style={{ color: 'inherit', fontWeight: 600 }}>Finish and publish</Link>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ margin: '20px 0 16px' }}>
          <Link to="/explore" style={{ color: 'var(--color-silver-glow)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', textDecoration: 'none', opacity: 0.8 }}>
            <ArrowLeft size={15} />
            <span>Back to Catalog</span>
          </Link>
        </div>

        {/* Profile header */}
        <header style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: 'var(--radius-xl)', padding: '28px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '104px', height: '104px', borderRadius: '50%', flexShrink: 0,
                border: `3px solid ${accent}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden',
                backgroundColor: 'var(--color-titanium-brushed)', fontSize: '2.4rem', fontWeight: 600,
                color: 'var(--color-icy-steel)'
              }}
            >
              {page.avatar_url
                ? <img
                    {...responsiveImageProps(page.avatar_url, {
                      alt: seller?.store_name || page.handle,
                      sizes: '104px',
                      // Above the fold, and tiny. Eager at 104px costs almost
                      // nothing and stops the letterhead from popping in.
                      eager: true
                    })}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                : (seller?.store_name?.[0]?.toUpperCase() || <Store size={40} />)}
            </div>

            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h1 className="heading-whisper" style={{ fontSize: '26px', color: 'var(--color-pure-white)', margin: 0 }}>
                  {seller?.store_name || page.handle}
                </h1>
                {seller?.is_verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-pills)', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', color: 'var(--color-icy-steel)' }}>
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
                {page.plan !== 'free' && (
                  <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{page.plan}</span>
                )}
              </div>

              <p style={{ color: 'var(--color-ash-label)', fontSize: '13px', margin: '4px 0 0' }}>
                vyapari.com/store/{page.handle}
              </p>

              {page.tagline && (
                <p style={{ color: 'var(--color-ghost-white)', fontSize: '15px', fontWeight: 500, margin: '12px 0 0' }}>
                  {page.tagline}
                </p>
              )}
              {page.bio && (
                <p style={{ color: 'var(--color-silver-glow)', opacity: 0.82, fontSize: '13px', margin: '8px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {page.bio}
                </p>
              )}

              <div style={{ display: 'flex', gap: '26px', marginTop: '18px' }}>
                <StatBlock value={page.media_total ?? media.length} label="Posts" />
                <StatBlock value={page.follower_count} label="Followers" />
                <StatBlock value={products.length} label="Listings" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '160px' }}>
              {isOwner ? (
                <Link to="/seller/page" className="btn-primary" style={{ display: 'block', textAlign: 'center', padding: '10px 20px' }}>
                  Edit Page
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onToggleFollow}
                  disabled={followBusy || isSelf}
                  className={following ? 'btn-outline' : 'btn-primary'}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px 20px', opacity: isSelf ? 0.5 : 1, cursor: isSelf ? 'not-allowed' : 'pointer' }}
                >
                  <Heart size={15} fill={following ? 'currentColor' : 'none'} />
                  {isSelf ? 'Your Page' : following ? 'Following' : 'Follow'}
                </button>
              )}
              {page.view_count > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: 'var(--color-ash-label)', fontSize: '12px' }}>
                  <Eye size={13} /> {page.view_count.toLocaleString('en-IN')} views
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Message the store. Hidden from the owner, who would only be sending
            themselves an email. The routing id is the page's own seller_id, so
            the enquiry reaches this merchant and no other. */}
        {!isOwner && (
          <details
            style={{
              backgroundColor: 'var(--color-deep-canopy)',
              border: '1px solid var(--color-border-steel)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              marginBottom: '20px'
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-icy-steel)',
                listStyle: 'none'
              }}
            >
              Message this store
            </summary>
            <div style={{ marginTop: '16px' }}>
              <EnquiryForm
                source="seller_page"
                sellerId={page.seller_id}
                heading={null}
                intro={`Ask ${seller?.store_name || page.handle} a question. They will reply directly.`}
                submitLabel="Send to store"
                compact
              />
            </div>
          </details>
        )}

        {/* Hero banner block */}
        {heroBlock && (
          <section style={{ backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', borderRadius: 'var(--radius-lg)', padding: '26px 28px', marginBottom: '20px' }}>
            {heroBlock.title && (
              <h2 className="heading-whisper" style={{ fontSize: '21px', color: 'var(--color-pure-white)', margin: 0 }}>{heroBlock.title}</h2>
            )}
            {heroBlock.subtitle && (
              <p style={{ color: 'var(--color-silver-glow)', opacity: 0.82, fontSize: '14px', margin: '8px 0 0', lineHeight: 1.6 }}>{heroBlock.subtitle}</p>
            )}
            {heroBlock.cta_label && heroBlock.cta_href && (
              <Link
                to={safeHref(heroBlock.cta_href)}
                className="btn-primary"
                style={{ display: 'inline-block', marginTop: '16px', padding: '10px 22px' }}
              >
                {heroBlock.cta_label}
              </Link>
            )}
          </section>
        )}

        {/* Everything else the seller configured. announcement and
            hero_banner are pulled out above and get bespoke layouts; these four
            fall through to a generic renderer so a block type is never paid
            for and then silently dropped. */}
        {otherBlocks.map((b) => (
          <ContentBlock key={b.id} block={b} media={media} products={products} accent={accent} onOpenMedia={onOpenMedia} />
        ))}

        {/* Highlights */}
        {highlights?.length > 0 && (
          <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '6px 0 20px' }}>
            {highlights.map((h) => (
              <div key={h.id} style={{ textAlign: 'center', flexShrink: 0, width: '84px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', border: `2px solid ${accent}`, padding: '3px', margin: '0 auto' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--color-gunmetal-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {h.cover_url
                      ? <img
                          {...responsiveImageProps(h.cover_url, { alt: h.title, sizes: '72px' })}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      : <Star size={20} color="var(--color-ash-label)" />}
                  </div>
                </div>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-silver-glow)', marginTop: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border-steel)', marginBottom: '20px' }}>
          {[
            { key: 'grid', label: 'Gallery', icon: Grid3x3 },
            { key: 'products', label: 'Listings', icon: Package }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              aria-current={tab === key}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '12px 20px', fontSize: '13px', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${tab === key ? accent : 'transparent'}`,
                color: tab === key ? 'var(--color-pure-white)' : 'var(--color-ash-label)'
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Gallery tab */}
        {tab === 'grid' && (
          media.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border-steel)' }}>
              <ImageOff size={34} color="var(--color-ash-label)" style={{ marginBottom: '12px' }} />
              <h3 className="heading-whisper" style={{ fontSize: '18px', color: 'var(--color-pure-white)', marginBottom: '6px' }}>No posts yet</h3>
              <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px' }}>
                {isOwner ? 'Upload photos and videos to build your storefront gallery.' : 'This seller has not posted anything yet.'}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {media.map((item, i) => (
                  <MediaTile key={item.id} item={item} accent={accent} onOpen={() => onOpenMedia(i)} />
                ))}
              </div>
              <div ref={gridRef} style={{ height: '1px' }} />
              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', color: 'var(--color-ash-label)' }}>
                  <Loader2 size={20} className="spin" />
                </div>
              )}
              {!payload.has_more_media && media.length >= (payload.media_total ?? 0) && media.length > GRID_PAGE_SIZE && (
                <p style={{ textAlign: 'center', color: 'var(--color-ash-label)', fontSize: '12px', marginTop: '22px' }}>
                  All {media.length} posts loaded
                </p>
              )}
            </>
          )
        )}

        {/* Listings tab */}
        {tab === 'products' && (
          products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border-steel)' }}>
              <Package size={34} color="var(--color-ash-label)" style={{ marginBottom: '12px' }} />
              <h3 className="heading-whisper" style={{ fontSize: '18px', color: 'var(--color-pure-white)', marginBottom: '6px' }}>No live listings</h3>
              <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px' }}>
                This seller has no active products right now.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '22px' }}>
              {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i === 0} />)}
            </div>
          )
        )}
      </div>

    </div>
  );
};

// ── Data-fetching shell ──────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '40px 24px' }}>
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-xl)', marginBottom: '20px', backgroundColor: 'var(--color-gunmetal-dark)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="skeleton" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-gunmetal-dark)' }} />
        ))}
      </div>
    </div>
  </div>
);

const NotFound = ({ message }) => (
  <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '80px 24px', textAlign: 'center' }}>
    <div style={{ maxWidth: '480px', margin: '0 auto', backgroundColor: 'var(--color-gunmetal-dark)', padding: '44px 36px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-steel)' }}>
      <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Store size={28} color="var(--color-ash-label)" />
      </div>
      <h2 className="heading-whisper" style={{ fontSize: '22px', color: 'var(--color-pure-white)', marginBottom: '8px' }}>
        Store Not Found
      </h2>
      <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '24px', fontSize: '13px' }}>
        {message}
      </p>
      <Link to="/explore" className="btn-primary" style={{ display: 'inline-block', padding: '12px 28px' }}>
        Browse All Curation
      </Link>
    </div>
  </div>
);

export const SellerShowcasePage = () => {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [payload, setPayload] = useState(null);
  const [media, setMedia] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const gridRef = useRef(null);

  const errMessage = (err, fallback) =>
    err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/public/stores/${handle}`);
        if (cancelled) return;
        if (res.data?.success) {
          const d = res.data.data;
          setPayload(d);
          setMedia(d.media || []);
          setProducts(d.products || []);
          setFollowing(Boolean(d.viewer?.is_following));

          if (shouldCountView(handle)) {
            // Fire and forget; a failed counter must not break the page.
            api.post(`/public/stores/${handle}/view`, {}).catch(() => {});
          }
        }
      } catch (err) {
        if (!cancelled) setError(errMessage(err, 'This store page could not be loaded.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [handle]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !payload?.has_more_media) return;
    setLoadingMore(true);
    try {
      const res = await api.get(
        `/public/stores/${handle}/media?limit=${GRID_PAGE_SIZE}&offset=${media.length}`
      );
      if (res.data?.success) {
        setMedia((prev) => [...prev, ...(res.data.data.media || [])]);
      }
    } catch {
      /* keep what we already have rather than blanking the grid */
    } finally {
      setLoadingMore(false);
    }
  }, [handle, loadingMore, media.length, payload]);

  // Infinite scroll on the grid tab.
  //
  // This observer is for pagination, not images, and the distinction matters:
  // `loading="lazy"` handles the images (see responsiveImageProps), so an
  // earlier observer that gated image src attributes was solving a problem the
  // platform attribute already solves -- and doing it worse, since swapping a
  // src after mount restarts the request instead of letting the browser pick a
  // candidate from a srcSet it already has.
  useEffect(() => {
    if (tab !== 'grid' || !payload?.has_more_media || !gridRef.current) return undefined;
    const node = gridRef.current;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '400px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [tab, payload, loadMore]);

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/store/${handle}` } });
      return;
    }
    setFollowBusy(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing); // optimistic
    try {
      const res = wasFollowing
        ? await api.delete(`/public/stores/${handle}/follow`)
        : await api.post(`/public/stores/${handle}/follow`);
      if (res.data?.success) {
        setFollowing(res.data.data.is_following);
        setPayload((p) => (p ? {
          ...p,
          page: { ...p.page, follower_count: res.data.data.follower_count },
          viewer: { ...p.viewer, is_following: res.data.data.is_following },
        } : p));
      }
    } catch (err) {
      setFollowing(wasFollowing); // roll back
      setError(errMessage(err, 'Could not update follow.'));
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error && !payload) return <NotFound message={error} />;
  if (!payload) return null;

  const isSelf = isAuthenticated && user?.id === payload.page.seller_id;

  return (
    <>
      <StoreView
        payload={payload}
        media={media}
        products={products}
        tab={tab}
        onTabChange={setTab}
        onOpenMedia={setLightbox}
        loadingMore={loadingMore}
        isAuthenticated={isAuthenticated}
        isSelf={isSelf}
        following={following}
        followBusy={followBusy}
        onToggleFollow={toggleFollow}
        error={error}
        gridRef={gridRef}
      />
      {lightbox !== null && (
        <Lightbox
          items={media}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onStep={(delta) => setLightbox((i) => {
            if (i === null) return i;
            const next = i + delta;
            if (next < 0 || next >= media.length) return i;
            return next;
          })}
        />
      )}
    </>
  );
};

export default SellerShowcasePage;
