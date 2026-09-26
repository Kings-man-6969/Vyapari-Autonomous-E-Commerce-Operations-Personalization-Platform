/**
 * The chosen option on a bag or order line: "Indigo / Large".
 *
 * A line item has to say which of the choices was made. Without it, a bag
 * holding one shirt in two sizes is two identical rows, the customer cannot
 * tell which is which, and neither can support -- and a line item that cannot be
 * read is a return request.
 *
 * `note` is for the one case where the line needs a caveat rather than just a
 * name:
 *   - the option was retired after it went in the bag, so the price and stock on
 *     this line are no longer the option's and the customer has to pick another
 *     one to check out;
 *   - the seller has since renamed the option, so the page can say what was
 *     bought at the time and what it is called now, which are different things
 *     and only one of them is history.
 *
 * Kept as its own component because three pages need it and because the
 * formatting of a caveat is not something to re-decide per page.
 */
export function LineOption({ label, note }) {
  if (!label) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        marginTop: '3px'
      }}
    >
      <span
        style={{
          fontSize: '12px',
          color: 'var(--color-silver-glow)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--color-border-steel)',
          borderRadius: '4px',
          padding: '1px 7px'
        }}
      >
        {label}
      </span>

      {note && (
        <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600 }}>
          {note}
        </span>
      )}
    </span>
  );
}

export default LineOption;
