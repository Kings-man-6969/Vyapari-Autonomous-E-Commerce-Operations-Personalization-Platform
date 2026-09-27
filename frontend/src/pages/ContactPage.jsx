import React from 'react';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { EnquiryForm } from '../components/EnquiryForm';

/**
 * The contact page — the `contact_form` capture point.
 *
 * The details beside the form are static on purpose. There is no support-desk
 * integration, and inventing an "average response time" number would be making
 * a promise the platform cannot keep.
 */
const DETAILS = [
  { icon: <Mail size={17} />, label: 'Email', value: 'support@vyapari.example' },
  { icon: <Phone size={17} />, label: 'Phone', value: '+91 80 4000 0000' },
  { icon: <MapPin size={17} />, label: 'Registered office', value: 'Bengaluru, Karnataka, India' },
  { icon: <Clock size={17} />, label: 'Support hours', value: 'Mon–Sat, 10:00–19:00 IST' }
];

export const ContactPage = () => (
  <div style={{ padding: '60px 24px 80px', maxWidth: '960px', margin: '0 auto' }}>
    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
      <h1 style={{ fontSize: '2.25rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '12px' }}>
        Contact us
      </h1>
      <p style={{ color: 'var(--color-steel-mist)', fontSize: '1rem' }}>
        Questions about an order, a listing, or selling on Vyapari? Send us a note and we will get
        back to you.
      </p>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '32px',
        alignItems: 'start'
      }}
    >
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid var(--color-border-steel)',
          backgroundColor: 'var(--color-gunmetal-dark)'
        }}
      >
        <EnquiryForm
          source="contact_form"
          heading="Send us a message"
          intro="Tell us what you need and we will route it to the right team."
          submitLabel="Send message"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {DETAILS.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-icy-steel)',
                flexShrink: 0
              }}
            >
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '14px', color: '#ffffff', marginTop: '2px' }}>{item.value}</div>
            </div>
          </div>
        ))}

        <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.6, margin: 0 }}>
          Enquiries about a specific listing are better sent from the product page, where the
          message reaches the seller directly.
        </p>
      </div>
    </div>
  </div>
);

export default ContactPage;
