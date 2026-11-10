'use client'

import { useState } from 'react'
import ContactsPage from '/Users/brunowong/pulse/app/dashboard/contacts/page'
import { ContactNameOpenContext } from '/Users/brunowong/pulse/components/contacts/ContactPrototypeContext'
import StudentWorkspaceV3 from '/Users/brunowong/pulse-odeon-integration/app/content-studio-prototype/students/StudentWorkspaceV3'
import { createDemoWorkspace } from '/Users/brunowong/pulse-odeon-integration/lib/odeon-demo-workspace'

export default function PublishedContactsWithV3() {
  const [snapshot] = useState(createDemoWorkspace)
  return <StudentWorkspaceV3 initialData={snapshot.data} initialMakeups={snapshot.makeups}
    renderContacts={({ data, onOpen }) => <ContactNameOpenContext.Provider value={id => {
      const account = data.accounts.find(item => item.holderId === id || item.studentIds.includes(id))
      if (!account) return false
      onOpen(account.id, id === account.holderId ? undefined : id)
      return true
    }}><ContactsPage /></ContactNameOpenContext.Provider>}
  />
}