/**
 * The "axis: value" text a seller types to describe an option.
 *
 *   size: XL
 *   colour: Indigo
 *
 * to `{ size: 'XL', colour: 'Indigo' }`.
 *
 * Free text rather than a fixed set of pickers, because the axes are whatever
 * the product needs: a sari sells on colour and length, a phone case on
 * capacity and finish, a painting on size and frame. A form with "Size" and
 * "Colour" fields hard-codes a guess and makes every other product awkward.
 *
 * The normalisation is not cosmetic. Two rows that differ only in spacing or
 * capitalisation -- "Size: XL" and "size:xl" -- are the same option, and the
 * server rejects the second as a duplicate. Normalising here, where the form can
 * point at the row that clashes, beats letting a 400 arrive with a database
 * constraint name in it.
 */

/**
 * @param {string} text
 * @returns {{attributes: Record<string,string>, bad: string[]}}
 *   `attributes` is the cleaned object. `bad` lists the lines that were not
 *   "axis: value" at all, so a caller can say which line needs fixing rather
 *   than "invalid options" -- a textarea accepts free text and people type
 *   "Indigo" and wonder why nothing happened.
 */
export function parseOptionLines(text) {
  const attributes = {};
  const bad = [];

  String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(':');
      const key = idx > 0 ? line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_') : '';
      const value = idx > 0 ? line.slice(idx + 1).trim() : '';

      if (!key || !value) {
        bad.push(line);
        return;
      }
      attributes[key] = value;
    });

  return { attributes, bad };
}

/**
 * The same object without the complaint, for call sites that have already
 * validated -- a submit handler, or a preview.
 */
export function optionAttributes(text) {
  return parseOptionLines(text).attributes;
}

/**
 * "Indigo / XL" from {colour: 'Indigo', size: 'XL'}.
 *
 * Mirrors the backend's describe_attributes, values only and no axis names. The
 * two have to agree: the seller sees this label in the editor's row and the
 * customer sees the backend's in the bag, and a size run labelled two different
 * ways depending on which screen you are on looks like a different product.
 *
 * Order follows the object's own key order, which is insertion order here and
 * jsonb's canonical order in the database. Close enough for a label, and not
 * worth a schema change to make identical -- the *set* of values is what a
 * person is reading.
 */
export function optionLabel(attributes) {
  const values = Object.values(attributes || {}).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  return values.length ? values.join(' / ') : '';
}

/**
 * A canonical identity for an attribute set, for spotting a repeat.
 *
 * Values are case-folded *here only*. The stored value keeps whatever the seller
 * typed, because "XL" and "xl" are the same size but only one of them looks right
 * on a size pill, and a store whose sizes all render lowercase looks broken.
 *
 * That leaves a gap the database will not close: jsonb equality is
 * case-sensitive, so {size: "XL"} and {size: "xl"} are two distinct rows that
 * satisfy the unique index, and the customer gets two pills reading XL and xl.
 * Comparing case-folded before posting is what turns that into "XL is already in
 * this run" instead of two near-identical options in a live listing.
 */
export function optionKey(attributes) {
  const clean = attributes || {};
  return Object.keys(clean)
    .sort()
    .map((k) => `${k.toLowerCase()}=${String(clean[k] ?? '').trim().toLowerCase()}`)
    .join('|');
}

/**
 * The existing option this one duplicates, or null.
 *
 * @param {Array<{attributes: object}>} existing
 * @param {object} attributes
 * @param {string} [ignoreId] an option being edited is not a clash with itself
 */
export function findOptionClash(existing, attributes, ignoreId) {
  const wanted = optionKey(attributes);
  if (!wanted) return null;
  return (
    (existing || []).find(
      (v) => v.id !== ignoreId && optionKey(v.attributes) === wanted
    ) || null
  );
}
