import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Package, 
  AlertCircle, 
  Sparkles, 
  Tag, 
  Clock,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import api from '../services/api';

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'preferences'

  // Notification Preferences state (Item 9 Option A)
  const [preferences, setPreferences] = useState({
    order_updates: true,
    promotions: false,
    ai_recommendations: true,
    inventory_advisories: true
  });
  const [prefNotice, setPrefNotice] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      if (res.data?.success) {
        const list = Array.isArray(res.data.data?.notifications)
          ? res.data.data.notifications
          : (Array.isArray(res.data.data) ? res.data.data : (res.data.notifications || []));
        setNotifications(list);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const saved = localStorage.getItem('vyapari_notif_prefs');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleTogglePref = (key) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('vyapari_notif_prefs', JSON.stringify(updated));
      setPrefNotice('Notification preferences synchronized.');
      setTimeout(() => setPrefNotice(''), 3000);
      return updated;
    });
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order_status':
        return <Package size={16} color="var(--color-icy-steel)" />;
      case 'ai_recommendation':
        return <Sparkles size={16} color="var(--color-icy-steel)" />;
      case 'price_drop':
        return <Tag size={16} color="#facc15" />;
      default:
        return <Bell size={16} color="var(--color-silver-glow)" />;
    }
  };

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: '880px', margin: '0 auto', minHeight: '60vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        borderBottom: '1px solid var(--color-iron-veil)',
        paddingBottom: '16px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Notifications & Platform Signals
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Live status updates, order fulfillment milestones, and AI recommendations
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab(activeTab === 'feed' ? 'preferences' : 'feed')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: activeTab === 'preferences' ? '#ffffff' : 'var(--color-forest-floor)',
              color: activeTab === 'preferences' ? '#02090a' : 'var(--color-tide-pool)',
              border: '1px solid',
              borderColor: activeTab === 'preferences' ? '#ffffff' : 'var(--color-iron-veil)',
              fontSize: '12px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Sliders size={13} />
            <span>{activeTab === 'preferences' ? 'View Feed' : 'Preferences'}</span>
          </button>
          {notifications.some((n) => !n.is_read) && activeTab === 'feed' && (
            <button
              onClick={handleMarkAllAsRead}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-forest-floor)',
                border: '1px solid var(--color-iron-veil)',
                color: 'var(--color-tide-pool)',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <CheckCheck size={14} />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {prefNotice && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--color-icy-steel)',
          fontSize: '0.875rem'
        }}>
          <CheckCircle2 size={16} />
          <span>{prefNotice}</span>
        </div>
      )}

      {/* Preferences Panel */}
      {activeTab === 'preferences' ? (
        <div className="table-card" style={{ padding: '28px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>
            Dispatch Channels & Subscription Filters
          </h2>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.8125rem', marginBottom: '24px', lineHeight: 1.5 }}>
            Configure real-time event signals dispatched to your account session.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { key: 'order_updates', title: 'Order & Shipping Milestones', desc: 'Real-time updates on fulfillment, courier dispatch, out for delivery, and payment confirmation.' },
              { key: 'ai_recommendations', title: 'AI Personalization & Catalog Signals', desc: 'Alerts when pgvector matches your aesthetic preferences with new merchant drops.' },
              { key: 'inventory_advisories', title: 'Operational Inventory Alerts', desc: 'Depletion runway warnings and stockout risk updates (Merchants).' },
              { key: 'promotions', title: 'Seasonal Market Campaigns', desc: 'Special promotion events and curated marketplace features.' }
            ].map((pref) => (
              <div
                key={pref.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-deep-canopy)',
                  border: '1px solid var(--color-iron-veil)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#ffffff', marginBottom: '2px' }}>{pref.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>{pref.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePref(pref.key)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '9999px',
                    backgroundColor: preferences[pref.key] ? 'var(--color-icy-steel)' : 'var(--color-border-steel)',
                    border: 'none',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: preferences[pref.key] ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#02090a',
                    transition: 'left 0.2s ease'
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Tabs */}
          <div className="tab-list" style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setFilter('all')}
              className={`tab-button ${filter === 'all' ? 'active' : ''}`}
            >
              All Signals ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`tab-button ${filter === 'unread' ? 'active' : ''}`}
            >
              Unread ({notifications.filter((n) => !n.is_read).length})
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ height: '80px', backgroundColor: 'var(--color-forest-floor)', borderRadius: '12px' }} className="skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '64px 24px',
              backgroundColor: 'var(--color-forest-floor)',
              borderRadius: '16px',
              border: '1px dashed var(--color-iron-veil)'
            }}>
              <Bell size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>
                All clear
              </h3>
              <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem' }}>
                {filter === 'unread'
                  ? 'No unread platform notifications at this moment.'
                  : 'Fulfillment and AI recommendation signals will populate here.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: item.is_read ? 'var(--color-gunmetal-dark)' : 'var(--color-titanium-brushed)',
                    border: '1px solid',
                    borderColor: item.is_read ? 'var(--color-border-steel)' : 'rgba(56, 189, 248, 0.35)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-abyssal-ink)',
                      border: '1px solid var(--color-iron-veil)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getNotificationIcon(item.type)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--color-tide-pool)', lineHeight: 1.5, marginBottom: '6px' }}>
                        {item.message}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-ash-label)' }}>
                        <Clock size={11} />
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {!item.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        color: 'var(--color-icy-steel)',
                        backgroundColor: 'var(--color-obsidian-graphite)',
                        border: '1px solid var(--color-border-steel)',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationsPage;
