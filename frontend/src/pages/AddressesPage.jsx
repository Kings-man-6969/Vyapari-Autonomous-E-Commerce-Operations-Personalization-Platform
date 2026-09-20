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
        setStatusMsg({ type: 'success', text: 'New address added successfully.' });
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
    if (!window.confirm('Are you sure you want to delete this delivery address?')) return;
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
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link to="/account" style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}>
              <ArrowLeft size={16} />
              <span>Back to Account</span>
            </Link>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Saved Addresses
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Manage delivery locations for quick, one-click checkout
          </p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <Plus size={16} />
          <span>Add New Address</span>
        </button>
      </div>

      {statusMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: statusMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: statusMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '180px' }} className="skeleton" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 24px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border-subtle)'
        }}>
          <MapPin size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>No saved addresses yet</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '20px' }}>
            Add your residential or office address for seamless fulfillment.
          </p>
          <button onClick={openAddModal} className="btn-primary">
            <Plus size={16} />
            <span>Add Address</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              style={{
                background: '#ffffff',
                border: addr.is_default ? '2px solid var(--color-primary)' : '1px solid var(--color-border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-xs)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>{addr.name}</span>
                  {addr.is_default && (
                    <span className="badge badge-primary">Default Address</span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {addr.address_line1}
                  {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {addr.city}, {addr.state} - {addr.postal_code}
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Phone: {addr.phone}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--color-border-subtle)'
              }}>
                <div>
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}
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
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-subtle)'
                    }}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    title="Delete address"
                    style={{
                      padding: '6px',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--color-error)',
                      border: '1px solid var(--color-border-subtle)'
                    }}
                  >
                    <Trash2 size={14} />
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
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {editingId ? 'Edit Delivery Address' : 'Add Delivery Address'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ color: 'var(--color-text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Recipient Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
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
                  <label className="form-label">Street Address / Flat / Building</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Landmark / Locality (Optional)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN Code</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                    Set as default delivery address
                  </span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
