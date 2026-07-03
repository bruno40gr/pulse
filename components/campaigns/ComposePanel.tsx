"use client";

import { useState, useEffect } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

interface ComposePanelProps {
    recipientCount: number;
    filterExplanation: string;
    recipientIds: string[];
    channel?: 'sms' | 'email';
    onClose?: () => void;
}

export default function ComposePanel({ recipientCount, filterExplanation, recipientIds, channel = 'sms', onClose }: ComposePanelProps) {
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isMMS = !!mediaUrl;
  const costPerMessage = isMMS ? 0.02 : 0.0083;
  const estimatedCost = (recipientCount * costPerMessage).toFixed(2);
  const previewMessage = message.replace('{first_name}', 'Alex') || 'Your message...';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (message && recipientCount > 0 && !isSending) handleSend();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [message, recipientCount, isSending]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const campaignResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          message,
          media_url: mediaUrl || null,
          filter_query: filterExplanation,
          recipient_count: recipientCount,
        }),
      });
      if (!campaignResponse.ok) throw new Error('Failed to create campaign');
      const campaign = await campaignResponse.json();

      const sendResponse = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIds }),
      });
      if (!sendResponse.ok) throw new Error('Failed to send campaign');

      setSent(true);
      setMessage('');
      setMediaUrl('');
      setTimeout(() => { setSent(false); onClose?.(); }, 2000);
    } catch (error) {
      console.error('Error sending campaign:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
        <div style={{ fontSize: '48px' }}>✓</div>
        <p style={{ fontSize: '16px', fontWeight: 500, color: '#3D8B5F' }}>Campaign sent!</p>
        <p style={{ fontSize: '13px', color: '#7A6860' }}>{recipientCount} messages sent</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', gap: '16px' }}>

      {/* Recipient summary */}
      <div style={{ background: 'rgba(0,168,200,0.16)', borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ fontSize: '13px', color: '#006E84', fontWeight: 500 }}>
          Sending to {recipientCount} contacts
        </div>
        {filterExplanation && (
          <div style={{ fontSize: '12px', color: '#00A8C8', marginTop: '4px' }}>{filterExplanation}</div>
        )}
        {recipientCount === 0 && (
          <div style={{ fontSize: '12px', color: '#AAAAAA', marginTop: '4px' }}>Use the AI filter or select contacts to get started</div>
        )}
      </div>

      {/* Message textarea */}
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Write your ${channel === 'sms' ? 'SMS' : 'email'} message... Use {first_name} for personalization.`}
          style={{
            width: '100%',
            height: '120px',
            border: '1px solid #E8E2DA',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            color: '#2C1F18',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.6,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#AAAAAA' }}>
          <button
            onClick={() => setShowMediaInput(!showMediaInput)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#7A6860', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            <Paperclip size={13} /> {isMMS ? 'Media attached' : 'Attach media (MMS)'}
          </button>
          <span>{isMMS ? 'MMS · media attached' : `${message.length} / 160 chars`}</span>
        </div>
      </div>

      {/* Media URL input */}
      {showMediaInput && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Paste Cloudinary or image URL..."
            style={{
              flex: 1,
              border: '1px solid #E8E2DA',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              outline: 'none',
            }}
          />
          {mediaUrl && (
            <button onClick={() => setMediaUrl('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7A6860' }}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Preview */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: '#AAAAAA', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</div>
        <div style={{ background: '#FAF6F0', borderRadius: '12px', padding: '16px' }}>
          {mediaUrl && (
            <img src={mediaUrl} alt="MMS preview" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />
          )}
          <div style={{
            background: '#FF0044',
            color: 'white',
            borderRadius: '16px 16px 4px 16px',
            padding: '10px 14px',
            fontSize: '13px',
            lineHeight: 1.5,
            maxWidth: '85%',
            display: 'inline-block',
          }}>
            {previewMessage}
          </div>
          <div style={{ fontSize: '11px', color: '#AAAAAA', marginTop: '8px' }}>Reply STOP to unsubscribe</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid #E8E2DA', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#AAAAAA' }}>
          {recipientCount} {channel.toUpperCase()} · ~${estimatedCost}
        </span>
        <button
          onClick={handleSend}
          disabled={!message || recipientCount === 0 || isSending}
          style={{
            background: !message || recipientCount === 0 || isSending ? 'rgba(255,0,68,0.30)' : '#FF0044',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: !message || recipientCount === 0 || isSending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          <Send size={14} />
          {isSending ? 'Sending...' : 'Send Now'}
        </button>
      </div>
    </div>
  );
}