import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({
  children,
  pageTitle,
}: {
  children: React.ReactNode;
  pageTitle: string;
}) {
  return (
    <div className="h-screen bg-bg">
      <Sidebar />
      <div className="ml-[220px]">
        <Topbar title={pageTitle} />
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}