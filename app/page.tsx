import Link from 'next/link'

export default function LandingPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#0F0F0F', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white', fontSize: '20px', fontWeight: 700, letterSpacing: '0.02em', fontFamily: 'sans-serif' }}>Pulse</span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Link href="/login" style={{ color: '#A0A0A0', fontSize: '14px', textDecoration: 'none', fontFamily: 'sans-serif' }}>Sign in</Link>
          <Link href="/signup" style={{ background: '#C8392B', color: 'white', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none', fontFamily: 'sans-serif', fontWeight: 500 }}>Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 48px', textAlign: 'center' }}>
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '20px', padding: '6px 16px', marginBottom: '32px', display: 'inline-block' }}>
          <span style={{ color: '#A0A0A0', fontSize: '13px', fontFamily: 'sans-serif' }}>Smart SMS for small businesses</span>
        </div>
        <h1 style={{ fontSize: '64px', fontWeight: 700, color: 'white', margin: '0 0 24px', lineHeight: 1.1, fontFamily: 'sans-serif', maxWidth: '800px' }}>
          Simple messaging for businesses built on relationships.
        </h1>
        <p style={{ fontSize: '20px', color: '#6B6B6B', marginBottom: '48px', maxWidth: '520px', lineHeight: 1.6, fontFamily: 'sans-serif' }}>
          Pulse helps your team reach students, parents, and customers with the information that matters. Write your message, describe who should receive it, and Pulse takes care of the rest. Designed for schools, studios, and small businesses where communication is personal and every message comes from a familiar voice.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/signup" style={{ background: '#C8392B', color: 'white', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', textDecoration: 'none', fontFamily: 'sans-serif', fontWeight: 600 }}>
            Start for free
          </Link>
          <Link href="/demo" style={{ background: '#1A1A1A', color: 'white', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', textDecoration: 'none', fontFamily: 'sans-serif', fontWeight: 500, border: '1px solid #2A2A2A' }}>
            Try the demo
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: '80px 48px', borderTop: '1px solid #1A1A1A' }}>
        <h2 style={{ textAlign: 'center', color: 'white', fontSize: '32px', fontWeight: 600, marginBottom: '64px', fontFamily: 'sans-serif' }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '900px', margin: '0 auto' }}>
          {[
            { step: '01', title: 'Bring your contacts', body: 'Import the spreadsheet you already use. Pulse organizes your contacts and prepares them for messaging in just a few minutes.' },
            { step: '02', title: 'Tell Pulse who it\'s for', body: 'Tell Pulse who should receive it. Whether it\'s tomorrow\'s students, families with overdue invoices, or everyone taking piano lessons, Pulse identifies the right people and builds the recipient list for you.' },
            { step: '03', title: 'Send your message', body: 'Your message reaches exactly the people who need it, at the right time, from a business they already know and trust. Simple for your team. Clear for your customers.' },
          ].map(({ step, title, body }) => (
            <div key={step} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '16px', padding: '32px' }}>
              <div style={{ color: '#C8392B', fontSize: '13px', fontWeight: 600, marginBottom: '16px', fontFamily: 'sans-serif' }}>{step}</div>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 600, marginBottom: '12px', fontFamily: 'sans-serif' }}>{title}</h3>
              <p style={{ color: '#6B6B6B', fontSize: '14px', lineHeight: 1.6, fontFamily: 'sans-serif', margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div style={{ padding: '80px 48px', borderTop: '1px solid #1A1A1A', textAlign: 'center' }}>
        <h2 style={{ color: 'white', fontSize: '32px', fontWeight: 600, marginBottom: '16px', fontFamily: 'sans-serif' }}>
          Never miss a reason to reach out
        </h2>
        <p style={{ color: '#6B6B6B', fontSize: '18px', lineHeight: 1.6, fontFamily: 'sans-serif', maxWidth: '640px', margin: '0 auto' }}>
          Pulse uncovers meaningful opportunities to connect—from upcoming recitals and birthdays to milestones, renewals, missed lessons, and students who may need a little encouragement.
        </p>
      </div>

      {/* Footer */}
      <div style={{ padding: '32px 48px', borderTop: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#3A3A3A', fontSize: '13px', fontFamily: 'sans-serif' }}>© 2026 Pulse by Layered Labs</span>
        <Link href="/login" style={{ color: '#3A3A3A', fontSize: '13px', textDecoration: 'none', fontFamily: 'sans-serif' }}>Sign in</Link>
      </div>
    </main>
  )
}