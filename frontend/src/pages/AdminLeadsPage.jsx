import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Download, Inbox, X, MessageSquarePlus, UserCheck, AlertTriangle, Loader2
} from 'lucide-react';
import api from '../services/api';

/**
 * Admin leads inbox — the screen that drives the H2 routes.
 *
 * Three decisions worth stating:
 *
 *  * **Status is a row of counts, not a dropdown.** The inbox's most common
 *    question is "what still needs doing", so the counts are the filter. Every
 *    status is rendered even at zero, because a filter bar whose buttons appear
 *    and disappear as counts change moves under the cursor.
 *
 *  * **The export is fetched as a blob, not linked.** Auth is an in-memory
 *    bearer token, so a plain `<a href>` would send no credentials and get a 401.
 *    It is the same reason the search and the save go through the shared client.
 *
 *  * **A note is saved by a route of its own.** Sending the status dropdown's
 *    current value alongside every note would re-fire the status-change event on
 *    each save and fill the log with "Status: contacted → contacted" rows.
 */

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'];

const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
  spam: 'Spam'
};

const SOURCE_LABEL = {
  contact_form: 'Contact form',
  product_enquiry: 'Product enquiry',
  seller_page: 'Store enquiry',
  checkout_abandon: 'Abandoned checkout',
  manual: 'Added by admin'
};

// Reuses the `.status-pill-*` classes the rest of the console uses, so a lead
// status and an order status are coloured the same way when they share a name.
const STATUS_PILL = {
  new: 'pending',
  contacted: 'processing',
  qualified: 'shipped',
  won: 'delivered',
  lost: 'cancelled',
  spam: 'archived'
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const contactOf = (lead) => lead.email || lead.phone || '—';

export const AdminLeadsPage = () => {
  const [summary, setSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [sort, setSort] = useState('newest');
  // `search` is what the box shows; `q` is what has been sent. Debouncing the
  // sent value rather than the box keeps typing responsive while the request
  // count stays sane.
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [exporting, setExporting] = useState(false);

  const listRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    if (source) p.source = source;
    if (unassigned) p.unassigned = 'true';
    if (q) p.q = q;
    if (sort) p.sort = sort;
    return p;
  }, [status, source, unassigned, q, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.get('/admin/leads', { params: { ...params, limit: 50 } }),
        api.get('/admin/leads/summary', { params: q ? { q } : {} })
      ]);
      setLeads(listRes.data?.data || []);
      setTotal(listRes.data?.pagination?.total ?? 0);
      setSummary(summaryRes.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the inbox.');
    } finally {
      setLoading(false);
    }
  }, [params, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // The assignee dropdown needs the admin list. Fetched once: an admin roster
    // does not change while the inbox is open.
    api.get('/admin/users', { params: { role: 'admin' } })
      .then((res) => setAdmins(res.data?.data || []))
      .catch(() => setAdmins([]));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/leads/export.csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not build the export.');
    } finally {
      setExporting(false);
    }
  };

  const selected = leads.find((l) => l.id === selectedId) || null;

  const clearFilters = () => {
    setStatus('');
    setSource('');
    setUnassigned(false);
    setSearch('');
    setQ('');
  };

  const filtersActive = !!(status || source || unassigned || q);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 className="heading-whisper" style={{ fontSize: '26px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Inbox size={22} /> Enquiries
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px', marginTop: '6px' }}>
            {summary
              ? `${summary.open} open · ${summary.unassigned} unassigned · ${summary.total} total`
              : 'Loading…'}
          </p>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={handleExport}
          disabled={exporting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Export CSV
        </button>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #7f1d1d', backgroundColor: '#2a1215', color: '#fecaca', fontSize: '13px' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Status counts as filters. Every status renders even at zero. */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <FilterChip
          active={status === ''}
          onClick={() => setStatus('')}
          label="All"
          count={summary?.total}
        />
        {STATUS_ORDER.map((s) => (
          <FilterChip
            key={s}
            active={status === s}
            onClick={() => setStatus(status === s ? '' : s)}
            label={STATUS_LABEL[s]}
            count={summary?.counts?.[s] ?? 0}
          />
        ))}
        <span style={{ width: '1px', backgroundColor: 'var(--color-iron-veil)', margin: '0 4px' }} />
        <FilterChip
          active={unassigned}
          onClick={() => setUnassigned((v) => !v)}
          label="Unassigned"
          count={summary?.unassigned}
          tone="warn"
        />
      </div>

      <div ref={listRef} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
          <Search size={15} color="var(--color-ash-label)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            className="input-field"
            placeholder="Search name, email, phone or message"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
          />
        </div>

        <select
          className="input-field"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ width: 'auto', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
        >
          <option value="">Any source</option>
          {Object.entries(SOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          className="input-field"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ width: 'auto', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        {filtersActive && (
          <button type="button" className="btn-small" onClick={clearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Received</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Latest note</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <tr key={n}>
                    <td colSpan={6}><div className="skeleton" style={{ height: '16px', borderRadius: '4px' }} /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-tide-pool)' }}>
                    {filtersActive ? 'No enquiries match these filters.' : 'No enquiries yet.'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--color-silver-glow)' }}>
                      {formatDate(lead.created_at)}
                    </td>
                    <td>
                      <div style={{ color: '#ffffff', fontWeight: 500 }}>{lead.name || 'Anonymous'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>{contactOf(lead)}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                      {SOURCE_LABEL[lead.source] || lead.source}
                    </td>
                    <td>
                      <span className={`status-pill status-pill-${STATUS_PILL[lead.status] || 'pending'}`}>
                        {STATUS_LABEL[lead.status] || lead.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-silver-glow)' }}>
                      {lead.assigned_to ? 'Assigned' : '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-tide-pool)', maxWidth: '260px' }}>
                      {lead.notes ? truncate(lead.notes, 70) : '—'}
                      {lead.note_count > 0 && (
                        <span style={{ marginLeft: '6px', color: 'var(--color-ash-label)' }}>
                          ({lead.note_count})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--color-iron-veil)', fontSize: '12px', color: 'var(--color-tide-pool)' }}>
          <span>Showing {leads.length} of {total}</span>
          {leads.length > 0 && <span>Click a row to open it</span>}
        </div>
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          admins={admins}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};

function truncate(text, max) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function FilterChip({ active, onClick, label, count, tone }) {
  const activeColor = tone === 'warn' ? 'var(--color-solar-amber, #f59e0b)' : 'var(--color-cyan-pulse)';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '7px 13px',
        borderRadius: '9999px',
        border: `1px solid ${active ? activeColor : 'var(--color-iron-veil)'}`,
        backgroundColor: active ? 'var(--color-forest-floor)' : 'transparent',
        color: active ? '#ffffff' : 'var(--color-tide-pool)',
        fontSize: '12.5px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer'
      }}
    >
      {label}
      {typeof count === 'number' && (
        <span style={{
          minWidth: '18px',
          padding: '0 5px',
          borderRadius: '9999px',
          backgroundColor: active ? activeColor : 'var(--color-forest-floor)',
          color: active ? '#0b0f14' : 'var(--color-tide-pool)',
          fontSize: '11px',
          fontWeight: 700,
          textAlign: 'center'
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function LeadDrawer({ lead, admins, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [noteError, setNoteError] = useState(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/leads/${lead.id}`);
      setDetail(res.data?.data || null);
    } catch {
      setError('Could not load this enquiry.');
    } finally {
      setLoading(false);
    }
  }, [lead.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Escape closes the drawer. A modal with no keyboard exit traps the admin.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = async (payload) => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/leads/${lead.id}`, payload);
      await loadDetail();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'That change was refused.');
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    setNoteError(null);
    try {
      await api.post(`/admin/leads/${lead.id}/notes`, { body: note.trim() });
      setNote('');
      await loadDetail();
      if (onChanged) await onChanged();
    } catch (err) {
      setNoteError(err?.response?.data?.error?.message || 'That note was refused.');
    } finally {
      setBusy(false);
    }
  };

  const data = detail || lead;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 10, 0.72)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Enquiry detail"
        style={{ width: 'min(560px, 100%)', height: '100%', overflowY: 'auto', backgroundColor: 'var(--color-abyssal-ink)', borderLeft: '1px solid var(--color-iron-veil)', padding: '24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 className="heading-whisper" style={{ fontSize: '20px', margin: 0 }}>
              {data.name || 'Anonymous'}
            </h2>
            <div style={{ fontSize: '12.5px', color: 'var(--color-tide-pool)', marginTop: '4px' }}>
              {SOURCE_LABEL[data.source] || data.source} · {formatDate(data.created_at)}
            </div>
          </div>
          <button type="button" className="btn-small" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #7f1d1d', backgroundColor: '#2a1215', color: '#fecaca', fontSize: '12.5px' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '18px', display: 'grid', gap: '8px', fontSize: '13px' }}>
          <Row label="Email" value={data.email || '—'} />
          <Row label="Phone" value={data.phone || '—'} />
          {data.product && (
            <Row label="Product" value={data.product.title} />
          )}
          {data.seller_name && <Row label="Store" value={data.seller_name} />}
          <Row label="Enquiry ID" value={<code style={{ fontSize: '11px' }}>{data.id}</code>} />
        </div>

        {data.message && (
          <div style={{ marginTop: '18px' }}>
            <Label>Message</Label>
            <div style={{ marginTop: '6px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--color-iron-veil)', backgroundColor: 'var(--color-deep-canopy)', fontSize: '13px', color: 'var(--color-ghost-white)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {data.message}
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <Label>Status</Label>
            <select
              className="input-field"
              value={data.status}
              disabled={busy}
              onChange={(e) => patch({ status: e.target.value })}
              style={{ marginTop: '6px', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Assigned to</Label>
            <select
              className="input-field"
              value={data.assigned_to || ''}
              disabled={busy}
              onChange={(e) => patch({ assigned_to: e.target.value || null })}
              style={{ marginTop: '6px', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
            >
              <option value="">Unassigned</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '22px' }}>
          <Label>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquarePlus size={14} /> Notes
            </span>
          </Label>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              className="input-field"
              placeholder="Add an internal note"
              value={note}
              maxLength={4000}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addNote();
                }
              }}
              style={{ backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
            />
            <button type="button" className="btn-primary" onClick={addNote} disabled={busy || !note.trim()} style={{ padding: '10px 18px', opacity: busy || !note.trim() ? 0.55 : 1 }}>
              Add
            </button>
          </div>
          {noteError && (
            <div role="alert" style={{ marginTop: '8px', fontSize: '12px', color: '#fecaca' }}>{noteError}</div>
          )}

          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading && !detail ? (
              <div className="skeleton" style={{ height: '48px', borderRadius: '8px' }} />
            ) : (data.notes_log || []).length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', margin: 0 }}>No notes yet.</p>
            ) : (
              data.notes_log.map((n) => (
                <div key={n.id} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-iron-veil)', backgroundColor: 'var(--color-deep-canopy)' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-ghost-white)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {n.body}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <UserCheck size={11} /> {n.author_name || 'Removed admin'} · {formatDate(n.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--color-ash-label)' }}>{label}</span>
      <span style={{ color: '#ffffff', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="form-label" style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>
      {children}
    </label>
  );
}

export default AdminLeadsPage;
