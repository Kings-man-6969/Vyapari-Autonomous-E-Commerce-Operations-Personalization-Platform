import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Boxes, 
  Plus, 
  Search, 
  Edit3, 
  Archive, 
  Eye, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

export const SellerProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/seller/products');
      if (res.data?.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load seller catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleArchiveToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
    try {
      await api.put(`/seller/products/${id}`, { status: newStatus });
      setActionMsg({
        type: 'success',
        text: `Product status updated to ${newStatus}.`
      });
      fetchProducts();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update product status.'
      });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim() && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Product Catalog
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Manage listings, track stock levels, and publish new products to the marketplace
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/seller/ai/listing" className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--color-primary)" />
            <span>AI Listing Studio</span>
          </Link>
          <Link to="/seller/products/new" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            <span>Add Product</span>
          </Link>
        </div>
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

      {/* Filter Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'active', 'draft', 'out_of_stock', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: statusFilter === status ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                color: statusFilter === status ? '#ffffff' : 'var(--color-text-secondary)',
                transition: 'all var(--transition-fast)'
              }}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--color-surface-subtle)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          width: '280px'
        }}>
          <Search size={16} color="var(--color-text-secondary)" />
          <input
            type="text"
            placeholder="Filter by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 'var(--font-size-xs)',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Boxes size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>No products found</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '20px' }}>
            {statusFilter !== 'all' || searchQuery
              ? 'Try resetting your status filter or search query.'
              : 'Add your first product to start generating sales on Vyapari.'}
          </p>
          <Link to="/seller/products/new" className="btn-primary">
            <Plus size={16} />
            <span>Create New Listing</span>
          </Link>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const images = Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images || '[]') : []);
                const imgUrl = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img
                          src={imgUrl}
                          alt={p.title}
                          style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xs)', objectFit: 'cover', border: '1px solid var(--color-border-subtle)' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
                          }}
                        />
                        <div>
                          <Link to={`/products/${p.id}`} target="_blank" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                            {p.title}
                          </Link>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            SKU: {p.sku || p.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {p.category_name || 'General'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        ₹{parseFloat(p.price).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        fontSize: 'var(--font-size-sm)',
                        color: p.inventory_count <= 5 ? 'var(--color-error)' : 'var(--color-text-primary)'
                      }}>
                        {p.inventory_count} units
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-pill-${p.status}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Link
                          to={`/seller/products/${p.id}/edit`}
                          title="Edit Product"
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Edit3 size={14} />
                        </Link>
                        <button
                          onClick={() => handleArchiveToggle(p.id, p.status)}
                          title={p.status === 'archived' ? 'Reactivate listing' : 'Archive listing'}
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--color-border-subtle)',
                            color: p.status === 'archived' ? 'var(--color-success)' : 'var(--color-warning)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Archive size={14} />
                        </button>
                        <Link
                          to={`/products/${p.id}`}
                          target="_blank"
                          title="View Live Page"
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Eye size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SellerProductsPage;
