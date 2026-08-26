import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* ─── DESIGN.MD — Cinematic Track ───
   Canvas: #000000
   Typography: display-xxl (96px / weight 300) · eyebrow-cap · body-md
   Buttons: button-outline-on-dark (white stroked pill)
   No colours, no glows — photography and whitespace do the work.
─────────────────────────────────────── */

const FEATURES = [
  {
    icon: <AIIcon />,
    title: 'AI Recommendations',
    desc: 'Personalized for every customer using deep behavioral analysis and collaborative filtering.',
  },
  {
    icon: <BoxIcon />,
    title: 'Smart Inventory',
    desc: 'Never run out of stock. Autonomous agents monitor and restock before you even notice.',
  },
  {
    icon: <ShieldIcon />,
    title: 'HITL Control',
    desc: 'Human oversight at AI speed. You approve, the platform executes with full auditability.',
  },
  {
    icon: <PriceIcon />,
    title: 'Dynamic Pricing',
    desc: 'AI-driven price optimisation using market signals, demand forecasting, and competitor data.',
  },
  {
    icon: <ChartIcon />,
    title: 'Revenue Analytics',
    desc: 'Real-time dashboards with confidence-scored insights across your entire catalogue.',
  },
  {
    icon: <BrainIcon />,
    title: 'Agent Decisions',
    desc: 'Every AI action is explainable, scored, and reversible. Complete transparency, zero risk.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Agents Monitor 24/7',
    desc: 'Autonomous agents continuously watch inventory, prices, reviews, and customer behaviour in real-time.',
  },
  {
    num: '02',
    title: 'AI Proposes Actions',
    desc: 'Every suggestion comes with confidence scores, risk tiers, and full reasoning transparency.',
  },
  {
    num: '03',
    title: 'You Approve, We Execute',
    desc: 'One click to approve or reject. Full audit trail. Complete control, zero operational overhead.',
  },
];

const STATS = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '2.4×',  label: 'Revenue lift' },
  { value: '<50ms', label: 'Decision latency' },
  { value: '100%',  label: 'Audit coverage' },
];

const FOOTER_LINKS = {
  Platform: ['Features', 'Pricing', 'Changelog', 'Status'],
  Merchants: ['Start selling', 'Seller portal', 'API docs', 'Integrations'],
  Company:   ['About', 'Blog', 'Careers', 'Press'],
  Legal:     ['Privacy', 'Terms', 'Security', 'Cookies'],
};

export default function LandingPage() {
  const [visible, setVisible] = useState({});

  /* ── Intersection observer for scroll-in animations ── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setVisible(v => ({ ...v, [e.target.dataset.section]: true }));
      }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{
      background: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
      overflowX: 'hidden',
    }}>

      {/* ── NAV — nav-bar-dark ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64, zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Wordmark */}
        <span style={{
          fontSize: 18, fontWeight: 500,
          color: '#ffffff', letterSpacing: '0.5px',
          fontFeatureSettings: '"ss03"',
        }}>
          VYAPARI
        </span>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {['Features', 'How it works', 'Pricing'].map(label => (
            <span key={label} style={{
              padding: '7px 16px', borderRadius: 9999,
              fontSize: 15, fontWeight: 420, color: 'rgba(255,255,255,0.6)',
              cursor: 'default',
              fontFeatureSettings: '"ss03"',
            }}>{label}</span>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/login" style={{
            padding: '9px 20px', borderRadius: 9999,
            fontSize: 15, fontWeight: 420, color: '#ffffff',
            textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.3)',
            transition: 'border-color 0.18s, background 0.18s',
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#ffffff'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
          >
            Sign in
          </Link>
          <Link to="/register" style={{
            padding: '9px 20px', borderRadius: 9999,
            fontSize: 15, fontWeight: 420, color: '#ffffff',
            textDecoration: 'none',
            border: '2px solid #ffffff',
            transition: 'background 0.18s',
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── HERO — cinematic ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        textAlign: 'center', padding: '120px 24px 80px',
      }}>
        {/* Subtle noise texture overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,255,255,0.03) 0%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, animation: 'floatIn 0.9s ease both' }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 14px', borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.2)',
            fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.72px', textTransform: 'uppercase',
            marginBottom: 48,
            fontFeatureSettings: '"ss03"',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#ffffff',
              animation: 'livePulse 2s infinite',
            }} />
            Autonomous Commerce Platform
          </div>

          {/* Display headline — display-xxl: 96px / weight 300 */}
          <h1 style={{
            fontSize: 'clamp(3rem, 10vw, 96px)',
            fontWeight: 300,
            lineHeight: 1.0,
            letterSpacing: '2.4px',
            marginBottom: 40,
            color: '#ffffff',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontFeatureSettings: '"ss03"',
          }}>
            VYAPARI
          </h1>

          {/* Sub-headline — display-lg scale */}
          <p style={{
            fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.55)',
            marginBottom: 16,
            lineHeight: 1.16,
            letterSpacing: 0,
            fontFeatureSettings: '"ss03"',
          }}>
            The Autonomous E-Commerce Platform
          </p>

          {/* Body lead — body-lg */}
          <p style={{
            fontSize: 18, fontWeight: 420, color: 'rgba(255,255,255,0.4)',
            maxWidth: 540, margin: '0 auto 64px',
            lineHeight: 1.56,
            fontFeatureSettings: '"ss03"',
          }}>
            AI agents run your store. You stay in control.
            Real-time decisions, full audit trails, zero operational overhead.
          </p>

          {/* CTAs — pill only */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* button-outline-on-dark */}
            <Link to="/shop" style={{
              padding: '14px 32px', borderRadius: 9999,
              background: 'transparent',
              border: '2px solid #ffffff',
              color: '#ffffff',
              fontWeight: 420, fontSize: 16,
              textDecoration: 'none', transition: 'background 0.18s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Start Shopping
            </Link>
            {/* button-outline-on-dark (secondary) */}
            <Link to="/login?role=seller" style={{
              padding: '14px 32px', borderRadius: 9999,
              background: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 420, fontSize: 16,
              textDecoration: 'none', transition: 'border-color 0.18s, background 0.18s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffffff'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            >
              Seller Portal
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{
          position: 'absolute', bottom: 36,
          color: 'rgba(255,255,255,0.2)', fontSize: 22,
          animation: 'bounce 2.5s ease-in-out infinite',
        }}>↓</div>
      </section>

      {/* ── STATS STRIP — hairline dividers, no backgrounds ── */}
      <section data-section="stats" style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '48px 24px',
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
          opacity: visible.stats ? 1 : 0,
          transform: visible.stats ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '16px',
              borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              <div style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 300, color: '#ffffff',
                lineHeight: 1, marginBottom: 8,
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                letterSpacing: 0,
                fontFeatureSettings: '"ss03"',
              }}>{s.value}</div>
              <div style={{
                fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.72px',
                fontFeatureSettings: '"ss03"',
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES — card-feature-cinematic ── */}
      <section data-section="features" style={{ padding: '128px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{
            fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.72px', textTransform: 'uppercase', marginBottom: 20,
            fontFeatureSettings: '"ss03"',
          }}>
            Platform Capabilities
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 55px)',
            fontWeight: 300, color: '#ffffff',
            lineHeight: 1.16, letterSpacing: 0,
            fontFeatureSettings: '"ss03"',
          }}>
            Why Vyapari?
          </h2>
          <p style={{
            fontSize: 18, fontWeight: 420, color: 'rgba(255,255,255,0.4)',
            maxWidth: 480, margin: '24px auto 0', lineHeight: 1.56,
            fontFeatureSettings: '"ss03"',
          }}>
            Everything you need to run a modern e-commerce operation — fully automated.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 1,   /* 1px gap = hairline between cells */
          opacity: visible.features ? 1 : 0,
          transform: visible.features ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {FEATURES.map((f, i) => (
            <CinematicFeatureCard key={f.title} f={f} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section data-section="how" style={{
        padding: '128px 24px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div style={{
              fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.72px', textTransform: 'uppercase', marginBottom: 20,
              fontFeatureSettings: '"ss03"',
            }}>
              How It Works
            </div>
            <h2 style={{
              fontSize: 'clamp(2rem, 5vw, 55px)',
              fontWeight: 300, color: '#ffffff',
              lineHeight: 1.16, letterSpacing: 0,
              fontFeatureSettings: '"ss03"',
            }}>
              Simple. Powerful. Transparent.
            </h2>
          </div>

          <div style={{
            opacity: visible.how ? 1 : 0,
            transform: visible.how ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{
                display: 'flex', gap: 40, alignItems: 'flex-start',
                padding: '48px 0',
                borderBottom: i < STEPS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                animation: visible.how ? `floatIn 0.5s ${i * 120}ms ease both` : 'none',
              }}>
                {/* Step number */}
                <div style={{
                  flexShrink: 0,
                  width: 56, height: 56, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                  letterSpacing: '0.5px',
                }}>
                  {step.num}
                </div>
                <div style={{ paddingTop: 12 }}>
                  <h3 style={{
                    fontSize: 24, fontWeight: 400, color: '#ffffff',
                    marginBottom: 12, letterSpacing: '0.36px',
                    fontFeatureSettings: '"ss03"',
                    lineHeight: 1.14,
                  }}>
                    {step.title}
                  </h3>
                  <p style={{
                    fontSize: 16, fontWeight: 420, color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.5, fontFeatureSettings: '"ss03"',
                  }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section data-section="cta" style={{ padding: '128px 24px', textAlign: 'center' }}>
        <div style={{
          maxWidth: 600, margin: '0 auto',
          opacity: visible.cta ? 1 : 0,
          transform: visible.cta ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.72px', textTransform: 'uppercase', marginBottom: 24,
            fontFeatureSettings: '"ss03"',
          }}>
            Get started
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 6vw, 70px)',
            fontWeight: 300, color: '#ffffff',
            lineHeight: 1.0, letterSpacing: 0,
            marginBottom: 24,
            fontFeatureSettings: '"ss03"',
          }}>
            Ready to automate?
          </h2>
          <p style={{
            fontSize: 18, fontWeight: 420, color: 'rgba(255,255,255,0.4)',
            marginBottom: 56, lineHeight: 1.56,
            fontFeatureSettings: '"ss03"',
          }}>
            Join merchants who run their stores on autopilot with Vyapari's autonomous AI platform.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{
              padding: '14px 36px', borderRadius: 9999,
              background: '#ffffff', color: '#000000',
              fontWeight: 420, fontSize: 16,
              textDecoration: 'none', transition: 'background 0.18s',
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e4e4e7'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
            >
              Create free account
            </Link>
            <Link to="/login" style={{
              padding: '14px 36px', borderRadius: 9999,
              background: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 420, fontSize: 16,
              textDecoration: 'none', transition: 'border-color 0.18s, color 0.18s',
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffffff'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER — footer-dark ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '64px 40px 40px',
        background: '#000000',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Top row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 40, marginBottom: 64,
          }}>
            {/* Brand column */}
            <div>
              <div style={{
                fontSize: 15, fontWeight: 500, color: '#ffffff',
                marginBottom: 16, fontFeatureSettings: '"ss03"',
              }}>VYAPARI</div>
              <p style={{
                fontSize: 14, fontWeight: 420, color: '#9dabad',
                lineHeight: 1.6, fontFeatureSettings: '"ss03"',
              }}>
                The autonomous e-commerce platform for modern merchants.
              </p>
            </div>
            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([section, links]) => (
              <div key={section}>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.72px', textTransform: 'uppercase',
                  marginBottom: 16, fontFeatureSettings: '"ss03"',
                }}>{section}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(link => (
                    <span key={link} style={{
                      fontSize: 14, fontWeight: 420, color: '#9dabad',
                      cursor: 'default', transition: 'color 0.18s',
                      fontFeatureSettings: '"ss03"',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#9dabad'}
                    >{link}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legal row */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 420, color: 'rgba(255,255,255,0.25)',
              fontFeatureSettings: '"ss03"',
            }}>
              © {new Date().getFullYear()} Vyapari. All rights reserved.
            </span>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Privacy', 'Terms', 'Cookies'].map(label => (
                <span key={label} style={{
                  fontSize: 13, fontWeight: 420, color: 'rgba(255,255,255,0.25)',
                  cursor: 'default', transition: 'color 0.18s',
                  fontFeatureSettings: '"ss03"',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                >{label}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Inline keyframes for page-specific animations */}
      <style>{`
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(8px); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
        @media (max-width: 768px) {
          .landing-nav-links { display: none !important; }
          [data-section="stats"] > div { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          [data-section="stats"] > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ─── Cinematic Feature Card ─── */
function CinematicFeatureCard({ f }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0a0a0a' : '#000000',
        padding: '40px 32px',
        transition: 'background 0.25s',
        cursor: 'default',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: hovered ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
      }}
    >
      {/* Icon — simple white-on-black container */}
      <div style={{
        width: 44, height: 44, borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, color: hovered ? '#ffffff' : 'rgba(255,255,255,0.5)',
        transition: 'color 0.25s, border-color 0.25s',
        borderColor: hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
      }}>
        {f.icon}
      </div>
      <h3 style={{
        fontSize: 20, fontWeight: 500, color: '#ffffff',
        marginBottom: 12, letterSpacing: '0.3px',
        lineHeight: 1.4, fontFeatureSettings: '"ss03"',
      }}>{f.title}</h3>
      <p style={{
        fontSize: 15, fontWeight: 420, color: 'rgba(255,255,255,0.4)',
        lineHeight: 1.6, fontFeatureSettings: '"ss03"',
      }}>{f.desc}</p>
    </div>
  );
}

/* ─── SVG Icons — thin stroke to match display weight ─── */
function AIIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/></svg>; }
function BoxIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>; }
function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function PriceIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" x2="12" y1="1" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function ChartIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6"  x2="6"  y1="20" y2="14"/></svg>; }
function BrainIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>; }
