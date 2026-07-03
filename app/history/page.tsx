import AppShell from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';

export default function HistoryPage() {
  // Mock data for now
  const campaigns = [
    { id: 1, name: 'Lesson Reminders', channel: 'sms', recipients: 47, sent_at: '2023-10-26T10:00:00Z', status: 'sent' },
    { id: 2, name: 'Recital Announcement', channel: 'sms', recipients: 124, sent_at: '2023-10-24T14:30:00Z', status: 'sent' },
    { id: 3, name: 'Holiday Schedule', channel: 'sms', recipients: 112, sent_at: '2023-10-22T18:00:00Z', status: 'failed' },
  ];

  return (
    <AppShell pageTitle="History">
        <div className="bg-surface rounded-lg shadow-sm">
            <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Campaign History</h2>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-bg text-text-secondary">
                    <tr>
                        <th className="px-4 py-3 font-medium">Campaign</th>
                        <th className="px-4 py-3 font-medium">Channel</th>
                        <th className="px-4 py-3 font-medium">Recipients</th>
                        <th className="px-4 py-3 font-medium">Sent At</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b border-border hover:bg-bg">
                            <td className="px-4 py-3">{campaign.name}</td>
                            <td className="px-4 py-3"><Badge variant="secondary">{campaign.channel.toUpperCase()}</Badge></td>
                            <td className="px-4 py-3">{campaign.recipients}</td>
                            <td className="px-4 py-3">{new Date(campaign.sent_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                                <Badge variant={campaign.status === 'sent' ? 'default' : 'destructive'}>
                                    {campaign.status}
                                </Badge>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </AppShell>
  );
}
