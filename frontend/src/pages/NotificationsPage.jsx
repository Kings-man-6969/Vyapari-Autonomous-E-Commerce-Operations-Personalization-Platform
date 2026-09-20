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
  Clock
} from 'lucide-react';
import api from '../services/api';

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

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
        return <Package size={18} color="var(--color-secondary)" />;
      case 'ai_recommendation':
        return <Sparkles size={18} color="var(--color-primary)" />;
      case 'price_drop':
        return <Tag size={18} color="var(--color-success)" />;
      default:
        return <Bell size={18} color="var(--color-text-secondary)" />;
    }
  };

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '800px', minHeight: '60vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        borderBottom: '1px solid var(--color-border-card)',
        paddingBottom: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Notifications
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Updates on order progress, delivery milestones, and platform alerts
          </p>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllAsRead}
            className="btn-outline"
            style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCheck size={16} />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="tab-list" style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setFilter('all')}
          className={`tab-button ${filter === 'all' ? 'active' : ''}`}
        >
          All ({notifications.length})
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
            <div key={n} style={{ height: '80px' }} className="skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 24px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border-subtle)'
        }}>
          <Bell size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>
            No notifications to display
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {filter === 'unread'
              ? 'You are all caught up! No unread messages.'
              : 'You will receive notifications here when your orders update.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: item.is_read ? '#ffffff' : 'var(--color-primary-light)',
                border: '1px solid var(--color-border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'background-color var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-xs)',
                  flexShrink: 0
                }}>
                  {getNotificationIcon(item.type)}
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '6px' }}>
                    {item.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    <Clock size={12} />
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
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--color-primary)',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-border-subtle)',
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
    </div>
  );
};

export default NotificationsPage;
