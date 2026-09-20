import React from 'react';
import { RefreshCw, CheckCircle2, Clock, Truck } from 'lucide-react';

export const ReturnsPage = () => {
  return (
    <div className="container" style={{ padding: '60px 24px 80px', maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Returns & Refund Policy</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Hassle-free 7-day returns for customer peace of mind
        </p>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '36px', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ padding: '16px', background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <Clock size={24} color="var(--color-primary)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontWeight: 700 }}>7 Days Window</h4>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>From package delivery date</p>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <Truck size={24} color="var(--color-secondary)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontWeight: 700 }}>Free Doorstep Pickup</h4>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Scheduled at your convenience</p>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <CheckCircle2 size={24} color="var(--color-success)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontWeight: 700 }}>Instant Refund</h4>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Upon warehouse inspection</p>
          </div>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>How to Initiate a Return</h2>
        <ol style={{ paddingLeft: '20px', marginBottom: '24px', color: 'var(--color-text-secondary)' }}>
          <li style={{ marginBottom: '8px' }}>Go to <strong>My Orders</strong> in your account menu.</li>
          <li style={{ marginBottom: '8px' }}>Select the order containing the item you wish to return.</li>
          <li style={{ marginBottom: '8px' }}>Click <strong>Request Return</strong>, select the return reason, and choose your preferred pickup slot.</li>
          <li>Hand the packaged item with original tags to our courier partner.</li>
        </ol>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>Non-Returnable Categories</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          For hygiene and security reasons, personal care items, innerwear, customized/personalized goods, and digital software products cannot be returned unless received in a damaged or defective condition.
        </p>
      </div>
    </div>
  );
};

export default ReturnsPage;
