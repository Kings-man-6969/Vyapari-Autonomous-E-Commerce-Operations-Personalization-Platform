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
  RefreshCw,
  SlidersHorizontal
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
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Product Catalog
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Manage merchant listings, monitor pgvector indexing, and calibrate stock runway
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link 
            to="/seller/ai/listing" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-gunmetal-dark)',
              border: '1px solid var(--color-border-steel)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none'
            }}
          >
            <Sparkles size={15} color="var(--color-icy-steel)" />
            <span>AI Listing Studio</span>
          </Link>
          <Link 
            to="/seller/products/new" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              color: '#02090a',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <Plus size={15} />
            <span>Add Product</span>
          </Link>
        </div>
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

      {/* Filter Bar */}
      <div style={{
        background: 'var(--color-forest-floor)',
        border: '1px solid var(--color-iron-veil)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'active', 'draft', 'out_of_stock', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: statusFilter === status ? '#ffffff' : 'var(--color-deep-canopy)',
                color: statusFilter === status ? '#02090a' : 'var(--color-tide-pool)',
                border: '1px solid',
                borderColor: statusFilter === status ? '#ffffff' : 'var(--color-iron-veil)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
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
          background: 'var(--color-abyssal-ink)',
          border: '1px solid var(--color-iron-veil)',
          padding: '6px 14px',
          borderRadius: '9999px',
          width: '280px'
        }}>
          <Search size={14} color="var(--color-ash-label)" />
          <input
            type="text"
            placeholder="Filter catalog by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '12px',
              color: '#ffffff',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Catalog Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <Boxes size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '6px' }}>
            No listings found
          </h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginBottom: '20px' }}>
            {statusFilter !== 'all' || searchQuery
              ? 'Try adjusting your status filter or keyword parameters.'
              : 'Add your first product to generate embeddings and activate merchant sales.'}
          </p>
          <Link 
            to="/seller/products/new" 
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
              textDecoration: 'none'
            }}
          >
            <Plus size={16} />
            <span>Create New Listing</span>
          </Link>
        </div>
      ) : (
        <div className="table-card table-responsive" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Category</th>
                <th>Price</th>
                <th>Inventory</th>
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
                          style={{ width: '46px', height: '46px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-iron-veil)' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
                          }}
                        />
                        <div>
                          <Link to={`/products/${p.id}`} target="_blank" style={{ fontWeight: 500, fontSize: '0.875rem', color: '#ffffff', textDecoration: 'none' }}>
                            {p.title}
                          </Link>
                          <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '2px' }}>
                            SKU: {p.sku || p.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-tide-pool)' }}>
                        {p.category_name || 'General'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff' }}>
                        ₹{parseFloat(p.price).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        color: p.inventory_count <= 5 ? '#fca5a5' : 'var(--color-tide-pool)'
                      }}>
                        {p.inventory_count} units
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${p.status}`}>
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
                            borderRadius: '6px',
                            border: '1px solid var(--color-iron-veil)',
                            color: 'var(--color-tide-pool)',
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--color-deep-canopy)'
                          }}
                        >
                          <Edit3 size={13} />
                        </Link>
                        <button
                          onClick={() => handleArchiveToggle(p.id, p.status)}
                          title={p.status === 'archived' ? 'Reactivate listing' : 'Archive listing'}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border-steel)',
                            color: p.status === 'archived' ? 'var(--color-icy-steel)' : '#fbbf24',
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--color-slate-chrome)',
                            cursor: 'pointer'
                          }}
                        >
                          <Archive size={13} />
                        </button>
                        <Link
                          to={`/products/${p.id}`}
                          target="_blank"
                          title="View Live PDP"
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-iron-veil)',
                            color: 'var(--color-tide-pool)',
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--color-deep-canopy)'
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

export default SellerProductsPage;
