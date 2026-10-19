'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { colors, radius, spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import type { CommunityPost, CommunityWorkspace } from '@/lib/community-posts'

export default function CommunityPage() {
  const [workspace, setWorkspace] = useState<CommunityWorkspace | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [filter, setFilter] = useState<CommunityPost['status']>('inbox')
  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/community-posts?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Workspace could not be loaded.')
      setWorkspace(data)
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Workspace unavailable.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function save(command: Record<string, unknown>) {
    if (!workspace || busy) return false
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/community-posts?tenant=${encodeURIComponent(getActiveTenantId())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, revision: workspace.revision }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Changes could not be saved.')
      setWorkspace(data)
      return true
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Save failed.'); return false }
    finally { setBusy(false) }
  }

  const featured = [...(workspace?.posts || [])].filter(post => post.homepage_order !== null).sort((a, b) => a.homepage_order! - b.homepage_order!)
  async function move(index: number, direction: number) {
    const ids = featured.map(post => post.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await save({ action: 'homepage', ids })
  }

  return <PageContainer maxWidth="1100px">
    <PageHeader title="Community posts" subtitle="Curate four homepage posts. Approval and homepage selection are separate." right={<Button variant="secondary" onClick={() => void load()} disabled={busy}>Reload</Button>} />
    <p style={{ color: colors.textSecondary }}>Manual curation only. Social imports and website synchronization are not connected yet. No media is scraped or downloaded.</p>
    {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
    {!workspace && !error && <p role="status">Loading community workspace…</p>}
    {workspace && <>
      <form onSubmit={async event => { event.preventDefault(); if (await save({ action: 'add', url })) { setUrl(''); setFilter('inbox') } }} style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', alignItems: 'end', marginBlock: spacing.lg }}>
        <div style={{ flex: '1 1 300px' }}><label htmlFor="community-url">Original post URL</label><Input id="community-url" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://www.instagram.com/p/…" disabled={busy} /></div>
        <Button type="submit" disabled={busy || !url.trim()}>Add to inbox</Button>
      </form>
      <section aria-labelledby="homepage-posts-title" style={{ marginBlock: spacing['2xl'] }}>
        <h2 id="homepage-posts-title">Homepage selection ({featured.length}/4)</h2>
        {!featured.length && <p>No featured posts. Approve candidates below, then select up to four.</p>}
        <ol style={{ paddingLeft: spacing.lg }}>
          {featured.map((post, index) => <li key={post.id} style={{ marginBottom: spacing.md }}>
            <a href={post.original_url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{post.platform} · {post.original_url}</a>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button size="sm" variant="secondary" disabled={busy || index === 0} aria-label={`Move ${post.platform} post ${index + 1} earlier`} onClick={() => void move(index, -1)}>Move earlier</Button>
              <Button size="sm" variant="secondary" disabled={busy || index === featured.length - 1} aria-label={`Move ${post.platform} post ${index + 1} later`} onClick={() => void move(index, 1)}>Move later</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save({ action: 'homepage', ids: featured.filter(item => item.id !== post.id).map(item => item.id) })}>Unfeature</Button>
            </div>
          </li>)}
        </ol>
      </section>
      <nav aria-label="Community post status" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        {(['inbox', 'approved', 'archived'] as const).map(status => <Button key={status} variant={filter === status ? 'primary' : 'secondary'} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status} ({workspace.posts.filter(post => post.status === status).length})</Button>)}
      </nav>
      <div style={{ display: 'grid', gap: spacing.lg }}>
        {workspace.posts.filter(post => post.status === filter).map(post => <PostReview key={`${post.id}-${workspace.revision}`} post={post} busy={busy} canFeature={featured.length < 4} onReview={(status, notes, confirmed) => save({ action: 'review', id: post.id, status, permission_notes: notes, permission_confirmed: confirmed })} onFeature={() => save({ action: 'homepage', ids: [...featured.map(item => item.id), post.id] })} />)}
        {!workspace.posts.some(post => post.status === filter) && <p>No posts in {filter}.</p>}
      </div>
    </>}
  </PageContainer>
}

function PostReview({ post, busy, canFeature, onReview, onFeature }: {
  post: CommunityPost; busy: boolean; canFeature: boolean
  onReview: (status: CommunityPost['status'], notes: string, confirmed: boolean) => Promise<boolean>
  onFeature: () => Promise<boolean>
}) {
  const [notes, setNotes] = useState(post.permission_notes)
  const [confirmed, setConfirmed] = useState(post.permission_confirmed)
  return <article style={{ padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface }}>
    <h3>{post.platform} · {post.status}</h3>
    <a href={post.original_url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{post.original_url}</a>
    <div style={{ marginBlock: spacing.md }}><label htmlFor={`notes-${post.id}`}>Permission and editorial review notes (staff-only)</label>
      <Input id={`notes-${post.id}`} value={notes} maxLength={4000} onChange={event => setNotes(event.target.value)} disabled={busy} />
    </div>
    <label style={{ display: 'flex', gap: spacing.sm, alignItems: 'start' }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />I confirmed permission to feature this post and reviewed any child/guardian approvals.</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
      <Button variant="secondary" disabled={busy} onClick={() => void onReview(post.status, notes, confirmed)}>Save review</Button>
      {post.status !== 'approved' && <Button disabled={busy || !confirmed || !notes.trim()} onClick={() => void onReview('approved', notes, confirmed)}>Approve</Button>}
      {post.status === 'approved' && post.homepage_order === null && <Button disabled={busy || !canFeature} onClick={() => void onFeature()}>Feature on homepage</Button>}
      {post.status !== 'archived' && <Button variant="ghost" disabled={busy} onClick={() => void onReview('archived', notes, confirmed)}>Archive</Button>}
      {post.status !== 'inbox' && <Button variant="ghost" disabled={busy} onClick={() => void onReview('inbox', notes, confirmed)}>Return to inbox</Button>}
    </div>
  </article>
}