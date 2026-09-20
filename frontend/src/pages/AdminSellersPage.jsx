import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, 
  Store, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ShieldCheck, 
  CreditCard, 
  Building2,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';

export const AdminSellersPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });
  const [selectedSeller, setSelectedSeller] = useState(null);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/sellers');
      if (res.data?.success) {
        setSellers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load seller KYC list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleVerify = async (sellerId) => {
    try {
      const res = await api.put(`/admin/sellers/${sellerId}/verify`);
      if (res.data?.success) {
        setActionMsg({ type: 'success', text: 'Merchant KYC verified. Seller can now publish active listings.' });
        setSelectedSeller(null);
        fetchSellers();
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to verify seller.' });
    }
  };

  const handleReject = async (sellerId) => {
    const reason = window.prompt('Please enter the reason for rejection (e.g. Invalid PAN / blurred documents):');
    if (!reason) return;
    try {
      const res = await api.put(`/admin/sellers/${sellerId}/reject`, { reason });
      if (res.data?.success) {
        setActionMsg({ type: 'success', text: 'Merchant onboarding application rejected.' });
        setSelectedSeller(null);
        fetchSellers();
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to reject seller application.' });
    }
  };

  const filteredSellers = sellers.filter((s) => {
    if (filter === 'pending') return s.onboarding_status === 'submitted' || s.onboarding_status === 'pending';
    if (filter === 'verified') return s.onboarding_status === 'verified';
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Merchant KYC & Verification Desk
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Review regulatory tax registrations, business certificates, and bank settlement coordinates
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

      {/* Filter Tabs */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        gap: '8px'
      }}>
        {['all', 'pending', 'verified'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              textTransform: 'capitalize',
              backgroundColor: filter === f ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
              color: filter === f ? '#ffffff' : 'var(--color-text-secondary)',
              transition: 'all var(--transition-fast)'
            }}
          >
            {f === 'pending' ? 'Pending Review' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '60px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredSellers.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <FileCheck2 size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No seller applicants</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            All merchant KYC applications have been reviewed.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Store & Owner</th>
                <th>Tax Registration</th>
                <th>Bank Coordinates</th>
                <th>Catalog Items</th>
                <th>KYC Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSellers.map((s) => {
                const isPending = s.onboarding_status === 'submitted' || s.onboarding_status === 'pending';
                const isVerified = s.onboarding_status === 'verified';
                return (
                  <tr key={s.id}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{s.store_name}</span>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Owner: {s.owner_name} &bull; {s.owner_email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', fontWeight: 600 }}>
                          PAN: {s.pan || 'NOT_PROVIDED'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                          GST: {s.gstin || 'EXEMPT'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)' }}>
                          {s.account_holder_name || s.owner_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                          IFSC: {s.bank_ifsc || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                        {s.product_count || 0} products
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${isVerified ? 'status-pill-verified' : isPending ? 'status-pill-pending' : 'status-pill-rejected'}`}>
                        {s.onboarding_status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleVerify(s.id)}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--color-success)' }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Verify</span>
                            </button>
                            <button
                              onClick={() => handleReject(s.id)}
                              className="btn-outline"
                              style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}
                            >
                              <XCircle size={13} />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {isVerified && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={14} />
                            Active Merchant
                          </span>
                        )}
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

export default AdminSellersPage;
