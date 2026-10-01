import { normalizePhoneNumber } from '@/lib/phone'

export interface CampaignMessageAttributionInput {
  id: string
  campaign_id: string | null
  contact_id?: string | null
  direction: string
  to_phone?: string | null
  from_phone?: string | null
  created_at: string
}

function getConversationKey(message: CampaignMessageAttributionInput) {
  const phone = normalizePhoneNumber(message.direction === 'outbound' ? message.to_phone : message.from_phone)
  if (phone) return `phone:${phone}`
  return message.contact_id ? `contact:${message.contact_id}` : null
}

export function attributeInboundMessagesToCampaigns<T extends CampaignMessageAttributionInput>(messages: T[]) {
  const latestCampaignByConversation = new Map<string, string>()
  const campaignByMessageId = new Map<string, string>()
  const chronological = [...messages].sort((a, b) => {
    const timeDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return timeDifference || a.id.localeCompare(b.id)
  })

  for (const message of chronological) {
    const conversationKey = getConversationKey(message)

    if (message.direction === 'outbound' && conversationKey) {
      if (message.campaign_id) latestCampaignByConversation.set(conversationKey, message.campaign_id)
      else latestCampaignByConversation.delete(conversationKey)
      continue
    }

    if (message.direction !== 'inbound') continue
    const campaignId = message.campaign_id || (conversationKey ? latestCampaignByConversation.get(conversationKey) : null)
    if (campaignId) campaignByMessageId.set(message.id, campaignId)
  }

  return campaignByMessageId
}