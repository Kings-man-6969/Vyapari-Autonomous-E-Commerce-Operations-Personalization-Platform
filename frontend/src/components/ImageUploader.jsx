/**
 * The image upload control, and the first caller of `/api/uploads/*` in the
 * entire history of this codebase.
 *
 * That last point matters. The presign route existed for a long time and had
 * zero call sites, because the seller product form asked for a URL typed into a
 * text box -- a seller was told to host the photograph somewhere else and paste
 * a link. The route was never broken so much as unused, which is why its
 * missing security model went unnoticed. This component is what makes the
 * backend reachable by a human being.
 *
 * The flow is the one the API defines:
 *
 *   POST /api/uploads/presign    -> { upload_url, method, object_key, headers }
 *   send the bytes               -> POST multipart (local) | PUT raw (s3)
 *   POST /api/uploads/complete   -> { public_url, width, height, variant_widths }
 *
 * Only the direct-to-S3 path needs `complete`, because the browser uploaded the
 * bytes and never told the API what it sent. The local path's upload response
 * already carries the stored object, so it is not asked for twice.
 *
 * On the local path the request goes through the shared axios client rather than
 * the absolute `upload_url` on the ticket. That is not a stylistic choice: in
 * development the SPA and the API are on different origins, the ticket's URL is
 * built from the API's own base, and posting to it directly would need a
 * cross-origin multipart request with credentials. The shared client already
 * handles origin, the bearer token and refresh-on-401. For S3 the URL *is*
 * absolute, is signed, and must be fetched raw with no auth header.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, X, GripVertical, AlertCircle, Loader2, Star } from 'lucide-react';
import api from '../services/api';
import { measuredSize, responsiveImageProps } from '../lib/imageUrl';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/**
 * Human-readable reason a file was refused before it left the browser.
 *
 * Exported so the rule can be tested without a browser, and because it is a
 * rule worth stating in one place: the server enforces the same ceiling with
 * `UPLOAD_MAX_BYTES`, and a client that disagrees about it produces a spinner
 * and then a confusing 413.
 */
export function rejectReason(file) {
  if (!ACCEPTED.includes(file.type)) {
    return `“${file.name}” is ${file.type || 'an unknown type'}. Use JPEG, PNG, WebP, GIF or AVIF.`;
  }
  if (file.size > MAX_BYTES) {
    return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  }
  if (file.size === 0) {
    return `“${file.name}” is empty.`;
  }
  return null;
}

let ticketCounter = 0;

/**
 * Upload one file and return the stored object.
 *
 * Exported for the seller page media editor, which has the same problem of
 * needing real bytes on a real object.
 *
 * @param {File} file
 * @param {(fraction: number) => void} [onProgress]
 * @returns {Promise<{object_key: string, public_url: string, width: number, height: number, variant_widths: number[]}>}
 */
export async function uploadImageFile(file, onProgress) {
  const presign = await api.post('/uploads/presign', {
    mime_type: file.type,
    file_size: file.size
  });
  const ticket = presign.data.data;

  let stored = null;

  if (ticket.method === 'POST') {
    // Local provider: the API receives the bytes and re-encodes them.
    const form = new FormData();
    Object.entries(ticket.fields || {}).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);

    // The task-local id keeps concurrent uploads from overwriting each other's
    // progress: four files at once all report 0..1 on the same shared state.
    const marker = `upload-${(ticketCounter += 1)}`;
    const response = await api.post('/uploads/object', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        const fraction = event.total ? event.loaded / event.total : 0;
        onProgress(fraction);
        window.dispatchEvent(
          new CustomEvent('vyapari:upload-progress', { detail: { marker, fraction } })
        );
      }
    });
    stored = response.data.data;
  } else {
    // Direct-to-storage: no auth header, the signature is the credential, and
    // adding one would invalidate it.
    const response = await fetch(ticket.upload_url, {
      method: ticket.method,
      headers: ticket.headers || { 'Content-Type': file.type },
      body: file
    });
    if (!response.ok) {
      let message = `Storage rejected the upload (${response.status}).`;
      try {
        const body = await response.json();
        if (body?.error?.message) message = body.error.message;
      } catch {
        // A non-JSON body from object storage; the status is what we have.
      }
      throw new Error(message);
    }
    onProgress?.(1);
    const complete = await api.post('/uploads/complete', { object_key: ticket.object_key });
    stored = complete.data.data;
  }

  if (!stored?.public_url) {
    throw new Error('The upload finished but no URL came back. Check the storage configuration.');
  }
  return stored;
}

/** Delete a stored object. Best effort -- a failure must not block a save. */
export async function deleteImageFile(objectKey) {
  try {
    await api.delete('/uploads/object', { params: { object_key: objectKey } });
  } catch {
    // Orphaned media is cheap; blocking a seller from saving a product because
    // a cleanup call failed is not.
  }
}

/**
 * Multi-image uploader.
 *
 * @param {object} props
 * @param {string[]} props.value        the current image URLs
 * @param {(urls: string[]) => void} props.onChange
 * @param {number} [props.max]          maximum images
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.aspect]       CSS aspect-ratio for the preview tiles
 */
export const ImageUploader = ({
  value = [],
  onChange,
  max = 6,
  label = 'Product images',
  hint = 'JPEG, PNG, WebP, GIF or AVIF. Up to 5 MB each. The first image is the one shown in the catalogue.',
  aspect = '1 / 1'
}) => {
  const urls = Array.isArray(value) ? value : [];
  const [busy, setBusy] = useState(0);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  // Object keys of the files this component uploaded, so a removal can delete
  // the bytes and not just drop the URL from the form.
  const uploadedKeys = useRef(new Map());

  useEffect(() => {
    const onProgressEvent = (event) => {
      const { marker, fraction } = event.detail || {};
      if (!marker) return;
      setProgress((prev) => ({ ...prev, [marker]: fraction }));
    };
    window.addEventListener('vyapari:upload-progress', onProgressEvent);
    return () => window.removeEventListener('vyapari:upload-progress', onProgressEvent);
  }, []);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      setError('');

      const room = Math.max(0, max - urls.length);
      if (room === 0) {
        setError(`You can attach ${max} images. Remove one first.`);
        return;
      }
      const accepted = files.slice(0, room);
      if (files.length > room) {
        setError(`Only the first ${room} ${room === 1 ? 'file was' : 'files were'} added; the limit is ${max}.`);
      }

      for (const file of accepted) {
        const reason = rejectReason(file);
        if (reason) {
          setError(reason);
          continue;
        }
        const marker = `upload-${(ticketCounter += 1)}`;
        setBusy((n) => n + 1);
        setProgress((prev) => ({ ...prev, [marker]: 0 }));
        try {
          const stored = await uploadImageFile(file, (fraction) => {
            setProgress((prev) => ({ ...prev, [marker]: fraction }));
          });
          uploadedKeys.current.set(stored.public_url, stored.object_key);
          onChange([...urlsRef.current, stored.public_url]);
        } catch (err) {
          // The server's own message where there is one: "Uploads are limited to
          // 5,242,880 bytes" is actionable, "Upload failed" is not.
          const message =
            err?.response?.data?.error?.message ||
            err?.response?.data?.error?.code ||
            err?.message ||
            'That image could not be uploaded.';
          setError(message);
        } finally {
          setBusy((n) => Math.max(0, n - 1));
          setProgress((prev) => {
            const next = { ...prev };
            delete next[marker];
            return next;
          });
        }
      }
      if (inputRef.current) inputRef.current.value = '';
    },
    [max, onChange, urls.length]
  );

  // handleFiles closes over `urls`, which changes on every keystroke of a
  // sibling field. A ref keeps the async loop reading the current list without
  // re-creating the callback and cancelling an in-flight upload.
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  const removeAt = (index) => {
    const removed = urls[index];
    const key = uploadedKeys.current.get(removed);
    if (key) {
      uploadedKeys.current.delete(removed);
      deleteImageFile(key);
    }
    onChange(urls.filter((_, i) => i !== index));
  };

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= urls.length) return;
    const next = [...urls];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ghost-white)' }}>
          {label}
        </label>
        <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
          {urls.length} / {max}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer?.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        style={{
          border: `2px dashed ${dragging ? 'var(--color-icy-steel)' : 'var(--color-border-steel)'}`,
          borderRadius: 'var(--radius-md)',
          backgroundColor: dragging ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
          padding: '22px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease, background-color 0.15s ease'
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        {busy > 0 ? (
          <>
            <Loader2 size={20} className="vyapari-spin" style={{ marginBottom: '8px', color: 'var(--color-icy-steel)' }} />
            <div style={{ fontSize: '13px', color: 'var(--color-silver-glow)' }}>
              Uploading {busy} {busy === 1 ? 'image' : 'images'}…
            </div>
            {Object.values(progress).length > 0 && (
              <div style={{ marginTop: '10px', maxWidth: '220px', margin: '10px auto 0' }}>
                <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-obsidian-graphite)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round(Math.max(...Object.values(progress)) * 100)}%`,
                      backgroundColor: 'var(--color-icy-steel)',
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <ImageIcon size={20} style={{ marginBottom: '8px', color: 'var(--color-ash-label)' }} />
            <div style={{ fontSize: '13px', color: 'var(--color-silver-glow)' }}>
              Drop images here, or click to choose
            </div>
          </>
        )}
      </div>

      {hint && (
        <p style={{ fontSize: '11px', color: 'var(--color-ash-label)', margin: '8px 0 0', lineHeight: 1.5 }}>
          {hint}
        </p>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '10px',
            padding: '9px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: '12px'
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {urls.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '10px', marginTop: '14px' }}>
          {urls.map((url, index) => {
            const known = measuredSize(url);
            return (
              <div
                key={url}
                style={{
                  position: 'relative',
                  aspectRatio: aspect,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  border: index === 0 ? '2px solid var(--color-icy-steel)' : '1px solid var(--color-border-steel)',
                  backgroundColor: 'var(--color-obsidian-graphite)'
                }}
              >
                <img
                  {...responsiveImageProps(url, {
                    alt: `Image ${index + 1}`,
                    sizes: '96px',
                    eager: index === 0
                  })}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {index === 0 && (
                  <span
                    title="Shown in the catalogue"
                    style={{
                      position: 'absolute', top: '4px', left: '4px',
                      display: 'flex', alignItems: 'center', gap: '3px',
                      padding: '2px 6px', borderRadius: '4px',
                      backgroundColor: 'rgba(9, 10, 13, 0.85)',
                      color: 'var(--color-icy-steel)', fontSize: '9px',
                      fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase'
                    }}
                  >
                    <Star size={8} fill="currentColor" stroke="none" /> Main
                  </span>
                )}
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', background: 'rgba(9,10,13,0.8)' }}>
                  <div style={{ display: 'flex' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); move(index, -1); }}
                      disabled={index === 0}
                      aria-label="Move earlier"
                      style={{
                        border: 'none', background: 'none', color: index === 0 ? 'var(--color-iron-veil)' : '#fff',
                        padding: '4px 6px', cursor: index === 0 ? 'not-allowed' : 'pointer', display: 'flex'
                      }}
                    >
                      <GripVertical size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); move(index, 1); }}
                      disabled={index === urls.length - 1}
                      aria-label="Move later"
                      style={{
                        border: 'none', background: 'none', color: index === urls.length - 1 ? 'var(--color-iron-veil)' : '#fff',
                        padding: '4px 6px', cursor: index === urls.length - 1 ? 'not-allowed' : 'pointer', display: 'flex'
                      }}
                    >
                      <GripVertical size={12} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAt(index); }}
                    aria-label={`Remove image ${index + 1}`}
                    style={{ border: 'none', background: 'none', color: '#fca5a5', padding: '4px 6px', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </div>
                {known && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '4px',
                    padding: '1px 4px', borderRadius: '3px',
                    backgroundColor: 'rgba(9,10,13,0.75)',
                    color: 'var(--color-ash-label)', fontSize: '8px'
                  }}>
                    {known.width}×{known.height}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
