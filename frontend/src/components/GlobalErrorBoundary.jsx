import React, { Component } from 'react';

export class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Non-blocking asynchronous reporting to telemetry endpoint
    try {
      fetch('/api/telemetry/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: String(error?.message || 'Unknown render error').slice(0, 500),
          url_path: window.location.pathname,
          stack: String(error?.stack || errorInfo?.componentStack || '').slice(0, 1500),
        }),
      }).catch(() => {});
    } catch {
      // Avoid cascading error loops
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--color-text-primary, #0F172A)'
        }}>
          <div style={{
            background: 'var(--color-surface, #F8FAFC)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '2.5rem',
            maxWidth: '480px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Something unexpected happened
            </h2>
            <p style={{ color: 'var(--color-text-secondary, #64748B)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              An unexpected display error occurred. Our team has been notified. You can reload this page to continue.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: 'var(--color-primary, #6366F1)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
