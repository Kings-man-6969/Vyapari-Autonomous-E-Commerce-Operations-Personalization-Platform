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
        setCategories(res.data.data);
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Category Taxonomy & Tree
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Structure marketplace catalog taxonomy, navigational hierarchy, and search facet classifications
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} />
          <span>Add Category</span>
        </button>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: actionMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Categories Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <FolderTree size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No categories configured</h3>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>URL Slug</th>
                <th>Description</th>
                <th>Hierarchy Level</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderTree size={16} color="var(--color-primary)" />
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      /{c.slug}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {c.description || 'Standard marketplace catalog branch'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-primary">
                      {c.parent_id ? 'Subcategory' : 'Root Category'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Category Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Create New Category</h3>
              <button onClick={() => setModalOpen(false)} style={{ color: 'var(--color-text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Home Decor & Lighting"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">URL Slug</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="textarea-field"
                    rows="3"
                    placeholder="Describe products grouped within this taxonomy..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Category (Optional)</label>
                  <select
                    className="select-field"
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  >
                    <option value="">None (Top-Level Root Category)</option>
                    {categories.filter((c) => !c.parent_id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
