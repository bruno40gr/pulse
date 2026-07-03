"use client";

// Mock data for now
const messages = [
  { id: 1, direction: 'outbound', body: 'Hi {first_name}, a reminder about your lesson tomorrow at 4pm.', created_at: '2023-10-26T10:00:00Z' },
  { id: 2, direction: 'inbound', body: 'Thanks for the reminder!', created_at: '2023-10-26T10:05:00Z' },
  { id: 3, direction: 'outbound', body: 'See you then!', created_at: '2023-10-26T10:06:00Z' },
  { id: 4, direction: 'inbound', body: '👍', created_at: '2023-10-26T10:07:00Z' },
];

export default function InboxThread() {
  const contactName = "John Doe"; // This will be dynamic

  return (
    <div className="flex flex-col h-full bg-surface rounded-lg shadow-sm">
        <div className="p-4 border-b border-border">
            <h2 className="font-semibold">{contactName}</h2>
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((message) => (
                <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl max-w-sm ${message.direction === 'outbound' ? 'bg-accent text-white' : 'bg-gray-200 text-text-primary'}`}>
                        {message.body.replace('{first_name}', 'John')}
                    </div>
                </div>
            ))}
        </div>
        <div className="p-4 bg-bg border-t border-border">
            {/* A reply box could go here in a future version */}
            <p className="text-sm text-text-muted text-center">Replying is not supported yet.</p>
        </div>
    </div>
  );
}