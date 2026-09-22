import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  X
} from 'lucide-react';
import api from '../services/api';

export const AddressesPage = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Address form fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    is_default: false
  });

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/addresses');
      if (res.data?.success) {
        setAddresses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load addresses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      is_default: addresses.length === 0
    });
    setModalOpen(true);
  };

  const openEditModal = (addr) => {
    setEditingId(addr.id);
    setFormData({
      name: addr.name || '',
      phone: addr.phone || '',
      address_line1: addr.address_line1 || '',
      address_line2: addr.address_line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      postal_code: addr.postal_code || '',
      country: addr.country || 'India',
      is_default: addr.is_default || false
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    try {
      if (editingId) {
        await api.put(`/users/addresses/${editingId}`, formData);
        setStatusMsg({ type: 'success', text: 'Address updated successfully.' });
      } else {
        await api.post('/users/addresses', formData);
        setStatusMsg({ type: 'success', text: 'New address saved to address book.' });
      }
      setModalOpen(false);
      fetchAddresses();
    } catch (err) {
      setStatusMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to save address.' 
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this saved delivery address?')) return;
    try {
      await api.delete(`/users/addresses/${id}`);
      fetchAddresses();
    } catch (err) {
      console.error('Failed to delete address:', err);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.put(`/users/addresses/${id}/default`);
      fetchAddresses();
    } catch (err) {
      console.error('Failed to set default address:', err);
    }
  };

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link to="/account" style={{ color: 'var(--color-tide-pool)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', textDecoration: 'none' }}>
              <ArrowLeft size={15} />
              <span>Back to Account</span>
            </Link>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Saved Addresses
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Manage delivery destinations for swift checkout and carrier dispatch routing
          </p>
        </div>
        <button 
          onClick={openAddModal} 
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
          <span>Add Address</span>
        </button>
      </div>

      {statusMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: statusMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${statusMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
          color: statusMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '0.875rem'
        }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '180px', backgroundColor: 'var(--color-forest-floor)', borderRadius: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 20px',
          backgroundColor: 'var(--color-forest-floor)',
          borderRadius: '16px',
          border: '1px dashed var(--color-iron-veil)'
        }}>
          <MapPin size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>No saved addresses</h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Add your primary residence or work address for one-click fulfillment.
          </p>
          <button 
            onClick={openAddModal} 
            style={{
              padding: '10px 24px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              color: '#02090a',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Add Address
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              style={{
                background: 'var(--color-gunmetal-dark)',
                border: addr.is_default ? '1px solid var(--color-icy-steel)' : '1px solid var(--color-border-steel)',
                borderRadius: '12px',
                padding: '22px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#ffffff' }}>{addr.name}</span>
                  {addr.is_default && (
                    <span className="badge-agent" style={{ fontSize: '11px' }}>Default Address</span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', marginBottom: '4px', lineHeight: 1.5 }}>
                  {addr.address_line1}
                  {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', marginBottom: '6px' }}>
                  {addr.city}, {addr.state} - {addr.postal_code}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-slate-caption)' }}>
                  Contact: {addr.phone}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--color-border-steel)'
              }}>
                <div>
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      style={{ fontSize: '11px', color: 'var(--color-icy-steel)', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Make Default
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => openEditModal(addr)}
                    title="Edit address"
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      color: 'var(--color-tide-pool)',
                      border: '1px solid var(--color-iron-veil)',
                      backgroundColor: 'var(--color-deep-canopy)',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    title="Delete address"
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      color: '#f87171',
                      border: '1px solid var(--color-iron-veil)',
                      backgroundColor: 'var(--color-deep-canopy)',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)', maxWidth: '540px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
                {editingId ? 'Edit Address' : 'Add Delivery Address'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-tide-pool)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Recipient Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Contact Phone</label>
                    <input
                      type="tel"
                      className="input-field"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Street Address / Premises</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Landmark / Locality (Optional)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>City</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>State</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>PIN Code</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-icy-steel)' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--color-tide-pool)' }}>
                    Set as default delivery address
                  </span>
                </label>
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
                  {editingId ? 'Save Changes' : 'Add Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressesPage;
