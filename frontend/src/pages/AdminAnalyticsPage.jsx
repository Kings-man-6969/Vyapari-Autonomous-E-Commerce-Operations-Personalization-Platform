import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import api from '../services/api';

/**
 * Admin analytics — the screen for I4 (product performance) and I5 (sales over
 * time), plus the rollup's freshness from I1.
 *
 * The chart is CSS bars rather than a charting library. Two reasons: the bundle
 * is already the largest thing in the app and a chart library is 100–300 kB for
 * one screen, and every charting library wants to render its own SVG with inline
 * styles, which the production CSP allows (`style-src 'unsafe-inline'`) but
 * which is a lot of surface for a bar per day.
 *
 * Two things the screen is careful to say out loud, because the API computes
 * both and a silent default would be a lie:
 *
 *  * **A null percentage is not 0%.** `revenue_change_pct` is null when there is
 *    no previous window to compare against, and rendering that as "+0%" hides
 *    the one case where a product's first sale is most interesting.
 *
 *  * **Conversion of null is not 0%.** A product nobody looked at has no
 *    conversion rate. Rendering "0.00%" would rank it alongside a product that
 *    genuinely converts badly.
 */

const money = (n) =>
  n === null || n === undefined
    ? '—'
    : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const pct = (n) => (n === null || n === undefined ? '—' : `${n.toFixed(2)}%`);

export const AdminAnalyticsPage = () => {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('sales');

  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState([]);
  const [rollup, setRollup] = useState(null);
  const [sort, setSort] = useState('revenue');
  const [includeZero, setIncludeZero] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, rollupRes] = await Promise.all([
        api.get('/admin/analytics/sales', { params: { days } }),
        api.get('/admin/analytics/rollup')
      ]);
      setSales(salesRes.data?.data || null);
      setRollup(rollupRes.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get('/admin/analytics/products', {
        params: { days, sort, include_zero: includeZero ? 'true' : 'false', limit: 50 }
      });
      setProducts(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load product performance.');
    }
  }, [days, sort, includeZero]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'products') loadProducts();
  }, [tab, loadProducts]);

  const runRollup = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/analytics/rollup', { days });
      await load();
      if (tab === 'products') await loadProducts();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'The rollup failed.');
    } finally {
      setBusy(false);
    }
  };

  const totals = sales?.totals;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 className="heading-whisper" style={{ fontSize: '26px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={22} /> Analytics
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px', marginTop: '6px' }}>
            {sales ? `${sales.from} to ${sales.to}` : 'Loading…'}
            {rollup?.last_rolled_up_day && ` · rolled up to ${rollup.last_rolled_up_day}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="input-field"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 'auto', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
          >
            {[7, 30, 90, 180].map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button
            type="button"
            className="btn-outline"
            onClick={runRollup}
            disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 16px', opacity: busy ? 0.6 : 1 }}
          >
            <RefreshCw size={14} /> {busy ? 'Rolling up…' : 'Re-run rollup'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #7f1d1d', backgroundColor: '#2a1215', color: '#fecaca', fontSize: '13px' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* The rollup is the source of every number below it. If it stopped, every
          figure on this page is stale and nothing else would say so. */}
      {rollup && (rollup.stale_days > 1 || rollup.failed_runs > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #78350f', backgroundColor: '#2a1f0a', color: '#fde68a', fontSize: '13px' }}>
          <AlertTriangle size={15} />
          {rollup.failed_runs > 0
            ? `${rollup.failed_runs} rollup run(s) failed. Figures below may be incomplete.`
            : `The rollup is ${rollup.stale_days} days behind. Figures below are stale.`}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid var(--color-iron-veil)' }}>
        {[
          { id: 'sales', label: 'Sales' },
          { id: 'products', label: 'Product performance' }
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

      {loading && !sales ? (
        <div className="skeleton" style={{ height: '220px', borderRadius: '10px' }} />
      ) : tab === 'sales' ? (
        <SalesPanel sales={sales} />
      ) : (
        <ProductsPanel
          products={products}
          sort={sort}
          onSort={setSort}
          includeZero={includeZero}
          onToggleZero={setIncludeZero}
        />
      )}
    </div>
  );
};

function SalesPanel({ sales }) {
  if (!sales) return null;
  const t = sales.totals;
  const change = sales.revenue_change_pct;
  const up = typeof change === 'number' && change >= 0;
  const peak = Math.max(1, ...sales.series.map((d) => d.revenue));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        <Tile
          label="Revenue"
          value={money(t.revenue)}
          hint={change === null ? 'No previous window to compare' : `${up ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}% on the previous ${sales.days} days`}
          tone={change === null ? undefined : up ? 'good' : 'bad'}
          icon={change === null ? null : up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        />
        <Tile label="Paid orders" value={t.paid_orders} hint={`${t.orders} placed, ${t.orders - t.paid_orders} unpaid`} />
        <Tile
          label="Average order"
          value={t.aov === null ? '—' : money(t.aov)}
          hint="Per paid order, not per order placed"
        />
        <Tile label="Refunds repaid" value={money(t.refunds)} hint={`${money(t.refunds_pending)} still pending`} />
        <Tile label="Net revenue" value={money(t.net_revenue)} hint="Revenue less repaid refunds" />
      </div>

      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', margin: '0 0 10px' }}>
        Revenue per day
      </h3>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          height: '140px',
          padding: '12px',
          border: '1px solid var(--color-iron-veil)',
          backgroundColor: 'var(--color-deep-canopy)',
          borderRadius: '10px',
          overflowX: 'auto'
        }}
        role="img"
        aria-label={`Daily revenue for the last ${sales.series.length} days`}
      >
        {sales.series.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${money(d.revenue)} · ${d.paid_orders} paid order(s)`}
            style={{
              flex: '1 0 4px',
              minWidth: '3px',
              height: `${Math.max(2, (d.revenue / peak) * 100)}%`,
              backgroundColor: d.revenue > 0 ? 'var(--color-cyan-pulse)' : 'var(--color-iron-veil)',
              borderRadius: '2px 2px 0 0'
            }}
          />
        ))}
      </div>
      {/* Bars, not a line: a line across a day with no orders draws a slope
          through a value that does not exist, and a zero-height bar says
          "nothing" correctly. */}
      <p style={{ fontSize: '11.5px', color: 'var(--color-ash-label)', marginTop: '8px' }}>
        Each bar is one day. A day with no paid orders is a flat bar, not a gap.
      </p>
    </div>
  );
}

function ProductsPanel({ products, sort, onSort, includeZero, onToggleZero }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Rank by
        </span>
        <select
          className="input-field"
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          style={{ width: 'auto', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
        >
          <option value="revenue">Revenue</option>
          <option value="purchases">Units sold</option>
          <option value="views">Views</option>
          <option value="clicks">Clicks</option>
          <option value="conversion">Conversion</option>
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--color-tide-pool)' }}>
          <input type="checkbox" checked={includeZero} onChange={(e) => onToggleZero(e.target.checked)} />
          Include products with no activity
        </label>
      </div>

      <div style={{ backgroundColor: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Views</th>
                <th style={{ textAlign: 'right' }}>Clicks</th>
                <th style={{ textAlign: 'right' }}>Units</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Conversion</th>
                <th style={{ textAlign: 'right' }}>vs previous</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-tide-pool)' }}>
                    No product activity in this window. If that is unexpected, check the rollup above.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ color: '#ffffff', fontWeight: 500 }}>{p.title}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-tide-pool)' }}>
                        {p.status} · stock {p.stock_qty}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{p.views.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-tide-pool)' }}>{p.clicks}</td>
                    <td style={{ textAlign: 'right' }}>{p.purchases}</td>
                    <td style={{ textAlign: 'right', color: '#ffffff' }}>{money(p.revenue)}</td>
                    {/* null is "no views, so no rate", and it is rendered as a
                        dash rather than 0.00% -- which would rank a product
                        nobody has seen alongside one that converts badly. */}
                    <td style={{ textAlign: 'right' }}>{pct(p.conversion_pct)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <ChangeCell value={p.revenue_change_pct} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChangeCell({ value }) {
  if (value === null || value === undefined) {
    // "Was zero, is now something" has no percentage, and it is the case where
    // the change is most worth knowing.
    return <span style={{ color: 'var(--color-ash-label)', fontSize: '12px' }}>new</span>;
  }
  const up = value >= 0;
  return (
    <span style={{ color: up ? 'var(--color-cyan-pulse)' : '#fca5a5', fontSize: '12.5px' }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Tile({ label, value, hint, icon, tone }) {
  const color = tone === 'good' ? 'var(--color-cyan-pulse)' : tone === 'bad' ? '#fca5a5' : 'var(--color-tide-pool)';
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--color-iron-veil)', backgroundColor: 'var(--color-deep-canopy)', borderRadius: '10px' }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ash-label)' }}>
        {label}
      </div>
      <div style={{ fontSize: '21px', fontWeight: 600, color: '#ffffff', marginTop: '6px' }}>{value}</div>
      {hint && (
        <div style={{ fontSize: '11.5px', color, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {icon} {hint}
        </div>
      )}
    </div>
  );
}

export default AdminAnalyticsPage;
