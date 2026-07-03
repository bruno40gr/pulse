export default function Topbar({ title }: { title: string }) {
    return (
      <header className="flex items-center h-12 px-8 bg-surface border-b border-border">
        <div className="flex items-center">
            <h1 className="font-display text-lg font-bold text-text-primary">{title}</h1>
        </div>
      </header>
    );
  }