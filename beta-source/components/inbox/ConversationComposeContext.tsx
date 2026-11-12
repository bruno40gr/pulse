'use client'

import { createContext } from 'react'
import type { ConversationChannel } from '@/beta-source/lib/conversation-links'

/** In-conversation profile actions return to the existing composer. */
export const ConversationComposeContext = createContext<((channel: ConversationChannel) => void) | null>(null)