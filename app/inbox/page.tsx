import AppShell from '@/components/layout/AppShell';
import InboxThread from '@/components/inbox/InboxThread';

export default function InboxPage() {
  // This will be fetched from the API later
  const conversations = [
    { id: 1, name: 'John Doe', lastMessage: '👍', timestamp: '10:07 AM' },
    { id: 2, name: 'Jane Smith', lastMessage: 'See you there!', timestamp: 'Yesterday' },
  ];

  return (
    <AppShell pageTitle="Inbox">
      <div className="grid grid-cols-5 gap-8 h-full">
        {/* Left Panel: Conversation List */}
        <div className="col-span-2 bg-surface rounded-lg shadow-sm">
            <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Conversations</h2>
            </div>
            <ul className="divide-y divide-border">
                {conversations.map(convo => (
                    <li key={convo.id} className="p-4 hover:bg-bg cursor-pointer">
                        <div className="flex justify-between">
                            <h3 className="font-semibold">{convo.name}</h3>
                            <time className="text-xs text-text-muted">{convo.timestamp}</time>
                        </div>
                        <p className="text-sm text-text-secondary truncate">{convo.lastMessage}</p>
                    </li>
                ))}
            </ul>
        </div>

        {/* Right Panel: Message Thread */}
        <div className="col-span-3">
          <InboxThread />
        </div>
      </div>
    </AppShell>
  );
}
