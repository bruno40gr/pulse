/* eslint-disable @typescript-eslint/no-require-imports -- Pure staging fixture helpers. */
const { createHash } = require('node:crypto')
const FIRST = ['Maya', 'Julian', 'Sofia', 'Elliot', 'Amara', 'Theo', 'Isabel', 'Nolan', 'Lucia', 'Felix', 'Naomi', 'Adrian', 'Clara', 'Mateo', 'Zoe', 'Darius']
const LAST = ['Bennett', 'Rivera', 'Chen', 'Okafor', 'Sullivan', 'Moretti', 'Patel', 'Reyes', 'Laurent', 'Brooks', 'Park', 'Delgado', 'Morgan', 'Alvarez', 'Nakamura', 'Haddad']
function fictionalName(value, kind = 'full_name') {
  if (typeof value !== 'string' || !value.trim()) return value
  const hash = createHash('sha256').update(value).digest()
  return kind === 'first_name' ? FIRST[hash[0] % FIRST.length] : kind === 'last_name' ? LAST[hash[1] % LAST.length] : `${FIRST[hash[0] % FIRST.length]} ${LAST[hash[1] % LAST.length]}`
}
function transformNames(value) {
  if (Array.isArray(value)) return value.map(transformNames)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ['first_name', 'last_name', 'full_name', 'student_name', 'parent_name', 'account_holder_name', 'actor_name', 'displayName'].includes(key)
      ? fictionalName(item, key) : transformNames(item),
  ]))
}
module.exports = { fictionalName, transformNames }