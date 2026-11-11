import ContactsView from './ContactsView'

export type { Contact, ContactViews } from './ContactsView'

/** Route module stays prop-free; the view carries the sandbox sample props. */
export default function ContactsPage() {
  return <ContactsView />
}
