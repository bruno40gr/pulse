const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('sticky-note replies use the shared tenant-scoped avatar and retain author text', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../components/notes/NoteConversationPanel.tsx'), 'utf8')
  assert.ok(source.includes("import { Avatar } from '@/components/ui/Avatar'"))
  assert.ok(source.includes('src={getStaffAvatarUrl(tenantId, reply.created_by)}'))
  assert.ok(source.includes("firstName={reply.created_by?.trim().split(/\\s+/)[0] || 'Unknown'}"))
  assert.ok(source.includes("{reply.created_by || 'Unknown author'} · {formatTimestamp(reply.created_at)}"))
  assert.ok(source.includes('<MentionText body={reply.body} />'))
})