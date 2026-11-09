'use client'

import { Phone } from 'lucide-react'
import { DenseSectionPanel, FieldLabel, FieldValue } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, radius, spacing } from '@/lib/tokens'
import { formatPhoneNumber } from '@/lib/phone'
import { useIsMobile } from '@/lib/useMediaQuery'

export type ContactAccountManager = { name: string | null; phone: string | null; email: string | null; relationship: string | null; is_primary: boolean }
export function AccountManagersPanel({ accountHolders, onCall, calling = false }: { accountHolders: ContactAccountManager[]; onCall?: (phone: string) => void; calling?: boolean }) {
  const isMobile = useIsMobile()
  const cleanName = (name: string | null) => name?.replace(' (account)', '').trim() || null
  const getInitials = (name: string | null) => name?.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || '?'
  const displayPhone = formatPhoneNumber
  return <DenseSectionPanel
              title="Account managers"
              style={{ marginBottom: spacing.lg }}
              contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {accountHolders.map((ah, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: 'stretch',
                      gap: spacing.md,
                      padding: '12px 14px',
                      background: colors.surface,
                      borderRadius: radius.lg,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: isMobile ? '36px' : '42px',
                        height: isMobile ? '36px' : undefined,
                        minHeight: isMobile ? '36px' : '72px',
                        background: '#EEF1F1',
                        color: '#6B7280',
                        borderRadius: radius.lg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(ah.name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'baseline', justifyContent: 'space-between', gap: isMobile ? '4px' : '12px', minWidth: 0 }}>
                        <FieldValue>
                          {cleanName(ah.name) || '—'}
                        </FieldValue>
                        {ah.relationship && (
                          <FieldLabel style={{ flexShrink: 0 }}>
                            {ah.relationship}
                          </FieldLabel>
                        )}
                      </div>
                      {!ah.is_primary && <FieldLabel>Additional account manager</FieldLabel>}
                      {(ah.phone || ah.email) && (
                        <FieldValue style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: isMobile ? '6px' : '12px' }}>
                          {ah.phone ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, minWidth: 0 }}>
                              <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{displayPhone(ah.phone)}</span>
                              <ControlButton kind="icon"
                                type="button"
                                onClick={() => ah.phone && onCall?.(ah.phone)}
                                disabled={calling || !onCall}
                                aria-label={`Call ${cleanName(ah.name) || 'account holder'}`}
                                title={`Call ${displayPhone(ah.phone)}`}
                                style={{ flexShrink: 0 }}
                              >
                                <Phone size={14} strokeWidth={1.8} />
                              </ControlButton>
                            </span>
                          ) : <span style={{ color: colors.textMuted }}>—</span>}
                          {ah.email ? <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{ah.email}</span> : <span style={{ color: colors.textMuted }}>—</span>}
                        </FieldValue>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DenseSectionPanel>
}
