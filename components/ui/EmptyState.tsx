import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-surface rounded-lg">
      <div className="flex items-center justify-center w-16 h-16 mb-4 bg-accent-light rounded-full">
        <Icon className="w-8 h-8 text-accent" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="max-w-sm mt-2 text-sm text-text-secondary">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}