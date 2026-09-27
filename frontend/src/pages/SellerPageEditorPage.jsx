import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store, Save, Eye, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Pin, PinOff,
  AlertTriangle, CheckCircle2, Sparkles, BarChart3, Lock
} from 'lucide-react';
import api from '../services/api';
import { ImageUploader } from '../components/ImageUploader';

/**
 * Seller showcase page editor — K1.
 *
 * This is the screen the whole `seller_pages` feature exists for. It calls the
 * fifteen owner routes in `app/routers/seller_pages.py`, which until now had no
 * caller at all and three links pointing at a route that did not exist, so every
 * seller who clicked "Finish and publish" got a 404.
 *
 * Three things shape the implementation:
 *
 *  * **Capability is read from the API, never assumed.** The plan's limits and
 *    feature flags come back on every read as `entitlement`, and the UI gates on
 *    those flags rather than on a plan name. The server enforces the same flags
 *    on every write, so a downgraded plan takes effect without a deploy — and a
 *    gated control here is a courtesy, not the guard.
 *
 *  * **Saving is explicit per section.** A single Save button for the whole page
 *    means a seller who edits the tagline loses it if the media upload beside it
 *    fails. Each section posts only its own fields.
 *
 *  * **`storage_id` is required by the media route and is not in the public
 *    response.** The uploader hands it back through `onUploaded`; a media item
 *    picked from the library rather than uploaded in this session cannot supply
 *    one, so that path is not offered.
 *
 * The media and section lists are read from the public store endpoint, because
 * the owner GET does not return them and the public one returns the same rows
 * for a published page. For an *unpublished* page it 404s to anyone but the
 * owner — and the caller here is the owner, so it resolves.
 */

const BLOCK_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'media_grid', label: 'Photo grid' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'announcement', label: 'Announcement', feature: 'allows_announcement' },
  { value: 'hero_banner', label: 'Hero banner' },
  { value: 'reels', label: 'Reels', feature: 'allows_reels' }
];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const SellerPageEditorPage = () => {
  const [page, setPage] = useState(null);
  const [entitlement, setEntitlement] = useState({});
  const [usage, setUsage] = useState(null);
  const [media, setMedia] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = useCallback((message, tone = 'ok') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await api.get('/seller-pages/mine');
      const data = mine.data?.data || {};
      setPage(data);
      setEntitlement(data.entitlement || {});
      setUsage(data.usage || null);

      // The public read carries the media and the composed blocks. It 404s for a
      // page that is unpublished *and* not the caller's, which cannot happen
      // here -- but a 404 in development before the row exists is possible, and
      // an empty editor is the right answer to it rather than a red banner.
      if (data.handle) {
        const publicRead = await api
          .get(`/public/stores/${data.handle}`)
          .catch(() => null);
        const payload = publicRead?.data?.data || {};
        setMedia(payload.media || []);
        setBlocks(payload.blocks || []);
        setProducts(payload.products || []);
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load your page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshUsage = useCallback(async () => {
    const mine = await api.get('/seller-pages/mine').catch(() => null);
    if (mine?.data?.data) {
      setUsage(mine.data.data.usage || null);
      setPage(mine.data.data);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!entitlement.allows_analytics) return;
    const res = await api.get('/seller-pages/mine/analytics').catch(() => null);
    if (res?.data?.data) setAnalytics(res.data.data);
  }, [entitlement.allows_analytics]);

  useEffect(() => {
    if (entitlement.allows_analytics && !analytics) loadAnalytics();
  }, [entitlement.allows_analytics, analytics, loadAnalytics]);

  if (loading && !page) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <div className="skeleton" style={{ height: '44px', width: '40%', borderRadius: '8px', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '260px', borderRadius: '12px' }} />
      </div>
    );
  }

  if (error && !page) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <Banner tone="bad" message={error} />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '32px 24px 80px', maxWidth: '1100px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 className="heading-whisper" style={{ fontSize: '26px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Store size={22} /> Store page
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px', marginTop: '6px' }}>
            {page?.is_published ? (
              <>Published at <Link to={`/store/${page.handle}`} style={{ color: 'var(--color-cyan-pulse)' }}>/store/{page.handle}</Link></>
            ) : (
              <>Not published yet. Only you can see it.</>
            )}
          </p>
        </div>
        <PublishToggle
          page={page}
          onChanged={async (next) => {
            setPage((p) => ({ ...p, is_published: next }));
            await load();
          }}
          flash={flash}
        />
      </header>

      {toast && <Banner tone={toast.tone} message={toast.message} />}

      <div style={{ display: 'grid', gap: '20px' }}>
        <ProfileSection page={page} onSaved={load} flash={flash} />
        <AppearanceSection
          page={page}
          entitlement={entitlement}
          onSaved={load}
          flash={flash}
        />
        <MediaSection
          media={media}
          usage={usage}
          entitlement={entitlement}
          products={products}
          onChanged={async () => { await load(); await refreshUsage(); }}
          flash={flash}
        />
        <BlocksSection
          blocks={blocks}
          entitlement={entitlement}
          usage={usage}
          onChanged={async () => { await load(); await refreshUsage(); }}
          flash={flash}
        />
        <PlanSection entitlement={entitlement} onChanged={load} flash={flash} />
        {entitlement.allows_analytics && (
          <AnalyticsSection analytics={analytics} onLoad={loadAnalytics} />
        )}
      </div>
    </div>
  );
};

/* ── shared bits ───────────────────────────────────────────────────────────── */

function Panel({ title, hint, children, action }) {
  return (
    <section
      style={{
        border: '1px solid var(--color-iron-veil)',
        backgroundColor: 'var(--color-deep-canopy)',
        borderRadius: '12px',
        padding: '20px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: 0 }}>{title}</h2>
          {hint && <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', margin: '4px 0 0' }}>{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Banner({ tone = 'ok', message }) {
  const bad = tone === 'bad';
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        marginBottom: '16px',
        borderRadius: '8px',
        border: `1px solid ${bad ? '#7f1d1d' : '#134e4a'}`,
        backgroundColor: bad ? '#2a1215' : '#0c2224',
        color: bad ? '#fecaca' : '#99f6e4',
        fontSize: '13px'
      }}
    >
      {bad ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} {message}
    </div>
  );
}

/* ── publish ───────────────────────────────────────────────────────────────── */

function PublishToggle({ page, onChanged, flash }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await api.post('/seller-pages/mine/publish', {
        publish: !page.is_published
      });
      const next = res.data?.data?.is_published ?? !page.is_published;
      await onChanged(next);
      flash(next ? 'Your page is live.' : 'Your page is unpublished.');
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not change the published state.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      {page?.is_published && (
        <Link to={`/store/${page.handle}`} className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 16px' }}>
          <Eye size={14} /> View
        </Link>
      )}
      <button
        type="button"
        className={page?.is_published ? 'btn-outline' : 'btn-primary'}
        onClick={toggle}
        disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', opacity: busy ? 0.6 : 1 }}
      >
        {page?.is_published ? <><EyeOff size={14} /> Unpublish</> : <><Eye size={14} /> Publish</>}
      </button>
    </div>
  );
}

/* ── profile ───────────────────────────────────────────────────────────────── */

function ProfileSection({ page, onSaved, flash }) {
  const [handle, setHandle] = useState(page?.handle || '');
  const [tagline, setTagline] = useState(page?.tagline || '');
  const [bio, setBio] = useState(page?.bio || '');
  const [busy, setBusy] = useState(false);

  // The page can be re-read after a save; a form that keeps its own copy must
  // resync or the next save posts stale values over someone else's change.
  useEffect(() => {
    setHandle(page?.handle || '');
    setTagline(page?.tagline || '');
    setBio(page?.bio || '');
  }, [page?.handle, page?.tagline, page?.bio]);

  const dirty =
    handle !== (page?.handle || '') ||
    tagline !== (page?.tagline || '') ||
    bio !== (page?.bio || '');

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/seller-pages/mine', {
        handle: handle.trim() || undefined,
        tagline,
        bio
      });
      await onSaved();
      flash('Profile saved.');
    } catch (err) {
      // HANDLE_TAKEN arrives here with a message naming the handle.
      flash(err?.response?.data?.error?.message || 'Could not save your profile.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Profile"
      hint="The name, tagline and story shoppers see at the top of your page."
      action={
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={busy || !dirty}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px', opacity: busy || !dirty ? 0.5 : 1 }}
        >
          <Save size={14} /> {busy ? 'Saving…' : 'Save profile'}
        </button>
      }
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        <Field label="Store handle" hint={`Your page lives at /store/${handle || 'your-handle'}`}>
          <input
            className="input-field"
            value={handle}
            maxLength={60}
            onChange={(e) => setHandle(e.target.value)}
            style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}
          />
        </Field>
        <Field label="Tagline" hint="One line, up to 140 characters.">
          <input
            className="input-field"
            value={tagline}
            maxLength={140}
            onChange={(e) => setTagline(e.target.value)}
            style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}
          />
        </Field>
        <Field label="About" hint="Your story. Line breaks are preserved.">
          <textarea
            className="input-field"
            value={bio}
            maxLength={5000}
            onChange={(e) => setBio(e.target.value)}
            style={{ minHeight: '130px', resize: 'vertical', backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}
          />
        </Field>
      </div>
    </Panel>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="form-label" style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

/* ── appearance ────────────────────────────────────────────────────────────── */

function AppearanceSection({ page, entitlement, onSaved, flash }) {
  const [accent, setAccent] = useState(page?.theme_accent || '#38bdf8');
  const [seoTitle, setSeoTitle] = useState(page?.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(page?.seo_description || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAccent(page?.theme_accent || '#38bdf8');
    setSeoTitle(page?.seo_title || '');
    setSeoDescription(page?.seo_description || '');
  }, [page?.theme_accent, page?.seo_title, page?.seo_description]);

  const save = async () => {
    setBusy(true);
    try {
      const body = { seo_title: seoTitle, seo_description: seoDescription };
      // Only send the accent when the plan allows it. The server refuses a
      // custom theme on a plan without it, so sending an unchanged default
      // would turn a harmless save into a 403.
      if (entitlement.allows_custom_theme) body.theme_accent = accent;
      await api.put('/seller-pages/mine', body);
      await onSaved();
      flash('Appearance saved.');
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not save appearance.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Appearance & search"
      hint="The accent colour tints your page. The search fields are what appear in a Google result."
      action={
        <button type="button" className="btn-primary" onClick={save} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px', opacity: busy ? 0.6 : 1 }}>
          <Save size={14} /> {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        <Field
          label="Accent colour"
          hint={entitlement.allows_custom_theme ? undefined : 'Your plan uses the default accent.'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="color"
              value={entitlement.allows_custom_theme ? accent : '#38bdf8'}
              disabled={!entitlement.allows_custom_theme}
              onChange={(e) => setAccent(e.target.value)}
              style={{ width: '46px', height: '36px', border: '1px solid var(--color-iron-veil)', borderRadius: '8px', background: 'transparent', cursor: entitlement.allows_custom_theme ? 'pointer' : 'not-allowed' }}
            />
            <code style={{ fontSize: '12.5px', color: 'var(--color-silver-glow)' }}>
              {entitlement.allows_custom_theme ? accent : '#38bdf8'}
            </code>
            {!entitlement.allows_custom_theme && <Lock size={13} color="var(--color-ash-label)" />}
          </div>
        </Field>
        <Field label="Search title" hint="Up to 160 characters.">
          <input className="input-field" value={seoTitle} maxLength={160} onChange={(e) => setSeoTitle(e.target.value)} style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }} />
        </Field>
        <Field label="Search description" hint="Up to 320 characters.">
          <textarea className="input-field" value={seoDescription} maxLength={320} onChange={(e) => setSeoDescription(e.target.value)} style={{ minHeight: '80px', resize: 'vertical', backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }} />
        </Field>
      </div>
    </Panel>
  );
}

/* ── media ─────────────────────────────────────────────────────────────────── */

function MediaSection({ media, usage, entitlement, products, onChanged, flash }) {
  // The upload request a just-uploaded file produced. `storage_id` is required by
  // the media route and is not part of the public response, so a file uploaded
  // in this session is the only source for it.
  const pending = useRef(null);
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState('');
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  const limitReached = usage?.media ? usage.media.used >= usage.media.limit : false;

  const attach = async () => {
    if (!pending.current?.object_key || !pending.current?.public_url) {
      flash('Upload an image first.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await api.post('/seller-pages/mine/media', {
        media_type: 'image',
        storage_id: pending.current.object_key,
        url: pending.current.public_url,
        thumbnail_url: pending.current.public_url,
        width: pending.current.width || undefined,
        height: pending.current.height || undefined,
        caption: caption || undefined,
        product_id: productId || undefined
      });
      pending.current = null;
      setUrl(null);
      setCaption('');
      setProductId('');
      await onChanged();
      flash('Added to your gallery.');
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not add that media.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (item, body) => {
    try {
      await api.patch(`/seller-pages/mine/media/${item.id}`, body);
      await onChanged();
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not update that item.', 'bad');
    }
  };

  const remove = async (item) => {
    if (!window.confirm('Remove this from your gallery? The uploaded file is kept.')) return;
    try {
      await api.delete(`/seller-pages/mine/media/${item.id}`);
      await onChanged();
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not remove that item.', 'bad');
    }
  };

  const reorder = async (index, delta) => {
    const next = [...media];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.put('/seller-pages/mine/media/order', { ids: next.map((m) => m.id) });
      await onChanged();
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not reorder.', 'bad');
    }
  };

  return (
    <Panel
      title="Gallery"
      hint={
        usage?.media
          ? `${usage.media.used} of ${usage.media.limit} used. Photos and videos shoppers can browse without leaving your page.`
          : 'Photos and videos shoppers can browse without leaving your page.'
      }
    >
      {!entitlement.allows_video && (
        <p style={{ fontSize: '12px', color: 'var(--color-ash-label)', marginTop: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Lock size={12} /> Video uploads are not on your plan.
        </p>
      )}

      {limitReached ? (
        <Banner tone="bad" message="You have reached your gallery limit. Remove something to add more." />
      ) : (
        <div style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
          <ImageUploader
            value={url ? [url] : []}
            max={1}
            label="Upload an image"
            hint="JPEG, PNG, WebP, GIF or AVIF. Up to 5 MB."
            aspect="4 / 3"
            onUploaded={(stored) => {
              pending.current = stored;
              setUrl(stored.public_url);
            }}
            onChange={(next) => {
              if (!next.length) {
                pending.current = null;
                setUrl(null);
              }
            }}
          />
          {url && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Caption">
                <input className="input-field" value={caption} maxLength={1000} onChange={(e) => setCaption(e.target.value)} style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }} />
              </Field>
              <Field label="Tag a product" hint="Adds a Shop button on the tile.">
                <select className="input-field" value={productId} onChange={(e) => setProductId(e.target.value)} style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}>
                  <option value="">None</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title} — {money(p.price)}</option>)}
                </select>
              </Field>
            </div>
          )}
          <button type="button" className="btn-primary" onClick={attach} disabled={busy || !url} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', opacity: busy || !url ? 0.5 : 1 }}>
            <Plus size={14} /> {busy ? 'Adding…' : 'Add to gallery'}
          </button>
        </div>
      )}

      {media.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: 'var(--color-tide-pool)' }}>Nothing in your gallery yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {media.map((item, index) => (
            <div key={item.id} style={{ border: '1px solid var(--color-iron-veil)', borderRadius: '10px', overflow: 'hidden' }}>
              <img
                src={item.thumbnail_url || item.url}
                alt={item.alt_text || item.caption || ''}
                loading="lazy"
                style={{ display: 'block', width: '100%', height: '130px', objectFit: 'cover' }}
              />
              <div style={{ padding: '10px' }}>
                {item.caption && (
                  <div style={{ fontSize: '12px', color: 'var(--color-silver-glow)', marginBottom: '8px' }}>
                    {item.caption.length > 70 ? `${item.caption.slice(0, 69)}…` : item.caption}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-small" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${index + 1} earlier`}><ArrowUp size={12} /></button>
                  <button type="button" className="btn-small" disabled={index === media.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${index + 1} later`}><ArrowDown size={12} /></button>
                  <button type="button" className="btn-small" onClick={() => patch(item, { is_pinned: !item.is_pinned })} aria-label={item.is_pinned ? 'Unpin' : 'Pin'}>
                    {item.is_pinned ? <Pin size={12} /> : <PinOff size={12} />}
                  </button>
                  <button type="button" className="btn-small" onClick={() => remove(item)} aria-label={`Remove ${index + 1}`}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ── sections ──────────────────────────────────────────────────────────────── */

function BlocksSection({ blocks, entitlement, usage, onChanged, flash }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const limitReached = usage?.blocks ? usage.blocks.used >= usage.blocks.limit : false;

  const typeLabel = (value) => BLOCK_TYPES.find((t) => t.value === value)?.label || value;

  const add = async (type) => {
    setAdding(false);
    setBusy(true);
    try {
      await api.post('/seller-pages/mine/blocks', { block_type: type, title: typeLabel(type) });
      await onChanged();
      flash('Section added.');
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not add that section.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (block) => {
    if (!window.confirm(`Remove the "${block.title || typeLabel(block.block_type)}" section?`)) return;
    try {
      await api.delete(`/seller-pages/mine/blocks/${block.id}`);
      await onChanged();
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not remove that section.', 'bad');
    }
  };

  const reorder = async (index, delta) => {
    const next = [...blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.put('/seller-pages/mine/blocks/order', { ids: next.map((b) => b.id) });
      await onChanged();
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not reorder.', 'bad');
    }
  };

  return (
    <Panel
      title="Page sections"
      hint={
        usage?.blocks
          ? `${usage.blocks.used} of ${usage.blocks.limit} used. Sections are the blocks below your gallery.`
          : 'Sections are the blocks below your gallery.'
      }
      action={
        limitReached ? (
          <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>Limit reached</span>
        ) : (
          <div style={{ position: 'relative' }}>
            <button type="button" className="btn-outline" onClick={() => setAdding((v) => !v)} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px' }}>
              <Plus size={14} /> Add section
            </button>
            {adding && (
              <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20, minWidth: '200px', backgroundColor: 'var(--color-abyssal-ink)', border: '1px solid var(--color-iron-veil)', borderRadius: '10px', padding: '6px', boxShadow: '0 12px 30px rgba(0,0,0,0.45)' }}>
                {BLOCK_TYPES.map((t) => {
                  const allowed = !t.feature || entitlement[t.feature];
                  return (
                    <button
                      key={t.value}
                      type="button"
                      disabled={!allowed}
                      onClick={() => add(t.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
                        padding: '9px 12px', border: 'none', borderRadius: '7px',
                        background: 'transparent', textAlign: 'left',
                        color: allowed ? 'var(--color-ghost-white)' : 'var(--color-ash-label)',
                        fontSize: '13px', cursor: allowed ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {!allowed && <Lock size={12} />} {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )
      }
    >
      {blocks.length === 0 ? (
        <p style={{ fontSize: '12.5px', color: 'var(--color-tide-pool)' }}>
          No sections yet. A text block is a good place to start — it is where your story goes.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {blocks.map((block, index) => (
            <div key={block.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid var(--color-iron-veil)', borderRadius: '9px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', color: '#ffffff', fontWeight: 500 }}>
                  {block.title || typeLabel(block.block_type)}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-ash-label)' }}>
                  {typeLabel(block.block_type)}
                  {block.subtitle ? ` · ${block.subtitle.slice(0, 60)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button type="button" className="btn-small" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${index + 1} up`}><ArrowUp size={12} /></button>
                <button type="button" className="btn-small" disabled={index === blocks.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${index + 1} down`}><ArrowDown size={12} /></button>
                <button type="button" className="btn-small" onClick={() => remove(block)} aria-label={`Remove ${index + 1}`}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '12px' }}>
        Sections can be added, removed and reordered here. Editing a section's own text is not
        offered: the owner API exposes add, delete and reorder, and faking an edit with a
        delete-and-recreate would lose the section's id and its position.
      </p>
    </Panel>
  );
}

/* ── plan ──────────────────────────────────────────────────────────────────── */

function PlanSection({ entitlement, onChanged, flash }) {
  const [busy, setBusy] = useState(false);

  const choose = async (plan) => {
    setBusy(true);
    try {
      await api.post('/seller-pages/mine/plan', { plan });
      await onChanged();
      flash(`Switched to the ${plan} plan.`);
    } catch (err) {
      flash(err?.response?.data?.error?.message || 'Could not change your plan.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const PLANS = [
    { id: 'free', label: 'Free', blurb: '12 photos, 2 sections, default accent.' },
    { id: 'pro', label: 'Pro', blurb: '120 photos, 8 sections, video, highlights, custom accent, analytics.' },
    { id: 'premium', label: 'Premium', blurb: '600 photos, 20 sections, everything in Pro.' }
  ];

  return (
    <Panel title="Plan" hint="What your page can include. Changes take effect immediately — the storefront filters by plan at read time.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {PLANS.map((plan) => {
          const current = entitlement.plan === plan.id;
          return (
            <div
              key={plan.id}
              style={{
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${current ? 'var(--color-cyan-pulse)' : 'var(--color-iron-veil)'}`,
                backgroundColor: current ? 'var(--color-forest-floor)' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Sparkles size={14} color="var(--color-cyan-pulse)" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{plan.label}</span>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--color-tide-pool)', margin: '8px 0 12px', lineHeight: 1.5 }}>
                {plan.blurb}
              </p>
              {current ? (
                <span style={{ fontSize: '12px', color: 'var(--color-cyan-pulse)' }}>Current plan</span>
              ) : (
                <button type="button" className="btn-small" disabled={busy} onClick={() => choose(plan.id)}>
                  Switch to {plan.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── analytics ─────────────────────────────────────────────────────────────── */

function AnalyticsSection({ analytics, onLoad }) {
  useEffect(() => { onLoad(); }, [onLoad]);

  if (!analytics) {
    return <Panel title="Analytics"><div className="skeleton" style={{ height: '90px', borderRadius: '8px' }} /></Panel>;
  }

  const tiles = [
    { label: 'Page views', value: analytics.view_count ?? analytics.views ?? 0 },
    { label: 'Followers', value: analytics.follower_count ?? 0 },
    { label: 'Media', value: analytics.media_count ?? 0 },
    { label: 'Sections', value: analytics.block_count ?? 0 }
  ];

  return (
    <Panel title="Analytics" hint="How many people are finding your page.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ padding: '14px', border: '1px solid var(--color-iron-veil)', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ash-label)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BarChart3 size={11} /> {t.label}
            </div>
            <div style={{ fontSize: '21px', fontWeight: 600, color: '#ffffff', marginTop: '6px' }}>
              {Number(t.value || 0).toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default SellerPageEditorPage;



