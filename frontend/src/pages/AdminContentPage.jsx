import React, { useCallback, useEffect, useState } from 'react';
import {
  Image as ImageIcon, Save, Trash2, Plus, Power, History, AlertTriangle, X, RotateCcw
} from 'lucide-react';
import api from '../services/api';

/**
 * Admin content console — G1 (banners) and G3 (homepage copy).
 *
 * The CMS editor is generic rather than five hardcoded forms. It renders inputs
 * from the *shape* of the stored value: a string becomes a text field, an object
 * becomes nested fields, a list becomes repeatable rows. That is what makes the
 * `cms_content` table worth having -- adding a field to `home.hero` is an edit in
 * this screen, not a deploy -- and it means an unknown key is still editable
 * instead of being a blob nobody can touch.
 *
 * The one thing it deliberately does not do is validate. The storefront treats a
 * missing field as "keep the compiled-in default", so a half-filled section
 * renders the old words for the missing parts rather than going blank, and the
 * API refuses a value that is empty outright.
 */

const PLACEMENTS = [
  { value: 'homepage_hero', label: 'Homepage hero' },
  { value: 'homepage_strip', label: 'Homepage strip' },
  { value: 'category_top', label: 'Category top' },
  { value: 'pdp_promo', label: 'Product page rail' },
  { value: 'seller_page', label: 'Store page' }
];

const CMS_LABEL = {
  'home.hero': 'Homepage hero',
  'home.trust_bar': 'Homepage trust bar',
  'home.categories': 'Homepage categories',
  'home.trending': 'Homepage trending section',
  'home.seller_cta': 'Homepage seller callout'
};

const EMPTY_BANNER = {
  title: '',
  subtitle: '',
  placement: 'homepage_hero',
  media_type: 'image',
  url: '',
  thumbnail_url: '',
  cta_label: '',
  target_url: '',
  start_at: '',
  end_at: '',
  is_active: true,
  sort_order: 0
};

const asInput = (iso) => (iso ? String(iso).slice(0, 16) : '');

export const AdminContentPage = () => {
  const [tab, setTab] = useState('banners');

  return (
    <div>
      <h1 className="heading-whisper" style={{ fontSize: '26px', margin: '0 0 6px' }}>Content</h1>
      <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px', margin: '0 0 20px' }}>
        Banners and the homepage copy. Changes are live within five minutes — the storefront serves
        a cached copy of both.
      </p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid var(--color-iron-veil)' }}>
        {[
          { id: 'banners', label: 'Banners' },
          { id: 'copy', label: 'Homepage copy' }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--color-cyan-pulse)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: tab === t.id ? '#ffffff' : 'var(--color-tide-pool)',
              fontSize: '13.5px',
              fontWeight: tab === t.id ? 600 : 500,
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'banners' ? <BannersPanel /> : <CopyPanel />}
    </div>
  );
};

/* ── banners ───────────────────────────────────────────────────────────────── */

function BannersPanel() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/banners');
      setBanners(res.data?.data || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load banners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (draft) => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        sort_order: Number(draft.sort_order) || 0,
        // Blank optional strings become null, not "". An empty `target_url` is
        // not a link, and storing "" makes the field look set when it is not.
        subtitle: draft.subtitle || null,
        thumbnail_url: draft.thumbnail_url || null,
        cta_label: draft.cta_label || null,
        target_url: draft.target_url || null,
        start_at: draft.start_at || null,
        end_at: draft.end_at || null
      };
      if (draft.id) {
        delete payload.id;
        await api.put(`/admin/banners/${draft.id}`, payload);
      } else {
        delete payload.id;
        await api.post('/admin/banners', payload);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'That banner was refused.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (banner) => {
    setBusy(true);
    try {
      await api.put(`/admin/banners/${banner.id}`, { is_active: !banner.is_active });
      await load();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not change that banner.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (banner) => {
    if (!window.confirm(`Delete "${banner.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/banners/${banner.id}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not delete that banner.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <ErrorBar message={error} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setEditing({ ...EMPTY_BANNER })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px' }}
        >
          <Plus size={15} /> New banner
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Banner</th>
                <th>Slot</th>
                <th>Window</th>
                <th>Live now</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((n) => (
                  <tr key={n}><td colSpan={5}><div className="skeleton" style={{ height: '16px' }} /></td></tr>
                ))
              ) : banners.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-tide-pool)' }}>
                    No banners yet. Every storefront slot is empty until one exists.
                  </td>
                </tr>
              ) : (
                banners.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {b.media_type === 'video'
                          ? <ImageIcon size={16} color="var(--color-ash-label)" />
                          : <img src={b.thumbnail_url || b.url} alt="" loading="lazy" style={{ width: '40px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-iron-veil)' }} />}
                        <div>
                          <div style={{ color: '#ffffff', fontWeight: 500 }}>{b.title}</div>
                          {b.subtitle && <div style={{ fontSize: '11.5px', color: 'var(--color-tide-pool)' }}>{b.subtitle}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-silver-glow)' }}>
                      {PLACEMENTS.find((p) => p.value === b.placement)?.label || b.placement}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                      {b.start_at || b.end_at
                        ? `${b.start_at ? asInput(b.start_at).replace('T', ' ') : 'always'} → ${b.end_at ? asInput(b.end_at).replace('T', ' ') : 'forever'}`
                        : 'Always'}
                    </td>
                    {/* The three states an admin is actually here to tell apart:
                        showing, scheduled, switched off. `in_window` comes from
                        the API and is the same predicate the storefront uses. */}
                    <td>
                      {b.live ? (
                        <span className="status-pill status-pill-active">Live</span>
                      ) : b.is_active ? (
                        <span className="status-pill status-pill-pending">Scheduled</span>
                      ) : (
                        <span className="status-pill status-pill-archived">Off</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-small" disabled={busy} onClick={() => setEditing({ ...b, start_at: asInput(b.start_at), end_at: asInput(b.end_at) })}>
                        Edit
                      </button>{' '}
                      <button type="button" className="btn-small" disabled={busy} onClick={() => toggle(b)} title={b.is_active ? 'Switch off' : 'Switch on'}>
                        <Power size={12} />
                      </button>{' '}
                      <button type="button" className="btn-small" disabled={busy} onClick={() => remove(b)} aria-label={`Delete ${b.title}`}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <BannerForm
          draft={editing}
          busy={busy}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => save(editing)}
        />
      )}
    </div>
  );
}

function BannerForm({ draft, busy, onChange, onCancel, onSave }) {
  const set = (field, value) => onChange({ ...draft, [field]: value });

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 10, 0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={draft.id ? 'Edit banner' : 'New banner'}
        style={{ width: 'min(600px, 100%)', maxHeight: '88vh', overflowY: 'auto', backgroundColor: 'var(--color-abyssal-ink)', border: '1px solid var(--color-iron-veil)', borderRadius: '12px', padding: '24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 className="heading-whisper" style={{ fontSize: '19px', margin: 0 }}>
            {draft.id ? 'Edit banner' : 'New banner'}
          </h2>
          <button type="button" className="btn-small" onClick={onCancel} aria-label="Close"><X size={14} /></button>
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          <Text label="Title" value={draft.title} max={160} onChange={(v) => set('title', v)} required />
          <Text label="Subtitle" value={draft.subtitle} max={255} onChange={(v) => set('subtitle', v)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select label="Slot" value={draft.placement} onChange={(v) => set('placement', v)} options={PLACEMENTS} />
            <Select
              label="Media type"
              value={draft.media_type}
              onChange={(v) => set('media_type', v)}
              options={[{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }]}
            />
          </div>

          <Text
            label={draft.media_type === 'video' ? 'Video URL' : 'Image URL'}
            value={draft.url}
            max={2048}
            onChange={(v) => set('url', v)}
            required
            hint="An uploaded /media/... path or an absolute https:// URL."
          />
          {draft.media_type === 'video' && (
            <Text
              label="Poster image URL"
              value={draft.thumbnail_url}
              max={2048}
              onChange={(v) => set('thumbnail_url', v)}
              hint="Required for a video: without a poster the slot paints black, and the storefront renders the copy instead."
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Text label="Button label" value={draft.cta_label} max={40} onChange={(v) => set('cta_label', v)} />
            <Text label="Button link" value={draft.target_url} max={2048} onChange={(v) => set('target_url', v)} hint="/path or https://" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Text
              label="Starts"
              value={draft.start_at}
              onChange={(v) => set('start_at', v)}
              type="datetime-local"
              hint="Blank means the banner is already in its window."
            />
            <Text
              label="Ends"
              value={draft.end_at}
              onChange={(v) => set('end_at', v)}
              type="datetime-local"
              hint="Blank means it never expires."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <Text label="Sort order" value={draft.sort_order} onChange={(v) => set('sort_order', v)} type="number" hint="Lowest first, within a slot." />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-ghost-white)', paddingBottom: '10px' }}>
              <input type="checkbox" checked={!!draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <button type="button" className="btn-outline" onClick={onCancel} style={{ padding: '10px 18px' }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onSave} disabled={busy || !draft.title || !draft.url} style={{ padding: '10px 20px', opacity: busy || !draft.title || !draft.url ? 0.55 : 1 }}>
            <Save size={14} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── homepage copy ─────────────────────────────────────────────────────────── */

function CopyPanel() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/content');
      setKeys(res.data?.data || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the content keys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {error && <ErrorBar message={error} />}
      {loading ? (
        <div className="skeleton" style={{ height: '120px', borderRadius: '10px' }} />
      ) : keys.length === 0 ? (
        <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px' }}>
          No content keys. The storefront is using the copy compiled into the bundle.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {keys.map((row) => (
            <div key={row.key} style={{ border: '1px solid var(--color-iron-veil)', backgroundColor: 'var(--color-deep-canopy)', borderRadius: '10px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpenKey(openKey === row.key ? null : row.key)}
                aria-expanded={openKey === row.key}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600 }}>
                    {CMS_LABEL[row.key] || row.key}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-ash-label)', marginTop: '2px' }}>
                    <code>{row.key}</code>
                    {row.updated_by_name && ` · last changed by ${row.updated_by_name}`}
                  </div>
                </div>
                <span style={{ color: 'var(--color-tide-pool)', fontSize: '12px' }}>{openKey === row.key ? 'Close' : 'Edit'}</span>
              </button>
              {openKey === row.key && (
                <KeyEditor row={row} onSaved={load} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KeyEditor({ row, onSaved }) {
  const [draft, setDraft] = useState(row.value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [revisions, setRevisions] = useState(null);

  useEffect(() => { setDraft(row.value); setSaved(false); }, [row.value]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/content/${encodeURIComponent(row.key)}`, { value: draft });
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'That content was refused.');
    } finally {
      setBusy(false);
    }
  };

  const loadRevisions = async () => {
    if (revisions) { setRevisions(null); return; }
    try {
      const res = await api.get(`/admin/content/${encodeURIComponent(row.key)}/revisions`);
      setRevisions(res.data?.data || []);
    } catch {
      setRevisions([]);
    }
  };

  return (
    <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--color-iron-veil)' }}>
      {error && <ErrorBar message={error} />}

      <div style={{ marginTop: '14px' }}>
        <ValueEditor value={draft} onChange={(v) => { setDraft(v); setSaved(false); }} path="value" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={save} disabled={busy} style={{ padding: '9px 18px', opacity: busy ? 0.6 : 1 }}>
          <Save size={14} /> {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-small" onClick={loadRevisions} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <History size={13} /> {revisions ? 'Hide history' : 'History'}
        </button>
        {saved && <span style={{ fontSize: '12px', color: 'var(--color-cyan-pulse)' }}>Saved. Live within five minutes.</span>}
      </div>

      {revisions && (
        <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
          {revisions.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', margin: 0 }}>No earlier versions.</p>
          ) : (
            revisions.map((rev, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-iron-veil)', fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                  <span>{new Date(rev.changed_at).toLocaleString('en-IN')} · {rev.changed_by_name || 'Removed admin'}</span>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => { setDraft(rev.previous); setSaved(false); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RotateCcw size={11} /> Restore this
                  </button>
                </div>
                <pre style={{ margin: '8px 0 0', maxHeight: '120px', overflow: 'auto', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(rev.previous, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders inputs from the shape of the value.
 *
 * Strings, numbers, booleans, objects and lists of those. That covers everything
 * the storefront reads, and anything it does not read is still editable rather
 * than trapped as opaque JSON.
 */
function ValueEditor({ value, onChange, path, depth = 0 }) {
  if (Array.isArray(value)) {
    return (
      <div style={{ display: 'grid', gap: '10px' }}>
        {value.map((item, index) => (
          <div key={index} style={{ border: '1px solid var(--color-iron-veil)', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>{path}[{index}]</span>
              <span style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="btn-small" disabled={index === 0} onClick={() => onChange(move(value, index, index - 1))} aria-label="Move up">↑</button>
                <button type="button" className="btn-small" disabled={index === value.length - 1} onClick={() => onChange(move(value, index, index + 1))} aria-label="Move down">↓</button>
                <button type="button" className="btn-small" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Remove item ${index + 1}`}>
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
            <ValueEditor
              value={item}
              path={`${path}[${index}]`}
              depth={depth + 1}
              onChange={(next) => onChange(value.map((v, i) => (i === index ? next : v)))}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn-small"
          onClick={() => onChange([...value, emptyLike(value[0])])}
          style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <Plus size={12} /> Add item
        </button>
      </div>
    );
  }

  if (value !== null && typeof value === 'object') {
    return (
      <div style={{ display: 'grid', gap: '10px' }}>
        {Object.entries(value).map(([key, child]) => (
          <div key={key}>
            <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginBottom: '4px' }}>{key}</div>
            <ValueEditor
              value={child}
              path={`${path}.${key}`}
              depth={depth + 1}
              onChange={(next) => onChange({ ...value, [key]: next })}
            />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    );
  }

  if (typeof value === 'number') {
    return (
      <input type="number" className="input-field" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }} />
    );
  }

  const long = typeof value === 'string' && (value.length > 80 || value.includes('\n'));
  return long ? (
    <textarea
      className="input-field"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ minHeight: '76px', backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)', resize: 'vertical' }}
    />
  ) : (
    <input
      type="text"
      className="input-field"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}
    />
  );
}

function move(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A blank item with the same field names as the one being copied. */
function emptyLike(sample) {
  if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
    return Object.fromEntries(Object.keys(sample).map((k) => [k, typeof sample[k] === 'boolean' ? false : '']));
  }
  return '';
}

// Exported for the render suite. The generic editor is the part of this screen
// most likely to be wrong in a way that only shows up on a real value, and both
// of these are pure.
export { move, emptyLike, ValueEditor };

/* ── shared bits ───────────────────────────────────────────────────────────── */

function Text({ label, value, onChange, type = 'text', max, hint, required }) {
  return (
    <div>
      <label className="form-label" style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>
        {label}{required && <span style={{ color: 'var(--color-cyan-pulse)' }}> *</span>}
      </label>
      <input
        type={type}
        className="input-field"
        value={value ?? ''}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}
      />
      {hint && <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="form-label" style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>{label}</label>
      <select
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-iron-veil)' }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ErrorBar({ message }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', margin: '14px 0', borderRadius: '8px', border: '1px solid #7f1d1d', backgroundColor: '#2a1215', color: '#fecaca', fontSize: '13px' }}>
      <AlertTriangle size={15} /> {message}
    </div>
  );
}

export default AdminContentPage;
