import React, { useState } from 'react';
import type { Dealer } from '../../lib/types';

interface PortalLayoutProps {
  dealer: Dealer | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isAdmin?: boolean;
  children: React.ReactNode;
}

const DEALER_NAV_ITEMS = [
  { path: '/dealer-portal/dashboard', label: 'Dashboard', icon: '\u25A3' },
  { path: '/dealer-portal/projects', label: 'Projects', icon: '\u2637' },
  { path: '/dealer-portal/orders', label: 'Orders', icon: '\u2750' },
  { path: '/dealer-portal/warranty', label: 'Warranty', icon: '\u2696' },
  { path: '/dealer-portal/account', label: 'Account', icon: '\u2699' },
];

const ADMIN_NAV_ITEMS = [
  { path: '/dealer-portal/dashboard', label: 'Admin Dashboard', icon: '\u25A3' },
  { path: '/dealer-portal/projects', label: 'All Projects', icon: '\u2637' },
  { path: '/dealer-portal/orders', label: 'All Orders', icon: '\u2750' },
  { path: '/dealer-portal/warranty', label: 'Warranty Claims', icon: '\u2696' },
  { path: '/dealer-portal/account', label: 'Account', icon: '\u2699' },
];

export default function PortalLayout({ dealer, currentPath, onNavigate, onLogout, isAdmin, children }: PortalLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV_ITEMS = isAdmin ? ADMIN_NAV_ITEMS : DEALER_NAV_ITEMS;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      background: '#f7f4f0',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        background: '#2d2d2d',
        color: '#fdfcfa',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        transform: mobileMenuOpen ? 'translateX(0)' : undefined,
        transition: 'transform 300ms',
      }}
      className="portal-sidebar"
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1.3rem',
              fontWeight: 400,
              color: '#fdfcfa',
              letterSpacing: '0.02em',
            }}>
              Pronorm <span style={{ color: '#b87333' }}>USA</span>
            </div>
          </a>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b87333', marginTop: '0.25rem' }}>
            {isAdmin ? 'Admin Portal' : 'Dealer Portal'}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '1rem 0', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => { onNavigate(item.path); setMobileMenuOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: isActive ? 'rgba(184, 115, 51, 0.15)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #b87333' : '3px solid transparent',
                  color: isActive ? '#fdfcfa' : '#b5aca3',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all 200ms',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Dealer info + logout */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {dealer && (
            <div style={{ fontSize: '0.78rem', color: '#b5aca3', marginBottom: '0.75rem' }}>
              {isAdmin ? (
                <>
                  <div style={{ fontWeight: 600, color: '#b87333' }}>Pronorm Admin</div>
                  <div>{dealer.contact_name}</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, color: '#fdfcfa' }}>{dealer.company_name}</div>
                  <div>{dealer.contact_name}</div>
                </>
              )}
            </div>
          )}
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#b5aca3',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 200ms',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="portal-mobile-header" style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: '#2d2d2d',
        zIndex: 99,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
      }}>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', color: '#fdfcfa' }}>
          Pronorm <span style={{ color: '#b87333' }}>USA</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ background: 'none', border: 'none', color: '#fdfcfa', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          {mobileMenuOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99,
          }}
          className="portal-mobile-overlay"
        />
      )}

      {/* Main content */}
      <main style={{
        flex: 1,
        marginLeft: '240px',
        padding: '2rem',
        minHeight: '100vh',
      }}
      className="portal-main"
      >
        {children}
      </main>
    </div>
  );
}
