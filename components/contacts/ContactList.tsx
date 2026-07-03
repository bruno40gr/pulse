"use client";

import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import CSVImporter from './CSVImporter';
import { UploadCloud } from 'lucide-react';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  instrument: string | null;
  service_type: string | null;
  lesson_day: string | null;
  lesson_time: string | null;
  instructor: string | null;
  client_status: string;
  last_attended: string | null;
  opted_out: boolean;
}

interface ContactListProps {
  selectedContactIds?: string[];
  onContactsLoaded?: (contacts: any[]) => void;
  onSelectionChange?: (ids: string[]) => void;
}

export default function ContactList({ selectedContactIds = [], onContactsLoaded, onSelectionChange }: ContactListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());

  const filterActive = selectedContactIds.length > 0;
  const displayContacts = filterActive
    ? contacts.filter(c => selectedContactIds.includes(c.id))
    : contacts;

  const isChecked = (id: string) => {
    if (filterActive) return selectedContactIds.includes(id);
    return manualSelection.has(id);
  };

  const toggleContact = (id: string) => {
    if (filterActive) return;
    const next = new Set(manualSelection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setManualSelection(next);
    onSelectionChange?.([...next]);
  };

  const toggleAll = () => {
    if (filterActive) return;
    if (manualSelection.size === displayContacts.length) {
      setManualSelection(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(displayContacts.map(c => c.id));
      setManualSelection(all);
      onSelectionChange?.([...all]);
    }
  };

  const allChecked = !filterActive && manualSelection.size === displayContacts.length && displayContacts.length > 0;

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/contacts');
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data);
      onContactsLoaded?.(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // When filter changes, notify parent of new selection
  useEffect(() => {
    if (filterActive) {
      onSelectionChange?.(selectedContactIds);
      setManualSelection(new Set());
    }
  }, [selectedContactIds.join(',')]);

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8E2DA' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E2DA' }}>
          <div style={{ height: '20px', background: '#FAF6F0', borderRadius: '4px', width: '200px' }} />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid #FAF6F0', display: 'flex', gap: '16px' }}>
            <div style={{ height: '14px', background: '#FAF6F0', borderRadius: '4px', width: '150px' }} />
            <div style={{ height: '14px', background: '#FAF6F0', borderRadius: '4px', width: '120px' }} />
            <div style={{ height: '14px', background: '#FAF6F0', borderRadius: '4px', width: '180px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#DC2626', padding: '16px' }}>Error: {error}</div>;
  }

  if (contacts.length === 0) {
    return (
      <>
        <EmptyState
          icon={UploadCloud}
          title="No contacts yet"
          description="Get started by importing your contacts from an Opus CSV export."
          action={
            <button
              onClick={() => setIsImporterOpen(true)}
              style={{ backgroundColor: '#FF0044', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', border: 'none' }}
            >
              Import CSV
            </button>
          }
        />
        <CSVImporter
          isOpen={isImporterOpen}
          onClose={() => setIsImporterOpen(false)}
          onImportComplete={() => { setIsImporterOpen(false); fetchContacts(); }}
        />
      </>
    );
  }

  return (
    <>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8E2DA', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAF6F0', color: '#7A6860' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    style={{ cursor: filterActive ? 'default' : 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Name</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Phone</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Email</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Instrument</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Service</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Lesson Day/Time</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Instructor</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayContacts.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => toggleContact(contact.id)}
                  style={{
                    borderBottom: '1px solid #FAF6F0',
                    background: isChecked(contact.id) ? 'rgba(255,0,68,0.15)' : 'white',
                    transition: 'background 0.1s',
                    cursor: filterActive ? 'default' : 'pointer',
                  }}
                >
                  <td style={{ padding: '10px 16px' }}>
                    <input
                      type="checkbox"
                      checked={isChecked(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: filterActive ? 'default' : 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{contact.first_name} {contact.last_name}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: '12px' }}>{contact.phone || '–'}</td>
                  <td style={{ padding: '10px 16px', color: '#7A6860' }}>{contact.email || '–'}</td>
                  <td style={{ padding: '10px 16px' }}>{contact.instrument || '–'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {contact.service_type ? (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        background: contact.service_type === 'group' ? '#DCF0E4' : 'rgba(0,168,200,0.16)',
                        color: contact.service_type === 'group' ? '#1F5C3A' : '#006E84',
                      }}>
                        {contact.service_type}
                      </span>
                    ) : '–'}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#7A6860' }}>{contact.lesson_day || '–'} {contact.lesson_time || ''}</td>
                  <td style={{ padding: '10px 16px', color: '#7A6860' }}>{contact.instructor || '–'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: contact.client_status === 'active' ? '#DCF0E4' : '#FAF6F0',
                      color: contact.client_status === 'active' ? '#3D8B5F' : '#7A6860',
                    }}>
                      {contact.client_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <CSVImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportComplete={() => { setIsImporterOpen(false); fetchContacts(); }}
      />
    </>
  );
}