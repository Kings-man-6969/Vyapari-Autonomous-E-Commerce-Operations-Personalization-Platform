import React from 'react';
import { RefreshCw, CheckCircle2, Clock, Truck } from 'lucide-react';

export const ReturnsPage = () => {
  return (
    <div style={{ padding: '60px 24px 80px', maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>
          Returns & Refund Policy
        </h1>
        <p style={{ color: 'var(--color-steel-mist)', fontSize: '0.875rem' }}>
          7-day verified return guarantee for transparent marketplace trade
        </p>
      </div>

      <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '16px', padding: '36px', lineHeight: 1.7, fontSize: '0.875rem', color: '#ffffff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ padding: '20px', background: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', borderRadius: '10px', textAlign: 'center' }}>
            <Clock size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontWeight: 500, color: '#ffffff' }}>7 Days Return Window</h4>
            <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', marginTop: '2px' }}>From confirmed delivery timestamp</p>
          </div>
          <div style={{ padding: '20px', background: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', borderRadius: '10px', textAlign: 'center' }}>
            <Truck size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontWeight: 500, color: '#ffffff' }}>Courier Doorstep Pickup</h4>
            <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', marginTop: '2px' }}>Scheduled via authorized carrier</p>
          </div>
          <div style={{ padding: '20px', background: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', borderRadius: '10px', textAlign: 'center' }}>
            <CheckCircle2 size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontWeight: 500, color: '#ffffff' }}>Automated Settlement</h4>
            <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', marginTop: '2px' }}>Dispatched upon merchant receipt</p>
          </div>
        </div>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>Fulfillment Return Workflow</h2>
        <ol style={{ paddingLeft: '20px', marginBottom: '24px', color: 'var(--color-steel-mist)' }}>
          <li style={{ marginBottom: '8px' }}>Navigate to <strong>My Orders</strong> in your account dashboard.</li>
          <li style={{ marginBottom: '8px' }}>Select the eligible delivered order and choose <strong>Initiate Return</strong>.</li>
          <li style={{ marginBottom: '8px' }}>Specify reason and package the item with intact manufacturer tags and original container.</li>
          <li>Hand over parcel to assigned pickup courier with generated return slip.</li>
        </ol>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>Policy Ingestion for Support RAG</h2>
        <p style={{ color: 'var(--color-steel-mist)' }}>
          These return conditions are continuously ingested by our Customer Support RAG agent to provide verified resolution answers in customer service chats.
        </p>
      </div>
    </div>
  );
};

export default ReturnsPage;
