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
        setActionMsg({ type: 'success', text: 'Merchant KYC approved. Seller status promoted to active.' });
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
    if (filter === 'pending') return s.onboarding_status === 'submitted' || s.onboarding_status === 'pending' || s.seller_status === 'pending_kyc';
    if (filter === 'verified') return s.onboarding_status === 'verified' || s.seller_status === 'active';
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Merchant KYC & Verification Desk
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Review regulatory tax registrations, business certificates, and bank settlement coordinates
          </p>
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

      {/* Filter Tabs */}
      <div style={{
        background: 'var(--color-forest-floor)',
        border: '1px solid var(--color-iron-veil)',
        borderRadius: '12px',
        padding: '12px 20px',
        marginBottom: '20px',
        display: 'flex',
        gap: '8px'
      }}>
        {['all', 'pending', 'verified'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'capitalize',
              backgroundColor: filter === f ? '#ffffff' : 'var(--color-deep-canopy)',
              color: filter === f ? '#02090a' : 'var(--color-tide-pool)',
              border: '1px solid',
              borderColor: filter === f ? '#ffffff' : 'var(--color-iron-veil)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {f === 'pending' ? 'Pending Review' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '60px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredSellers.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <FileCheck2 size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            No merchant applicants found
          </h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem' }}>
            All merchant KYC applications have been reviewed and adjudicated.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Store & Owner</th>
                <th>Tax Registration</th>
                <th>Settlement Account</th>
                <th>Catalog Items</th>
                <th>KYC Status</th>
                <th>Adjudication</th>
              </tr>
            </thead>
            <tbody>
              {filteredSellers.map((s) => {
                const isPending = s.onboarding_status === 'submitted' || s.onboarding_status === 'pending' || s.seller_status === 'pending_kyc';
                const isVerified = s.onboarding_status === 'verified' || s.seller_status === 'active';
                return (
                  <tr key={s.id}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff' }}>{s.store_name}</span>
                        <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '2px' }}>
                          Owner: {s.owner_name} &bull; {s.owner_email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, color: '#ffffff' }}>
                          PAN: {s.pan || 'NOT_PROVIDED'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', fontFamily: 'monospace' }}>
                          GST: {s.gstin || 'EXEMPT'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                          {s.account_holder_name || s.owner_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', fontFamily: 'monospace' }}>
                          IFSC: {s.bank_ifsc || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                        {s.product_count || 0} products
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${isVerified ? 'status-active' : isPending ? 'status-draft' : 'status-cancelled'}`}>
                        {isVerified ? 'verified (active)' : isPending ? 'pending_kyc' : 'rejected'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleVerify(s.id)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: '9999px',
                                backgroundColor: '#ffffff',
                                color: '#02090a',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReject(s.id)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '9999px',
                                backgroundColor: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              <XCircle size={13} />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {isVerified && (
                          <span style={{ fontSize: '12px', color: 'var(--color-icy-steel)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={14} />
                            Verified Merchant
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
