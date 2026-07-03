"use client";

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import ContactList from '@/components/contacts/ContactList';
import ComposePanel from '@/components/campaigns/ComposePanel';
import { Sparkles, X } from 'lucide-react';

export default function CampaignsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [filteredContactIds, setFilteredContactIds] = useState<string[]>([]);
  const [filterExplanation, setFilterExplanation] = useState('');

  const [pendingInstrument, setPendingInstrument] = useState('');
  const [pendingService, setPendingService] = useState('');
  const [pendingInstructor, setPendingInstructor] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');
  const [pendingDay, setPendingDay] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ instrument: '', service: '', instructor: '', status: '', day: '' });

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeChannel, setComposeChannel] = useState<'sms' | 'email'>('sms');

  const [manualSelectedIds, setManualSelectedIds] = useState<string[]>([]);

  const instruments = [...new Set(contacts.map(c => c.instrument).filter(Boolean))].sort();
  const instructors = [...new Set(contacts.map(c => c.instructor).filter(Boolean))].sort();
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const hasStandardFilters = !!(appliedFilters.instrument || appliedFilters.service || appliedFilters.instructor || appliedFilters.status || appliedFilters.day);

  const standardFiltered = hasStandardFilters ? contacts.filter(c => {
    if (appliedFilters.instrument && c.instrument !== appliedFilters.instrument) return false;
    if (appliedFilters.service && c.service_type !== appliedFilters.service) return false;
    if (appliedFilters.instructor && c.instructor !== appliedFilters.instructor) return false;
    if (appliedFilters.status && c.client_status !== appliedFilters.status) return false;
    if (appliedFilters.day && c.lesson_day !== appliedFilters.day) return false;
    return true;
  }) : [];

  const aiFilterActive = filteredContactIds.length > 0 || filterExplanation !== '';
  const filterActive = aiFilterActive || hasStandardFilters;

  const displayIds: string[] = aiFilterActive ? filteredContactIds : hasStandardFilters ? standardFiltered.map(c => c.id) : [];
  const recipientIds: string[] = filterActive ? displayIds : manualSelectedIds;
  const activeCount = filterActive ? displayIds.length : manualSelectedIds.length;

  const applyFilters = () => {
    setManualSelectedIds([]);
    setFilteredContactIds([]);
    setFilterExplanation('');
    setAppliedFilters({ instrument: pendingInstrument, service: pendingService, instructor: pendingInstructor, status: pendingStatus, day: pendingDay });
  };

  const clearAllFilters = () => {
    setManualSelectedIds([]);
    setFilteredContactIds([]);
    setFilterExplanation('');
    setPendingInstrument('');
    setPendingService('');
    setPendingInstructor('');
    setPendingStatus('');
    setPendingDay('');
    setAppliedFilters({ instrument: '', service: '', instructor: '', status: '', day: '' });
  };

  const handleAiFilter = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch('/api/ai-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery }),
      });
      const data = await response.json();
      if (data.contact_ids) {
        setManualSelectedIds([]);
        setFilteredContactIds(data.contact_ids);
        setFilterExplanation(data.explanation || '');
        setIsAIModalOpen(false);
        setAiQuery('');
        setAppliedFilters({ instrument: '', service: '', instructor: '', status: '', day: '' });
        setPendingInstrument(''); setPendingService(''); setPendingInstructor(''); setPendingStatus(''); setPendingDay('');
      }
    } catch (error) {
      console.error('AI filter error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const sel: React.CSSProperties = {
    border: '1px solid #E8E2DA', borderRadius: '8px', padding: '8px 12px',
    fontSize: '13px', background: 'white', color: '#2C1F18', cursor: 'pointer',
    fontFamily: 'var(--font-dm-sans), sans-serif', outline: 'none',
  };

  return (
    <AppShell pageTitle="Start a Campaign">

      {/* Filter bar */}
      <div style={{ background: 'white', border: '1px solid #E8E2DA', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <select value={pendingInstrument} onChange={e => setPendingInstrument(e.target.value)} style={sel}>
          <option value="">Instrument</option>
          {instruments.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={pendingService} onChange={e => setPendingService(e.target.value)} style={sel}>
          <option value="">Service</option>
          <option value="private">Private</option>
          <option value="group">Group</option>
          <option value="band">Band</option>
          <option value="semi-private">Semi-private</option>
        </select>
        <select value={pendingInstructor} onChange={e => setPendingInstructor(e.target.value)} style={sel}>
          <option value="">Instructor</option>
          {instructors.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={pendingStatus} onChange={e => setPendingStatus(e.target.value)} style={sel}>
          <option value="">Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="member">Member</option>
        </select>
        <select value={pendingDay} onChange={e => setPendingDay(e.target.value)} style={sel}>
          <option value="">Lesson day</option>
          {days.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <button onClick={applyFilters} style={{ background: '#FF0044', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          Apply
        </button>
        {(hasStandardFilters || filterExplanation) && (
          <button onClick={clearAllFilters} style={{ background: 'transparent', border: '1px solid #E8E2DA', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#7A6860', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            <X size={13} /> Clear
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setIsAIModalOpen(true)} style={{ background: 'rgba(0,168,200,0.16)', color: '#006E84', border: '1px solid #00A8C8', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          <Sparkles size={14} /> Ask Odeon
        </button>
      </div>

      {/* AI filter explanation banner */}
      {filterExplanation && (
        <div style={{ background: 'rgba(0,168,200,0.16)', border: '1px solid #00A8C8', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#006E84', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✦ {filterExplanation}</span>
          <button onClick={clearAllFilters} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#006E84' }}><X size={14} /></button>
        </div>
      )}

      {/* Table header with CTAs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: '#7A6860' }}>
          {activeCount > 0 ? <span style={{ color: '#FF0044', fontWeight: 500 }}>{activeCount} contacts selected</span> : `${contacts.length} contacts`}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setComposeChannel('sms'); setIsComposeOpen(true); }} disabled={activeCount === 0}
            style={{ background: activeCount > 0 ? '#FF0044' : '#E8E2DA', color: activeCount > 0 ? 'white' : '#AAAAAA', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: activeCount > 0 ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            New SMS{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <button onClick={() => { setComposeChannel('email'); setIsComposeOpen(true); }} disabled={activeCount === 0}
            style={{ background: 'transparent', color: activeCount > 0 ? '#FF0044' : '#AAAAAA', border: `1px solid ${activeCount > 0 ? '#FF0044' : '#E8E2DA'}`, borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: activeCount > 0 ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            New Email{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>

      {/* Contact list */}
      <ContactList
        selectedContactIds={displayIds}
        onContactsLoaded={setContacts}
        onSelectionChange={filterActive ? undefined : setManualSelectedIds}
      />

      {/* AI Modal */}
      {isAIModalOpen && (
        <>
          <div onClick={() => setIsAIModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: '16px', width: '520px', zIndex: 50, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Ask Odeon</h2>
                <p style={{ fontSize: '13px', color: '#7A6860', margin: '4px 0 0' }}>Describe who you want to reach</p>
              </div>
              <button onClick={() => setIsAIModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7A6860' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: '#AAAAAA', margin: '0 0 6px' }}>Try asking:</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: '#AAAAAA', lineHeight: 1.8 }}>
                  <li>Bass players on Tuesday</li>
                  <li>Josh's students who haven't attended in 2 weeks</li>
                  <li>All group students</li>
                  <li>Active guitar students with Bridget</li>
                </ul>
              </div>
              <textarea
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiFilter()}
                placeholder="e.g. All Wednesday drum students with Josh who haven't attended in 2 weeks"
                style={{ width: '100%', height: '80px', border: '1px solid #E8E2DA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'var(--font-dm-sans), sans-serif', resize: 'none', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', color: '#AAAAAA' }}>~$0.003 per search</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsAIModalOpen(false)} style={{ background: 'transparent', border: '1px solid #E8E2DA', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: '#7A6860', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Cancel</button>
                  <button onClick={handleAiFilter} disabled={aiLoading || !aiQuery.trim()} style={{ background: aiLoading || !aiQuery.trim() ? 'rgba(255,0,68,0.30)' : '#FF0044', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: aiLoading || !aiQuery.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} />
                    {aiLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Compose slide panel */}
      {isComposeOpen && (
        <>
          <div onClick={() => setIsComposeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: '480px', background: 'white', zIndex: 50, boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>New {composeChannel === 'sms' ? 'SMS' : 'Email'} Campaign</h2>
              <button onClick={() => setIsComposeOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#7A6860' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ComposePanel
                recipientCount={activeCount}
                filterExplanation={filterExplanation}
                recipientIds={recipientIds}
                channel={composeChannel}
                onClose={() => setIsComposeOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}