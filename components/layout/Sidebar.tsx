"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Users, Send, BookOpen, Upload } from 'lucide-react';

const navItems = [
  { href: '/campaigns', icon: Send, label: 'Campaigns' },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { href: '/history', icon: BookOpen, label: 'History' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const linkStyle = (href: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    margin: '2px 0',
    transition: 'background-color 0.15s, color 0.15s',
    backgroundColor: pathname.startsWith(href) ? '#2F2118' : 'transparent',
    color: pathname.startsWith(href) ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
  });

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100%',
      width: '220px',
      backgroundColor: '#1A130F',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #251A14',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid #251A14',
      }}>
        <span style={{ fontFamily: 'var(--font-baloo-2), sans-serif', color: '#FFFFFF', fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}>Odeon</span>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', display: 'block', marginTop: '2px' }}>Headliner Music Academy</span>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} style={linkStyle(item.href)}>
            <item.icon size={16} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom nav */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #251A14' }}>
        <Link href="/import" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 12px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          color: pathname === '/import' ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
          transition: 'background-color 0.15s, color 0.15s',
          backgroundColor: pathname === '/import' ? '#2F2118' : 'transparent',
        }}>
          <Upload size={16} />
          <span>Import CSV</span>
        </Link>
      </div>
    </aside>
  );
}