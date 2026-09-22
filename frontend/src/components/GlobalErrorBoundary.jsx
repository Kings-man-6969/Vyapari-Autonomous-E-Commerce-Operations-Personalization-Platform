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
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--color-obsidian-graphite)',
          color: '#ffffff'
        }}>
          <div style={{
            background: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '520px',
            boxShadow: 'var(--shadow-elevated)'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              fontSize: '20px',
              fontWeight: 700
            }}>
              !
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 330, letterSpacing: '0.02em', marginBottom: '0.75rem', color: '#ffffff' }}>
              Unexpected Execution Exception
            </h2>
            <p style={{ color: 'var(--color-steel-mist)', marginBottom: '1.75rem', fontSize: '0.92rem', lineHeight: 1.6 }}>
              A localized frontend component exception was intercepted. Autonomous telemetry has recorded the state stack trace.
            </p>
            <button
              onClick={this.handleReload}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: '13px'
              }}
            >
              Restart Component Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
