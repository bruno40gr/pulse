import AppShell from '@/components/layout/AppShell';
import ContactList from '@/components/contacts/ContactList';

export default function ContactsPage() {
  return (
    <AppShell pageTitle="Contacts">
      <ContactList />
    </AppShell>
  );
}