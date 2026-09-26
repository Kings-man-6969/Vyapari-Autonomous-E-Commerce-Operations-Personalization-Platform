import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, RotateCcw, GripVertical, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { findOptionClash, parseOptionLines, optionLabel } from '../lib/optionLines';

/**
 * The seller's option editor.
 *
 * Everything here is deliberately separate from the product form above it. A
 * size run has a lifecycle of its own -- options are added, paused, reordered and
 * retired independently of a title edit -- and merging the two into one submit
 * would mean a seller who mistypes a description could take a live size run down
 * with it. Each row saves itself.
 *
 * Two rules the UI has to make visible, because the database enforces them and a
 * seller hitting an unexplained 400 has no way to guess:
 *
 *   A paused option stops counting. It is kept, not deleted, so its price and
 *   SKU survive and the PDP can say the size is unavailable rather than the
 *   product no longer having that size at all.
 *
 *   An option that has been ordered is retired rather than deleted, because
 *   order history would lose the SKU. The API reports which it did, and this
 *   shows the real message rather than a generic "done", since "Delete"
 *   producing a hidden row is otherwise indistinguishable from a bug.
 */

const BLANK = { attributes: {}, price: '', compare_at_price: '', stock_qty: 0, sku: '', is_default: false };

const label = (attributes) => optionLabel(attributes) || '(no attributes)';

const money = (v) => (v === null || v === undefined || v === '' ? '' : String(v));

export function VariantEditor({ productId, onProductChanged }) {
  const [state, setState] = useState({ loading: true, variants: [], axes: [], has_variants: false, max: 50 });
  const [drafts, setDrafts] = useState({});      // id -> in-flight field edits
  const [newRow, setNewRow] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/products/${productId}/variants`);
      const d = res.data?.data || {};
      setState({
        loading: false,
        variants: d.variants || [],
        axes: d.axes || [],
        has_variants: !!d.has_variants,
        max: d.max_variants || 50
      });
      setDrafts({});
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      setNote({ type: 'error', text: err.response?.data?.error?.message || 'Could not load options.' });
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const say = (type, text) => setNote({ type, text });

  // A reload after every mutation, rather than patching local state optimistically.
  // Option edits have consequences the client cannot compute: adding a second
  // option flips the product into a variant product and re-sums its stock, and
  // dropping to one promotes that option's price onto the product. Showing the
  // server's answer is the only version of this that is not a guess.

  const after = async (message) => {
    await load();
    onProductChanged?.();
    if (message) say('success', message);
  };

  const saveRow = async (variant) => {
    const draft = drafts[variant.id];
    if (!draft) return;
    setBusy(variant.id);
    try {
      const body = { ...draft };
      if (body.price === '' || body.price === null) body.price = null;
      if (body.compare_at_price === '') body.compare_at_price = null;
      body.stock_qty = parseInt(body.stock_qty, 10) || 0;
      const res = await api.put(`/products/${productId}/variants/${variant.id}`, body);
      await after(res.data?.message || 'Option saved.');
    } catch (err) {
      say('error', err.response?.data?.error?.message || err.response?.data?.message || 'Could not save that option.');
    } finally {
      setBusy(null);
    }
  };

  const addRow = async () => {
    if (!newRow) return;
    setBusy('new');
    try {
      // The same "axis: value" parsing the create form uses, so an option typed
      // here and one typed there arrive at the server in the same shape -- which
      // is what its duplicate-set check compares.
      const { attributes, bad } = parseOptionLines(newRow.attributeLines);

      if (bad.length > 0) {
        say('error', `"${bad[0]}" is not an axis. Each line should read "size: XL".`);
        return;
      }
      if (Object.keys(attributes).length === 0) {
        say('error', 'An option needs at least one attribute, e.g. "size: XL".');
        return;
      }

      // Caught here, not left to the unique index. jsonb equality is
      // case-sensitive, so "Size: XL" and "size:xl" satisfy the index happily and
      // the customer ends up choosing between two pills reading XL and xl. The
      // error the database would give names a constraint, not the option.
      const clash = findOptionClash(state.variants, attributes);
      if (clash) {
        say('error', `${optionLabel(clash.attributes)} is already in this run. Edit that one instead.`);
        return;
      }

      const body = {
        attributes,
        price: newRow.price === '' ? null : parseFloat(newRow.price),
        compare_at_price: newRow.compare_at_price === '' ? null : parseFloat(newRow.compare_at_price),
        stock_qty: parseInt(newRow.stock_qty, 10) || 0,
        sku: newRow.sku || null,
        is_default: !!newRow.is_default
      };
      const res = await api.post(`/products/${productId}/variants`, body);
      setNewRow(null);
      await after(res.data?.message || 'Option added.');
    } catch (err) {
      say('error', err.response?.data?.error?.message || err.response?.data?.message || 'Could not add that option.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (variant) => {
    const name = label(variant.attributes);
    if (!window.confirm(
      variant.is_active
        ? `Remove "${name}"? If it has been ordered it is retired and hidden from buyers; if not, it is deleted.`
        : `Delete "${name}" permanently?`
    )) return;
    setBusy(variant.id);
    try {
      const res = await api.delete(`/products/${productId}/variants/${variant.id}`);
      // The API's own wording, because "Delete" sometimes meaning "hide" is the
      // single most confusing thing this endpoint can do.
      await after(res.data?.message || 'Option removed.');
    } catch (err) {
      say('error', err.response?.data?.error?.message || 'Could not remove that option.');
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (variant) => {
    setBusy(variant.id);
    try {
      await api.put(`/products/${productId}/variants/${variant.id}`, { is_active: !variant.is_active });
      await after(
        variant.is_active
          ? `"${label(variant.attributes)}" paused. It is kept, and no longer counts towards stock.`
          : `"${label(variant.attributes)}" is back on sale.`
      );
    } catch (err) {
      say('error', err.response?.data?.error?.message || 'Could not change that option.');
    } finally {
      setBusy(null);
    }
  };

  const makeDefault = async (variant) => {
    setBusy(variant.id);
    try {
      await api.put(`/products/${productId}/variants/${variant.id}`, { is_default: true });
      await after(`"${label(variant.attributes)}" is now the option customers get by default.`);
    } catch (err) {
      say('error', err.response?.data?.error?.message || 'Could not set the default option.');
    } finally {
      setBusy(null);
    }
  };

  const reorder = async (index, direction) => {
    const next = [...state.variants];
    const to = index + direction;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setState((s) => ({ ...s, variants: next }));   // optimistic; the reload corrects it
    try {
      await api.put(`/products/${productId}/variants/order`, { variant_ids: next.map((v) => v.id) });
      await after('Order saved.');
    } catch (err) {
      say('error', err.response?.data?.error?.message || 'Could not reorder.');
      await load();
    }
  };

  const edit = (id, field, value) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), [field]: value } }));

  const draftOf = (v) => drafts[v.id] || {};

  const liveTotal = useMemo(
    () => state.variants.filter((v) => v.is_active).reduce((n, v) => n + (v.stock_qty || 0), 0),
    [state.variants]
  );

  if (state.loading) {
    return <div className="skeleton" style={{ height: '120px' }} />;
  }

  return (
    <div
      className="table-card"
      style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)', marginTop: '24px' }}
      onKeyDown={(e) => {
        // This panel sits inside the product form, so pressing Enter in a stock
        // box would submit the product -- saving the listing's description and
        // title, and reporting "Product updated", when the seller was typing a
        // quantity. A textarea is left alone because there Enter is a newline.
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 330, color: '#ffffff', margin: 0 }}>
          Options
        </h3>
        <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>
          {state.variants.length} of {state.max} &middot; {liveTotal} sellable
          {state.has_variants && ' (product stock is this total)'}
        </span>
      </div>

      {state.axes.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', margin: '0 0 14px' }}>
          Axes: {state.axes.map((a) => a.label).join(', ')}
        </p>
      )}

      {note.text && (
        <div
          role="status"
          style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: note.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${note.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
            color: note.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5'
          }}
        >
          {note.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{note.text}</span>
        </div>
      )}

      {state.variants.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-ash-label)', marginBottom: '16px' }}>
          No options yet. This product is sold as a single item, which is fine --
          add options when one listing needs to cover several sizes or colours.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {state.variants.map((v, idx) => {
            const d = draftOf(v);
            const dirty = Object.keys(d).length > 0;
            const dim = !v.is_active;

            return (
              <div
                key={v.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr repeat(4, minmax(72px, 96px)) auto',
                  gap: '8px', alignItems: 'center',
                  padding: '10px 12px', borderRadius: '8px',
                  border: `1px solid ${dim ? 'var(--color-border-steel)' : 'var(--color-iron-veil)'}`,
                  backgroundColor: dim ? 'rgba(255,255,255,0.02)' : 'transparent',
                  opacity: dim ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button type="button" onClick={() => reorder(idx, -1)} disabled={idx === 0}
                    title="Move up" style={{ background: 'none', border: 'none', color: 'var(--color-ash-label)', cursor: idx === 0 ? 'default' : 'pointer', padding: 0 }}>
                    <GripVertical size={13} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                  <button type="button" onClick={() => reorder(idx, 1)} disabled={idx === state.variants.length - 1}
                    title="Move down" style={{ background: 'none', border: 'none', color: 'var(--color-ash-label)', cursor: 'pointer', padding: 0 }}>
                    <GripVertical size={13} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                    {label(v.attributes)}
                    {v.is_default && (
                      <span title="Sold when the customer has not chosen" style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--color-electric-lime)', border: '1px solid var(--color-electric-lime)', borderRadius: '3px', padding: '0 4px' }}>
                        DEFAULT
                      </span>
                    )}
                  </div>
                  {v.sku && <div style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>SKU {v.sku}</div>}
                  {!v.in_stock && v.is_active && (
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)' }}>No stock</div>
                  )}
                </div>

                <input className="input-field" type="number" step="0.01" min="0" placeholder="₹"
                  title="Price. Leave blank to use the product price."
                  value={d.price !== undefined ? d.price : money(v.price)}
                  onChange={(e) => edit(v.id, 'price', e.target.value)} />
                <input className="input-field" type="number" min="0" placeholder="Qty"
                  value={d.stock_qty !== undefined ? d.stock_qty : v.stock_qty}
                  onChange={(e) => edit(v.id, 'stock_qty', e.target.value)} />
                <input className="input-field" placeholder="SKU"
                  value={d.sku !== undefined ? d.sku : (v.sku || '')}
                  onChange={(e) => edit(v.id, 'sku', e.target.value)} />
                <input className="input-field" placeholder="₹ was"
                  value={d.compare_at_price !== undefined ? d.compare_at_price : money(v.compare_at_price)}
                  onChange={(e) => edit(v.id, 'compare_at_price', e.target.value)} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {dirty && (
                    <button type="button" onClick={() => saveRow(v)} disabled={busy === v.id}
                      title="Save this option" style={{ background: 'none', border: 'none', color: 'var(--color-electric-lime)', cursor: 'pointer', padding: '2px' }}>
                      <Save size={14} />
                    </button>
                  )}
                  <button type="button" onClick={() => toggleActive(v)} disabled={busy === v.id}
                    title={v.is_active ? 'Pause — stops counting towards stock' : 'Put back on sale'}
                    style={{ fontSize: '11px', background: 'none', border: '1px solid var(--color-border-steel)', borderRadius: '4px', color: v.is_active ? 'var(--color-warning)' : 'var(--color-icy-steel)', cursor: 'pointer', padding: '2px 6px' }}>
                    {v.is_active ? 'Pause' : 'Resume'}
                  </button>
                  {!v.is_default && v.is_active && (
                    <button type="button" onClick={() => makeDefault(v)} disabled={busy === v.id}
                      title="Sell this one when the customer has not chosen"
                      style={{ fontSize: '11px', background: 'none', border: '1px solid var(--color-border-steel)', borderRadius: '4px', color: 'var(--color-ash-label)', cursor: 'pointer', padding: '2px 6px' }}>
                      Set default
                    </button>
                  )}
                  <button type="button" onClick={() => remove(v)} disabled={busy === v.id}
                    title="Remove this option"
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state.variants.length < state.max && (
        <div>
          {!newRow ? (
            <button type="button" onClick={() => setNewRow({ ...BLANK })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-electric-lime)', background: 'none', border: '1px dashed var(--color-border-steel)', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}>
              <Plus size={14} /> Add an option
            </button>
          ) : (
            <div style={{ border: '1px solid var(--color-iron-veil)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 90px 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Attributes</label>
                  <textarea className="textarea-field" rows={2} placeholder={'size: XL\ncolour: Indigo'}
                    value={newRow.attributeLines || ''}
                    onChange={(e) => setNewRow({ ...newRow, attributeLines: e.target.value })}
                    style={{ fontSize: '12px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Price (₹)</label>
                  <input className="input-field" type="number" step="0.01" min="0" placeholder="use product price"
                    value={newRow.price} onChange={(e) => setNewRow({ ...newRow, price: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Stock</label>
                  <input className="input-field" type="number" min="0"
                    value={newRow.stock_qty} onChange={(e) => setNewRow({ ...newRow, stock_qty: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>SKU</label>
                  <input className="input-field"
                    value={newRow.sku} onChange={(e) => setNewRow({ ...newRow, sku: e.target.value })} />
                </div>
                <div>
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Was (₹)</label>
                  <input className="input-field" type="number" step="0.01" min="0"
                    value={newRow.compare_at_price} onChange={(e) => setNewRow({ ...newRow, compare_at_price: e.target.value })} />
                </div>
              </div>
              <label style={{ fontSize: '12px', color: 'var(--color-tide-pool)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <input type="checkbox" checked={newRow.is_default}
                  onChange={(e) => setNewRow({ ...newRow, is_default: e.target.checked })} />
                Sell this one when the customer has not chosen
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={addRow} disabled={busy === 'new'}
                  style={{ fontSize: '12px', fontWeight: 600, background: '#ffffff', color: '#02090a', border: 'none', borderRadius: '9999px', padding: '7px 16px', cursor: 'pointer' }}>
                  {busy === 'new' ? 'Adding...' : 'Add option'}
                </button>
                <button type="button" onClick={() => setNewRow(null)}
                  style={{ fontSize: '12px', background: 'none', border: '1px solid var(--color-border-steel)', color: 'var(--color-icy-steel)', borderRadius: '9999px', padding: '7px 16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <RotateCcw size={12} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {state.variants.length > 0 && (
        <p style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '14px', marginBottom: 0 }}>
          Pausing an option keeps it, and its price and SKU, but it stops counting towards
          stock and is hidden from buyers. Removing one that has been ordered retires it
          instead, so past orders still say what was bought.
        </p>
      )}
    </div>
  );
}

export default VariantEditor;
