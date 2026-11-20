import { normalizeTablePreferences, tablePreferenceKey } from './table-preferences'

export const CONVERSATION_COLUMN_IDS = ['name', 'time'] as const
export type ConversationColumnId = typeof CONVERSATION_COLUMN_IDS[number]

export const CONVERSATION_TABLE_SCHEMA = {
  columnIds: CONVERSATION_COLUMN_IDS,
  defaultColumns: ['name', 'time'],
  requiredColumns: ['name'],
  storagePrefix: 'pulse_conversations_table_v1',
  sortKeys: ['name', 'time'],
  defaultSort: { key: 'time', direction: 'desc' },
} as const

export function defaultConversationTablePreferences() {
  return normalizeTablePreferences(null, CONVERSATION_TABLE_SCHEMA)
}

export function conversationTablePreferenceKey(tenantId: string, membershipId: string) {
  return tablePreferenceKey(CONVERSATION_TABLE_SCHEMA, tenantId, membershipId)
}
