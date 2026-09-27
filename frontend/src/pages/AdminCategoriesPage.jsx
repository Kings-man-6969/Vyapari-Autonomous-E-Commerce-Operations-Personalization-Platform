import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import api from '../services/api';

export const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: ''
  });

  // F3. The edit form reuses the create modal, and the delete is its own
  // confirmation -- because the two failures are different in kind and the
  // second one is the one that needs the reason spelled out.
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', slug: '', description: '', parent_id: '' });
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setFormData({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
      parent_id: category.parent_id || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionMsg({ type: '', text: '' });
    try {
      if (editing) {
        // `PUT /admin/categories/{id}` is the only writer for description and
        // icon_url -- the create route accepted both and stored neither, because
        // the column did not exist until V10.
        const res = await api.put(`/admin/categories/${editing.id}`, {
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          parent_id: formData.parent_id || null
        });
        if (res.data?.success) {
          setActionMsg({ type: 'success', text: `Category "${formData.name}" updated.` });
          setModalOpen(false);
          setEditing(null);
          fetchCategories();
        }
      } else {
        const res = await api.post('/admin/categories', {
          ...formData,
          parent_id: formData.parent_id || null
        });
        if (res.data?.success) {
          setActionMsg({ type: 'success', text: `Category "${formData.name}" created successfully.` });
          setModalOpen(false);
          setFormData({ name: '', slug: '', description: '', parent_id: '' });
          fetchCategories();
        }
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to save that category.'
      });
    }
  };

  // Deleting a category with children does not fail -- `parent_id` is ON DELETE
  // SET NULL, so the subtree is silently re-rooted to the top level. The route
  // refuses with 409 CATEGORY_HAS_CHILDREN, and the UI has to say what that
  // means, because "re-rooted to the top level" is not a phrase an admin
  // arrives at on their own.
  const handleDelete = async () => {
    if (!deleting) return;
    setActionMsg({ type: '', text: '' });
    try {
      await api.delete(`/admin/categories/${deleting.id}`);
      setActionMsg({ type: 'success', text: `Category "${deleting.name}" deleted.` });
      setDeleting(null);
      fetchCategories();
    } catch (err) {
      const detail = err?.response?.data?.error;
      setActionMsg({
        type: 'error',
        text: detail?.message || 'Could not delete that category.',
        data: detail?.data
      });
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      if (res.data?.success) {
        const list = res.data.data?.flat || res.data.flat || res.data.data?.categories || res.data.categories || (Array.isArray(res.data.data) ? res.data.data : []);
        setCategories(list);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (val) => {
    const slugVal = val.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-');
    setFormData((prev) => ({ ...prev, name: val, slug: slugVal }));
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Category Taxonomy & Facets
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Structure marketplace catalog taxonomy, navigational hierarchy, and search facet classifications
          </p>
        </div>
        <button 
          onClick={openCreate}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 20px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
            color: '#02090a',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={15} />
          <span>Add Category</span>
        </button>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '0.875rem'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <div>
            <div>{actionMsg.text}</div>
            {/* CATEGORY_HAS_CHILDREN and CATEGORY_IN_USE both carry a count in
                `data`, and the count is the part that tells the admin what to do
                next: delete the children first, or archive the products. */}
            {typeof actionMsg.data?.child_count === 'number' && (
              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                This category has {actionMsg.data.child_count} child categor
                {actionMsg.data.child_count === 1 ? 'y' : 'ies'}. Deleting it would
                re-root them at the top level, so delete those first.
              </div>
            )}
            {typeof actionMsg.data?.product_count === 'number' && (
              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                {actionMsg.data.product_count} product(s) are filed under it.
                Archive or reassign those first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation. Separate from the create/edit modal because the
          question is different: one asks for fields, the other asks you to
          confirm you understand what happens to the children. */}
      {deleting && (
        <div
          onClick={() => setDeleting(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label={`Delete ${deleting.name}`}
            style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-chrome)', borderRadius: '16px', maxWidth: '460px', width: '100%', padding: '24px' }}
          >
            <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', margin: 0 }}>
              Delete &ldquo;{deleting.name}&rdquo;?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', lineHeight: 1.6, margin: '12px 0 0' }}>
              {deleting.children?.length
                ? <>It has {deleting.children.length} child categor{deleting.children.length === 1 ? 'y' : 'ies'}, which would be re-rooted at the top level.</>
                : <>It has no children.</>}
              {' '}This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn-outline" onClick={() => setDeleting(null)}>Cancel</button>
              <button
                type="button"
                onClick={handleDelete}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer' }}
              >
                Delete category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <FolderTree size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>No categories registered</h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem' }}>
            Create your initial category nodes to classify catalog listings.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>URL Slug</th>
                <th>Description</th>
                <th>Parent Hierarchy</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FolderTree size={16} color="var(--color-icy-steel)" />
                      <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#ffffff' }}>{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-tide-pool)' }}>
                      /{c.slug}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                      {c.description || 'Taxonomy node for catalog sorting'}
                    </span>
                  </td>
                  <td>
                    <span className="badge-agent" style={{ fontSize: '11px' }}>
                      {c.parent_name || 'Root Level'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      aria-label={`Edit ${c.name}`}
                      style={{ background: 'none', border: 'none', color: 'var(--color-icy-steel)', cursor: 'pointer', padding: '4px 8px' }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(c)}
                      aria-label={`Delete ${c.name}`}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px 8px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)', maxWidth: '480px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
                {editing ? `Edit "${editing.name}"` : 'Add Taxonomy Category'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-tide-pool)', fontSize: '20px', cursor: 'pointer' }}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Category Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Studio Ceramics"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>URL Slug</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Parent Taxonomy Category (Optional)</label>
                  <select
                    className="select-field"
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  >
                    <option value="">None (Top-level Category)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Description</label>
                  <textarea
                    className="textarea-field"
                    rows="3"
                    placeholder="Brief description for search facet index..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--color-iron-veil)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)} 
                  style={{
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-deep-canopy)',
                    border: '1px solid var(--color-iron-veil)',
                    color: 'var(--color-tide-pool)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{
                    padding: '8px 22px',
                    borderRadius: '9999px',
                    backgroundColor: '#ffffff',
                    color: '#02090a',
                    fontWeight: 600,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {editing ? 'Save changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoriesPage;
