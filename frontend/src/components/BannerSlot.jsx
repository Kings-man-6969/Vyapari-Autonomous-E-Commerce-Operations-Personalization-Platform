/**
 * BannerSlot — one merchandising slot, filled from the CMS.
 *
 * The important behaviour is what happens when there is nothing to show:
 * **the component renders `null`**. Every slot on the site is empty on a fresh
 * install, and a placeholder box reading "No banner configured" is a worse
 * homepage than no box at all. The surrounding page owns its own spacing, so an
 * empty slot leaves no gap.
 *
 * Three layouts, because the three slots in the checklist want three different
 * things and a single "banner" component that tried to be all of them would grow
 * a `mode` flag per caller anyway:
 *
 *   hero  — one large image with the copy overlaid. Homepage.
 *   strip — a row of short cards. Category top, seller page.
 *   rail  — a horizontal scroller. Product-detail promo rail.
 *
 * A video banner is never autoplayed. `preload="none"` plus a `poster` means a
 * phone does not fetch a video file to render a homepage that already has images
 * on it; the browser fetches it when the user asks. Without a poster the slot is
 * a black rectangle, so a video with no thumbnail renders as an image if it has
 * a `url` that looks like one, and otherwise renders only its copy.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { fetchBanners } from '../lib/content';
import { responsiveImageProps } from '../lib/imageUrl';

/** Site paths use `<Link>`; absolute http(s) URLs use an anchor. */
const isExternal = (url) => /^https?:\/\//i.test(url || '');

/**
 * Anything that is neither an absolute http(s) URL nor a site-relative path is
 * not a link. The API already refuses `javascript:` at the write boundary, so
 * this is the second lock on the same door -- and it is not redundant: the
 * first row of a seeded table, a hand-run UPDATE, or a future admin route that
 * forgets the validator all reach this component with whatever they like in
 * `target_url`, and react-router will happily render `href="javascript:..."`.
 */
const isSafeTarget = (url) => {
  const value = (url || '').trim();
  if (!value) return false;
  if (value.startsWith('/')) return true;
  return /^https?:\/\//i.test(value);
};

const CTA_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 18px',
  borderRadius: '9999px',
  backgroundColor: '#ffffff',
  color: '#0a0c10',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap'
};

function BannerCta({ banner, style }) {
  if (!banner.cta_label || !isSafeTarget(banner.target_url)) return null;
  const merged = { ...CTA_STYLE, ...style };
  if (isExternal(banner.target_url)) {
    return (
      <a
        href={banner.target_url}
        target="_blank"
        rel="noopener noreferrer"
        style={merged}
        data-banner-cta={banner.id}
      >
        {banner.cta_label}
        <ArrowRight size={15} />
      </a>
    );
  }
  return (
    <Link to={banner.target_url} style={merged} data-banner-cta={banner.id}>
      {banner.cta_label}
      <ArrowRight size={15} />
    </Link>
  );
}

/**
 * The media for one banner.
 *
 * Returns `null` when there is genuinely nothing safe to render, so the caller
 * can decide whether copy alone is enough. A video with no poster is the case
 * that matters: `<video>` with no poster paints black, and a black rectangle is
 * worse than the copy on its own.
 */
function BannerMedia({ banner, sizes, eager, imgStyle, videoStyle }) {
  if (banner.media_type === 'video' && banner.url) {
    if (!banner.thumbnail_url) return null;
    return (
      <video
        poster={banner.thumbnail_url}
        src={banner.url}
        controls
        playsInline
        preload="none"
        style={videoStyle}
      />
    );
  }
  if (!banner.url) return null;

  return (
    <img
      {...responsiveImageProps(banner.url, {
        alt: banner.title || 'Promotion',
        // A hero is the full width of the container; a strip card is not. The
        // caller knows which, so it passes `sizes`.
        sizes,
        eager
      })}
      style={imgStyle}
    />
  );
}

/** `hero` — one large banner, copy overlaid on a scrim. */
function HeroLayout({ banner, sizes, eager }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid var(--color-border-steel)',
        backgroundColor: 'var(--color-gunmetal-dark)'
      }}
    >
      <BannerMedia
        banner={banner}
        sizes={sizes}
        eager={eager}
        imgStyle={{ display: 'block', width: '100%', height: 'auto' }}
        videoStyle={{ display: 'block', width: '100%', height: 'auto' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '24px',
          background:
            'linear-gradient(to top, rgba(10, 12, 16, 0.88) 0%, rgba(10, 12, 16, 0.35) 55%, transparent 100%)'
        }}
      >
        {banner.title && (
          <h3
            style={{
              margin: 0,
              fontSize: 'clamp(1.1rem, 2.4vw, 1.7rem)',
              fontWeight: 330,
              letterSpacing: '0.015em',
              color: '#ffffff'
            }}
          >
            {banner.title}
          </h3>
        )}
        {banner.subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--color-steel-mist)',
              maxWidth: '60ch'
            }}
          >
            {banner.subtitle}
          </p>
        )}
        <BannerCta banner={banner} style={{ alignSelf: 'flex-start', marginTop: '4px' }} />
      </div>
    </div>
  );
}

/** `strip` — a row of short cards with the copy underneath. */
function StripLayout({ banners, sizes, eager }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px'
      }}
    >
      {banners.map((banner) => (
        <div
          key={banner.id}
          style={{
            border: '1px solid var(--color-border-steel)',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: 'var(--color-gunmetal-dark)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <BannerMedia
            banner={banner}
            sizes="(max-width: 640px) 100vw, 33vw"
            eager={eager}
            imgStyle={{ display: 'block', width: '100%', height: '160px', objectFit: 'cover' }}
            videoStyle={{ display: 'block', width: '100%', height: '160px', objectFit: 'cover' }}
          />
          <div
            style={{
              padding: '14px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {banner.title && (
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                {banner.title}
              </div>
            )}
            {banner.subtitle && (
              <div style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.5 }}>
                {banner.subtitle}
              </div>
            )}
            <BannerCta banner={banner} style={{ alignSelf: 'flex-start', marginTop: '6px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** `rail` — a horizontally scrolling row of promo cards. */
function RailLayout({ banners, title, eager }) {
  return (
    <div>
      {title && (
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#ffffff',
            margin: '0 0 12px'
          }}
        >
          {title}
        </h3>
      )}
      <div
        style={{
          display: 'flex',
          gap: '14px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollSnapType: 'x mandatory'
        }}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            style={{
              flex: '0 0 260px',
              scrollSnapAlign: 'start',
              border: '1px solid var(--color-border-steel)',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: 'var(--color-gunmetal-dark)'
            }}
          >
            <BannerMedia
              banner={banner}
              sizes="260px"
              eager={eager}
              imgStyle={{ display: 'block', width: '100%', height: '150px', objectFit: 'cover' }}
              videoStyle={{ display: 'block', width: '100%', height: '150px', objectFit: 'cover' }}
            />
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {banner.title && (
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  {banner.title}
                </div>
              )}
              {banner.subtitle && (
                <div style={{ fontSize: '11px', color: 'var(--color-steel-mist)', lineHeight: 1.45 }}>
                  {banner.subtitle}
                </div>
              )}
              <BannerCta banner={banner} style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '6px 12px', fontSize: '11px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.placement  one of BANNER_PLACEMENTS
 * @param {'hero'|'strip'|'rail'} [props.variant='hero']
 * @param {boolean} [props.eager]    first slot above the fold
 * @param {string} [props.sizes]     responsive `sizes` for the hero image
 * @param {string} [props.title]     heading shown above a rail
 * @param {string} [props.className]
 * @param {object} [props.style]     applied to the slot wrapper
 * @param {object[]} [props.banners] pre-fetched rows; skips the request
 */
export function BannerSlot({
  placement,
  variant = 'hero',
  sizes,
  eager = false,
  title,
  className,
  style,
  banners: controlled
}) {
  const [banners, setBanners] = useState(controlled ?? null);

  useEffect(() => {
    // `controlled` is checked against `undefined`, not truthiness: an empty
    // array is a legitimate value meaning "we already know this slot is empty",
    // and re-fetching it would undo a caller that batched one request for the
    // whole page.
    if (controlled !== undefined) return undefined;
    let cancelled = false;
    fetchBanners(placement).then((rows) => {
      if (!cancelled) setBanners(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [placement, controlled]);

  if (!banners || banners.length === 0) return null;

  return (
    <div className={className} style={style} data-banner-slot={placement}>
      {variant === 'strip' ? (
        <StripLayout banners={banners} sizes={sizes} eager={eager} />
      ) : variant === 'rail' ? (
        <RailLayout banners={banners} title={title} eager={eager} />
      ) : (
        <HeroLayout banner={banners[0]} sizes={sizes} eager={eager} />
      )}
    </div>
  );
}

export default BannerSlot;
