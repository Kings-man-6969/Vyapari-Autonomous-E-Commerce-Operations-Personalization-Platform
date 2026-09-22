import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Store, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const SellerOnboardingPage = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    store_name: '',
    store_description: '',
    business_address: '',
    pan: '',
    gstin: '',
    bank_account_number: '',
    bank_ifsc: '',
    account_holder_name: '',
    primary_category_id: ''
  });

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const [statusRes, catRes] = await Promise.all([
          api.get('/seller/onboarding/status'),
          api.get('/categories')
        ]);
        if (statusRes.data?.success) {
          setOnboardingStatus(statusRes.data.data);
          if (statusRes.data.data.onboarding_status === 'verified') {
            navigate('/seller/dashboard');
          }
        }
        if (catRes.data?.success) {
          const list = catRes.data?.data?.categories || catRes.data?.categories || (Array.isArray(catRes.data?.data) ? catRes.data.data : []);
          setCategories(list);
          if (list.length > 0) {
            setFormData((prev) => ({ ...prev, primary_category_id: list[0].id }));
          }
        }
      } catch (err) {
        console.log('No existing onboarding profile found or fresh onboarding.');
      }
    };
    fetchExisting();
  }, [navigate]);

  const handleNext = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!formData.store_name.trim() || !formData.business_address.trim()) {
        setErrorMsg('Please enter your store name and operational street address.');
        return;
      }
    } else if (step === 2) {
      if (!formData.pan.trim()) {
        setErrorMsg('Permanent Account Number (PAN) is required by Indian regulations.');
        return;
      }
    } else if (step === 3) {
      if (!formData.bank_account_number.trim() || !formData.bank_ifsc.trim() || !formData.account_holder_name.trim()) {
        setErrorMsg('All settlement bank credentials are required.');
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setLoading(true);
      const res = await api.post('/seller/onboarding', formData);
      if (res.data?.success) {
        setOnboardingStatus({
          onboarding_status: 'submitted',
          store_name: formData.store_name
        });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit onboarding application.');
    } finally {
      setLoading(false);
    }
  };

  // If already submitted and waiting verification
  if (onboardingStatus && onboardingStatus.onboarding_status === 'submitted') {
    return (
      <div style={{ padding: '60px 24px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{
          background: 'var(--color-forest-floor)',
          borderRadius: '16px',
          border: '1px solid var(--color-iron-veil)',
          padding: '40px',
          textAlign: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#facc15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Clock size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>
            KYC Verification Pending
          </h2>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Your merchant onboarding credentials for <strong>{onboardingStatus.store_name || formData.store_name}</strong> have been submitted to the Admin Governance Desk for regulatory check.
          </p>
          <div style={{
            background: 'var(--color-deep-canopy)',
            border: '1px solid var(--color-iron-veil)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--color-tide-pool)',
            marginBottom: '28px'
          }}>
            PAN: {onboardingStatus.pan_masked || 'XXXXXXXXXX'} &bull; Status: <span className="status-pill status-draft" style={{ marginLeft: '6px' }}>Pending Admin Approval</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link 
              to="/seller/dashboard" 
              style={{
                padding: '10px 22px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#02090a',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Enter Workspace (Draft Mode)</span>
              <ArrowRight size={14} />
            </Link>
            <Link 
              to="/" 
              style={{
                padding: '10px 20px',
                borderRadius: '9999px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-iron-veil)',
                color: 'var(--color-tide-pool)',
                fontSize: '13px',
                textDecoration: 'none'
              }}
            >
              Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>
          Seller Onboarding & KYC
        </h1>
        <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem' }}>
          Step {step} of 4: {
            step === 1 ? 'Store Details' :
            step === 2 ? 'Tax & PAN KYC' :
            step === 3 ? 'Bank Settlement Account' : 'Category & Merchant Declaration'
          }
        </p>
      </div>

      {/* Progress Track */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', left: '10%', right: '10%', height: '1px', backgroundColor: 'var(--color-iron-veil)', zIndex: 1 }} />
        {[1, 2, 3, 4].map((s) => (
          <div key={s} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: s <= step ? '#ffffff' : 'var(--color-forest-floor)',
              border: s <= step ? 'none' : '1px solid var(--color-iron-veil)',
              color: s <= step ? '#02090a' : 'var(--color-ash-label)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '12px'
            }}>
              {s < step ? <CheckCircle2 size={16} /> : s}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 500, color: s === step ? '#ffffff' : 'var(--color-ash-label)' }}>
              {s === 1 ? 'Store' : s === 2 ? 'Tax KYC' : s === 3 ? 'Payout' : 'Declaration'}
            </span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--color-status-cancelled)',
          color: '#fca5a5',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Container */}
      <div className="table-card" style={{ padding: '32px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
        {/* Step 1: Store Information */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} color="var(--color-icy-steel)" />
              <span>Storefront Brand Identity</span>
            </h3>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Store / Brand Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., Studio Artisans India"
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Store Narrative & Provenance</label>
              <textarea
                className="textarea-field"
                rows="3"
                placeholder="Describe your craft, brand philosophy, or catalog offerings..."
                value={formData.store_description}
                onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Registered Operational Street Address</label>
              <input
                type="text"
                className="input-field"
                placeholder="Complete registered facility address"
                value={formData.business_address}
                onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                required
              />
            </div>
          </div>
        )}

        {/* Step 2: Tax KYC */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--color-icy-steel)" />
              <span>Tax & Regulatory Verification</span>
            </h3>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Permanent Account Number (PAN)</label>
              <input
                type="text"
                className="input-field"
                placeholder="ABCDE1234F"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '4px', display: 'block' }}>
                Required under Indian commerce regulations for TDS and merchant identity check.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>GSTIN (Optional for Composition / Excluded Sellers)</label>
              <input
                type="text"
                className="input-field"
                placeholder="22AAAAA0000A1Z5"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        )}

        {/* Step 3: Payout Coordinates */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="var(--color-icy-steel)" />
              <span>Settlement Account Details</span>
            </h3>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Beneficiary Account Holder Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="As per bank statement or cancelled cheque"
                value={formData.account_holder_name}
                onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Bank Account Number</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter bank account number"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Bank IFSC Code</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., HDFC0001234"
                value={formData.bank_ifsc}
                onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                required
              />
            </div>
          </div>
        )}

        {/* Step 4: Category & Submit */}
        {step === 4 && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-icy-steel)" />
              <span>Taxonomy & Regulatory Declaration</span>
            </h3>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Primary Catalog Taxonomy</label>
              <select
                className="select-field"
                value={formData.primary_category_id}
                onChange={(e) => setFormData({ ...formData, primary_category_id: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ background: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: 'var(--color-tide-pool)', lineHeight: 1.6 }}>
              <p><strong>Merchant Regulatory Declaration:</strong> I certify that all supplied taxation credentials and bank coordinates belong to my registered business entity. I agree to adhere to the Vyapari Merchant Code of Conduct and standard fulfillment SLA guidelines.</p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--color-iron-veil)' }}>
          {step > 1 ? (
            <button 
              type="button" 
              onClick={() => setStep((prev) => prev - 1)} 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-iron-veil)',
                color: 'var(--color-tide-pool)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={15} />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button 
              type="button" 
              onClick={handleNext} 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 22px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#02090a',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <span>Continue</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#02090a',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <span>{loading ? 'Submitting Application...' : 'Submit KYC Application'}</span>
              <CheckCircle2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerOnboardingPage;
