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
  Clock
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
          setCategories(catRes.data.data);
          if (catRes.data.data.length > 0) {
            setFormData((prev) => ({ ...prev, primary_category_id: catRes.data.data[0].id }));
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
        setErrorMsg('Please enter your store name and business address.');
        return;
      }
    } else if (step === 2) {
      if (!formData.pan.trim()) {
        setErrorMsg('Permanent Account Number (PAN) is required by Indian regulations.');
        return;
      }
    } else if (step === 3) {
      if (!formData.bank_account_number.trim() || !formData.bank_ifsc.trim() || !formData.account_holder_name.trim()) {
        setErrorMsg('All bank payout fields are required.');
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
      <div className="container" style={{ padding: '60px 24px', maxWidth: '680px' }}>
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-card)',
          padding: '40px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Clock size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
            KYC Application Under Review
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: '24px' }}>
            Your merchant onboarding application for <strong>{onboardingStatus.store_name || formData.store_name}</strong> is currently being reviewed by our Admin Governance Desk.
            Regulatory verification usually completes within 24 hours.
          </p>
          <div style={{
            background: 'var(--color-surface-subtle)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            marginBottom: '24px'
          }}>
            PAN: {onboardingStatus.pan_masked || 'XXXXXXXXXX'} &bull; Status: <span className="badge badge-warning">Pending Verification</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/" className="btn-outline">
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '50px 24px 80px', maxWidth: '720px' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Seller Onboarding & KYC
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Step {step} of 4: {
            step === 1 ? 'Store Details' :
            step === 2 ? 'Tax & Business Registration' :
            step === 3 ? 'Bank Payout Information' : 'Category & Agreement'
          }
        </p>
      </div>

      {/* Progress Track */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', left: '10%', right: '10%', height: '2px', backgroundColor: 'var(--color-border-subtle)', zIndex: 1 }} />
        {[1, 2, 3, 4].map((s) => (
          <div key={s} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: s <= step ? 'var(--color-primary)' : '#ffffff',
              border: s <= step ? 'none' : '2px solid var(--color-border-subtle)',
              color: s <= step ? '#ffffff' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              {s < step ? <CheckCircle2 size={18} /> : s}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: s === step ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
              {s === 1 ? 'Store' : s === 2 ? 'Tax KYC' : s === 3 ? 'Payout' : 'Confirm'}
            </span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Container */}
      <div className="table-card" style={{ padding: '32px' }}>
        {/* Step 1: Store Information */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={20} color="var(--color-primary)" />
              <span>Store & Brand Identity</span>
            </h3>

            <div className="form-group">
              <label className="form-label">Store / Brand Name</label>
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
              <label className="form-label">Store Description</label>
              <textarea
                className="textarea-field"
                rows="3"
                placeholder="Describe your craft, brand heritage, or catalog offerings..."
                value={formData.store_description}
                onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Registered Business Address</label>
              <input
                type="text"
                className="input-field"
                placeholder="Full operational registered street address"
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--color-secondary)" />
              <span>Regulatory Tax Registration</span>
            </h3>

            <div className="form-group">
              <label className="form-label">Permanent Account Number (PAN)</label>
              <input
                type="text"
                className="input-field"
                placeholder="ABCDE1234F"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Required for Indian taxation compliance and TDS reporting.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN (Optional for Composition / Excluded Categories)</label>
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} color="#6366F1" />
              <span>Settlement Bank Account</span>
            </h3>

            <div className="form-group">
              <label className="form-label">Account Holder Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="As per bank passbook / statement"
                value={formData.account_holder_name}
                onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bank Account Number</label>
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
              <label className="form-label">Bank IFSC Code</label>
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="var(--color-success)" />
              <span>Primary Category & Verification Consent</span>
            </h3>

            <div className="form-group">
              <label className="form-label">Primary Product Category</label>
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

            <div style={{ background: 'var(--color-surface-subtle)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <p><strong>Merchant Declaration:</strong> I hereby certify that the tax details and bank coordinates provided are authentic and belong to my registered business entity. I agree to abide by the Vyapari Merchant Terms of Service and Code of Conduct.</p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--color-border-card)' }}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep((prev) => prev - 1)} className="btn-outline">
              <ArrowLeft size={16} />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button type="button" onClick={handleNext} className="btn-primary">
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-primary"
              disabled={loading}
            >
              <span>{loading ? 'Submitting Application...' : 'Submit KYC Application'}</span>
              <CheckCircle2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerOnboardingPage;
