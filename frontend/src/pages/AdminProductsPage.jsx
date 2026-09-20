import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Boxes, 
  Search, 
  ShieldAlert, 
  Archive, 
  Eye, 
  CheckCircle2, 
  AlertCircle,
  Cpu
} from 'lucide-react';
import api from '../services/api';

export const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/products');
      if (res.data?.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load admin products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleModerate = async (productId, currentStatus) => {
    const nextStatus = currentStatus === 'archived' ? 'active' : 'archived';
    const reason = window.prompt(`Confirm changing listing to ${nextStatus}. Reason:`);
    if (reason === null) return;

    try {
      const res = await api.put(`/admin/products/${productId}/moderate`, {
        status: nextStatus,
        reason
      });
      if (res.data?.success) {
        setActionMsg({
          type: 'success',
          text: `Listing ${nextStatus === 'archived' ? 'force-archived' : 'reinstated'}.`
        });
        fetchProducts();
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to moderate product listing.'
      });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.store_name && p.store_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Catalog Governance & Moderation
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Audit cross-merchant listings for compliance, quality standards, and content authenticity
          </p>
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

      {/* Filter and Search Bar */}
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'active', 'draft', 'out_of_stock', 'archived'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: statusFilter === st ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                color: statusFilter === st ? '#ffffff' : 'var(--color-text-secondary)',
                transition: 'all var(--transition-fast)'
              }}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--color-surface-subtle)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          width: '300px'
        }}>
          <Search size={16} color="var(--color-text-secondary)" />
          <input
            type="text"
            placeholder="Search by title or merchant store..."
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

      {/* Products Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Boxes size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No products found</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Try resetting your status filter or search keywords.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product & Merchant</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Vector State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const images = Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images || '[]') : []);
                const img = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={img}
                          alt={p.title}
                          style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-xs)', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
                          }}
                        />
                        <div>
                          <Link to={`/products/${p.id}`} target="_blank" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                            {p.title}
                          </Link>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Merchant: <strong>{p.store_name || 'Independent Seller'}</strong>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)' }}>{p.category_name}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        ₹{parseFloat(p.price).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                        {p.inventory_count}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-pill-${p.status}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={11} />
                        Indexed
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleModerate(p.id, p.status)}
                          title={p.status === 'archived' ? 'Reinstate listing' : 'Force Archive'}
                          className="btn-outline"
                          style={{
                            padding: '5px 10px',
                            fontSize: '11px',
                            color: p.status === 'archived' ? 'var(--color-success)' : 'var(--color-error)'
                          }}
                        >
                          {p.status === 'archived' ? 'Reinstate' : 'Archive'}
                        </button>
                        <Link
                          to={`/products/${p.id}`}
                          target="_blank"
                          title="View Live Listing"
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Eye size={13} />
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

export default AdminProductsPage;
