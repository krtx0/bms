'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../Icon';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../AuthContext';

const COLLAPSE_BELOW_WIDTH = 900;
const MOBILE_BELOW_WIDTH = 640;

type Tier = 'desktop' | 'tablet' | 'mobile';

function tierFor(width: number): Tier {
  if (width < MOBILE_BELOW_WIDTH) return 'mobile';
  if (width < COLLAPSE_BELOW_WIDTH) return 'tablet';
  return 'desktop';
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Server has no `window`, so the initial render must match (expanded, desktop) — correct it
  // right after mount instead of reading window.innerWidth in a useState initializer, which would
  // mismatch between server and client render and trigger a hydration warning. Reacts to the
  // viewport crossing a tier boundary (not every resize pixel), so it never fights a manual
  // Collapse click while the window sits within one tier.
  useEffect(() => {
    let lastTier: Tier | null = null;
    function apply(tier: Tier) {
      lastTier = tier;
      setIsMobile(tier === 'mobile');
      setCollapsed(tier !== 'desktop');
    }
    apply(tierFor(window.innerWidth));

    function onResize() {
      const tier = tierFor(window.innerWidth);
      if (tier !== lastTier) apply(tier);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const showLabels = isMobile || !collapsed;

  return (
    <>
      {isMobile && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed',
            top: 14,
            left: 14,
            zIndex: 96,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--color-sidebar-bg)',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="menu" size={20} />
        </button>
      )}

      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 94 }}
        />
      )}

      <aside
        style={{
          width: isMobile ? 260 : collapsed ? 76 : 260,
          transition: isMobile ? 'transform 200ms ease' : 'width 150ms ease',
          background: 'var(--color-sidebar-bg)',
          color: 'var(--color-sidebar-text)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          flexShrink: 0,
          zIndex: 95,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'var(--color-sidebar-active)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--color-accent-gold)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
            }}
          >
            M
          </div>
          {showLabels && (
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent-gold)', fontSize: 18 }}>
                Mélange
              </div>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', opacity: 0.75 }}>PATISSERIE OS</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                href={item.to}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 2,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive ? '#fff' : 'var(--color-sidebar-text)',
                  background: isActive ? 'var(--color-sidebar-active)' : 'transparent',
                }}
                title={item.label}
              >
                <Icon name={item.icon} />
                {showLabels && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!isMobile && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-sidebar-text)',
              padding: '12px 22px',
              fontSize: 13,
            }}
          >
            <span style={{ transform: collapsed ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}>
              <Icon name="chevronLeft" size={16} />
            </span>
            {!collapsed && 'Collapse'}
          </button>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--color-accent-gold)',
              color: 'var(--color-sidebar-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(user?.full_name || user?.email || 'A').slice(0, 1).toUpperCase()}
          </div>
          {showLabels && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || 'admin'}
              </div>
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', color: 'var(--color-accent-gold)', fontSize: 12, padding: 0 }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
