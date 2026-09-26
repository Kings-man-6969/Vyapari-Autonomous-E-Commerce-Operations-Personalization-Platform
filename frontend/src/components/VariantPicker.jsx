import React, { useMemo, useState, useEffect } from 'react';

/**
 * Option picker for a product that offers a choice.
 *
 * Presentational and stateful about the *choice* only. Which option that choice
 * resolves to, what it costs and how many are left are all derived here from the
 * variants the API already sent in full, so the numbers on this screen and the
 * numbers the bag and the order are charged cannot come from two different
 * places.
 *
 * The awkward part of a multi-axis picker is availability, and it is worth being
 * explicit about the rule because the obvious implementation is wrong:
 *
 *   "Indigo" has stock, so Indigo is selectable  -- until the customer has also
 *   chosen Large, and every Indigo Large is gone while Indigo Small is not.
 *
 * So a value is available only if some *in-stock* option carries it that also
 * matches every other axis the customer has already chosen. That is the answer
 * the customer is actually asking for, and it is why the full variant list is
 * sent rather than only a per-axis count.
 */

const matches = (variant, choice) =>
  Object.entries(choice).every(([key, value]) => variant.attributes?.[key] === value);

/**
 * The option a choice resolves to.
 *
 * Prefers one that can be bought. Falls back to an out-of-stock one so the
 * screen can say "that combination is gone" rather than reverting the customer's
 * clicks and showing a different product than they were looking at. Returns null
 * only when the choice names a combination that does not exist at all, which
 * happens mid-selection on a two-axis product and is a normal state, not an error.
 */
export function resolveChoice(variants, choice) {
  if (!variants?.length) return null;
  const exact = variants.filter((v) => matches(v, choice));
  return exact.find((v) => v.in_stock) || exact[0] || null;
}

export function VariantPicker({ axes = [], variants = [], onChange, value, initialVariantId }) {
  const [choice, setChoice] = useState({});

  const chosen = useMemo(() => resolveChoice(variants, choice), [variants, choice]);

  // Open the picker on something buyable rather than on nothing.
  //
  // Nothing is preselected only when there is genuinely nothing to preselect --
  // a product with one option, or one whose sole option is out of stock. Every
  // other case starts on the default option so the price and stock on the page
  // are the ones that will be charged, instead of the product's own numbers
  // until the customer touches something.
  //
  // The seed is reported to the parent, but flagged: a page that shows "M" as
  // selected has to be pricing M, and a parent that only heard about a
  // customer-initiated change would keep showing the product's price beside a
  // highlighted M. What the parent must not do is rewrite the URL for it --
  // arriving at a product should not immediately dirty the address bar.
  useEffect(() => {
    if (!variants.length) {
      setChoice({});
      return;
    }
    const requested = variants.find((v) => v.id === initialVariantId);
    const start = requested || variants.find((v) => v.is_default && v.in_stock)
      || variants.find((v) => v.in_stock)
      || variants.find((v) => v.is_default)
      || variants[0];
    const seeded = { ...(start.attributes || {}) };
    setChoice(seeded);
    onChange?.(resolveChoice(variants, seeded), { seeded: true });
    // Only re-seed when the set of options changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants.map((v) => v.id).join(',')]);

  // A controlled parent (the PDP keeps the choice in the URL) wins over local
  // state, so a shared link to a specific size opens on that size.
  useEffect(() => {
    if (!value) return;
    const asId = typeof value === 'string' ? value : value.id;
    const found = variants.find((v) => v.id === asId);
    if (found) setChoice({ ...(found.attributes || {}) });
  }, [value, variants]);

  const pick = (key, nextValue) => {
    let next = { ...choice, [key]: nextValue };

    // Choosing a value can invalidate the rest of the choice -- picking Large
    // when only Large Indigo is left and Indigo is already chosen leaves no
    // buyable option. Rather than refusing the click, or silently dropping the
    // other axis, complete the choice from the options that do exist. A single
    // axis (sizes only) never reaches this.
    if (!resolveChoice(variants, next)) {
      for (const axis of axes) {
        if (axis.key in next) continue;
        const fill = variants.find((v) => v.in_stock && matches(v, next));
        if (fill) {
          next = { ...next, ...(fill.attributes || {}) };
          break;
        }
      }
    }

    setChoice(next);
    onChange?.(resolveChoice(variants, next));
  };

  if (!axes.length) return null;

  return (
    <div style={{ marginBottom: '18px' }}>
      {axes.map((axis) => {
        const current = choice[axis.key];

        return (
          <div key={axis.key} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>{axis.label}:</span>
              {current && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>{current}</span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {axis.values.map((entry) => {
                const isSelected = current === entry.value;

                // Availability is judged against the other axes as chosen, not
                // in isolation. See the note at the top of the file.
                const reachable = variants.some(
                  (v) => v.in_stock
                    && v.attributes?.[axis.key] === entry.value
                    && Object.entries(choice)
                      .filter(([k]) => k !== axis.key)
                      .every(([k, val]) => v.attributes?.[k] === val)
                );

                return (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => pick(axis.key, entry.value)}
                    disabled={!reachable}
                    aria-pressed={isSelected}
                    title={reachable ? undefined : 'Not available in this combination'}
                    style={{
                      padding: '8px 14px',
                      minWidth: '46px',
                      borderRadius: '4px',
                      border: isSelected
                        ? '1px solid var(--color-electric-lime)'
                        : '1px solid var(--color-iron-veil)',
                      backgroundColor: isSelected ? 'rgba(212, 255, 63, 0.12)' : 'var(--color-deep-canopy)',
                      color: !reachable
                        ? 'var(--color-ash-label)'
                        : isSelected ? 'var(--color-electric-lime)' : '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: reachable ? 'pointer' : 'not-allowed',
                      opacity: reachable ? 1 : 0.45,
                      textDecoration: reachable ? 'none' : 'line-through',
                      outline: 'none'
                    }}
                  >
                    {entry.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {chosen && !chosen.in_stock && (
        <div
          role="status"
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            color: 'var(--color-error)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            border: '1px solid rgba(244, 63, 94, 0.3)'
          }}
        >
          This combination is out of stock. Try another{axes.length > 1 ? ' size or colour' : ' option'}.
        </div>
      )}

      {chosen && chosen.in_stock && chosen.stock_qty <= 5 && (
        <div style={{ color: 'var(--color-warning)', fontSize: '12px', fontWeight: 600 }}>
          Only {chosen.stock_qty} left{chosen.sku ? ` in ${chosen.sku}` : ''} - order soon.
        </div>
      )}
    </div>
  );
}

export default VariantPicker;
