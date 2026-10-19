export async function googleToken(parameters: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...parameters, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }),
    signal: AbortSignal.timeout(15000), cache: 'no-store',
  })
  if (!response.ok) throw new Error('Google authorization failed. Reconnect the mailbox.')
  const result = await response.json()
  if (!result.access_token) throw new Error('Google did not return mailbox access.')
  return result
}
export async function gmailGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: 'no-store',
  })
  if (!response.ok) throw new Error('Gmail could not be read. Check the connection and try again.')
  return response.json()
}