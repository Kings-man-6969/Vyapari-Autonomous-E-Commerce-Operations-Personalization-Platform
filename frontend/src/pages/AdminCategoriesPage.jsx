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

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionMsg({ type: '', text: '' });
    try {
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
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create category.'
      });
    }
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
          onClick={() => setModalOpen(true)} 
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
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '0.875rem'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMsg.text}</span>
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>Add Taxonomy Category</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-tide-pool)', fontSize: '20px', cursor: 'pointer' }}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreate}>
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
                  Create Category
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
