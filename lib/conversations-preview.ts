/** Only the verified staging database gets a simulated mailbox; never production. */
export function isConversationEmailPreview(environment: { databaseUrl?: string; deployment?: string }) {
  return environment.deployment !== 'production'
    && environment.databaseUrl === 'https://xpnygavujqmzkdmcktdm.supabase.co'
}