/** Synthetic fixtures and local-only interactions. Never import a messaging client here. */
export type PrototypeChannel = 'sms' | 'email'
export type PrototypeMessage = {
  id: string
  channel: PrototypeChannel
  direction: 'inbound' | 'outbound'
  body: string
  time: string
  timestamp?: string
  subject?: string
  unread?: boolean
  html?: string
  simulated?: boolean
  emailTo?: string[]
  emailCc?: string[]
}
export type PrototypeThread = {
  id: string
  contactId: string
  channel: PrototypeChannel
  subject?: string
  name: string
  student: string
  initials: string
  email: string
  phone: string
  stage: string
  interest: string
  nextAction: string
  note: string
  unread: boolean
  messages: PrototypeMessage[]
}

export const PROTOTYPE_EMAIL = 'admin@headlinermusicacademy.com'
export const PROTOTYPE_PHONE = '(202) 555-0100'
export function createPrototypeThreads(): PrototypeThread[] {
  const pastSms = (id: string, daysAgo: number, direction: 'inbound' | 'outbound', body: string): PrototypeMessage => {
    const day = new Date()
    day.setDate(day.getDate() - daysAgo)
    day.setHours(15, 0, 0, 0)
    return { id, channel: 'sms', direction, body, unread: false,
      time: `${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · 3:00 PM`,
      timestamp: new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 19) }
  }
  const threads: PrototypeThread[] = [
    {
      id: 'chen-sms', contactId: 'chen', channel: 'sms', name: 'Alex Chen', student: 'Jamie Chen', initials: 'AC', email: 'alex.chen@example.com', phone: '(202) 555-0101',
      stage: 'Contacted', interest: 'Piano · Beginner · Age 9', nextAction: 'Share afternoon lesson options',
      note: 'Jamie is excited about piano. Family prefers weekday afternoons.', unread: true,
      messages: [
        pastSms('chen-sms-week3-out', 21, 'outbound', 'Hi Alex! This is Headliner. Happy to help you explore piano lessons for Jamie. Is texting a good way to reach you?'),
        pastSms('chen-sms-week3-in', 21, 'inbound', 'Hi! Yes, texting works well. Jamie has been playing songs on our keyboard and would love to learn more.'),
        pastSms('chen-sms-week2-out', 14, 'outbound', 'A keyboard is a great starting point. Are weekday afternoons still best for your family?'),
        pastSms('chen-sms-week2-in', 14, 'inbound', 'Yes, after school is best. We are checking our schedule and will get back to you.'),
        pastSms('chen-sms-week1-out', 7, 'outbound', 'Hi Alex, just checking in about Jamie’s piano lessons. Let us know when you have a better idea of your availability.'),
        pastSms('chen-sms-week1-in', 7, 'inbound', 'Thanks for following up! We should know next week. Could you email me a little more about the lessons too?'),
        { id: 'chen-3', channel: 'sms', direction: 'inbound', body: 'Thanks for the email! Tuesdays or Thursdays after 3 would be great. You can text me here too.', time: 'Today · 10:42 AM' },
      ],
    },
    {
      id: 'chen-email', contactId: 'chen', channel: 'email', subject: 'Piano lessons for Jamie', name: 'Alex Chen', student: 'Jamie Chen', initials: 'AC', email: 'alex.chen@example.com', phone: '(202) 555-0101',
      stage: 'Contacted', interest: 'Piano · Beginner · Age 9', nextAction: 'Share afternoon lesson options', note: 'Jamie is excited about piano. Family prefers weekday afternoons.', unread: false,
      messages: [
        { id: 'chen-1', channel: 'email', direction: 'inbound', subject: 'Piano lessons for Jamie', body: 'Hi! We are looking for beginner piano lessons for our nine-year-old, Jamie. Do you have any afternoon openings?', time: 'Yesterday · 2:10 PM' },
        { id: 'chen-2', channel: 'email', direction: 'outbound', subject: 'Re: Piano lessons for Jamie', body: 'Hi Alex! We would love to help Jamie get started. Are there particular weekdays that work best for your family?', time: 'Yesterday · 2:24 PM' },
      ],
    },
    {
      id: 'rivera', contactId: 'rivera', channel: 'sms', name: 'Morgan Rivera', student: 'Sam Rivera', initials: 'MR', email: 'morgan.rivera@example.com', phone: '(202) 555-0102',
      stage: 'New', interest: 'Guitar · Teen beginner', nextAction: 'Answer equipment question', note: 'Family asked about starting with an acoustic guitar. No instrument purchased yet.', unread: true,
      messages: [{ id: 'rivera-1', channel: 'sms', direction: 'inbound', body: 'Hello! Does Sam need to own a guitar before the first lesson, or can we try one at the academy?', time: 'Today · 10:18 AM' }],
    },
    {
      id: 'patel', contactId: 'patel', channel: 'email', subject: 'Voice lesson information', name: 'Taylor Patel', student: 'Avery Patel', initials: 'TP', email: 'taylor.patel@example.com', phone: '(202) 555-0103',
      stage: 'Contacted', interest: 'Voice · After-school lessons', nextAction: 'Wait for family availability', note: 'Interested in building confidence before a school performance.', unread: false,
      messages: [
        { id: 'patel-1', channel: 'email', direction: 'inbound', subject: 'Voice lesson information', body: 'Could you share a little more about voice lessons for Avery? We are mainly looking for confidence and a fun experience.', time: 'Today · 9:05 AM' },
        { id: 'patel-2', channel: 'email', direction: 'outbound', subject: 'Re: Voice lesson information', body: 'Absolutely! Lessons can focus on confidence, healthy technique, and songs Avery enjoys. What afternoons might work for your family?', time: 'Today · 9:22 AM' },
      ],
    },
    {
      id: 'brooks', contactId: 'brooks', channel: 'sms', name: 'Jordan Brooks', student: 'Casey Brooks', initials: 'JB', email: 'jordan.brooks@example.com', phone: '(202) 555-0104',
      stage: 'Booked', interest: 'Drums · Introductory lesson', nextAction: 'No reply needed', note: 'Booking confirmations are managed by Opus, not this composer.', unread: false,
      messages: [
        { id: 'brooks-1', channel: 'sms', direction: 'outbound', body: 'Hi Jordan! Let us know if you have any questions before Casey gets started.', time: 'Yesterday · 11:40 AM' },
        { id: 'brooks-2', channel: 'sms', direction: 'inbound', body: 'We received the confirmation from Opus. Thank you—Casey is looking forward to it!', time: 'Yesterday · 12:02 PM' },
      ],
    },
  ]
  const bodies: Record<string, string> = {
    'chen-1': 'Hi Headliner team,\n\nWe are looking for beginner piano lessons for our nine-year-old, Jamie. Jamie has been picking out songs on our keyboard at home and would love to learn with a teacher who can make the first few months encouraging and fun.\n\nTuesday or Thursday afternoons after 3 would be easiest for us. Could you tell us a little about how lessons work, whether a keyboard is enough for home practice, and what we should expect at the first visit?\n\nThanks so much,\nAlex Chen',
    'chen-2': 'Hi Alex,\n\nThank you for telling us about Jamie! Beginner lessons balance simple technique, listening, and songs students enjoy. A keyboard is absolutely fine to get started, and the teacher can help you plan a manageable practice routine.\n\nWe can explore Tuesday and Thursday afternoons with you. Before we suggest a time, could you let us know whether Jamie has taken any lessons before and how soon you would like to begin? We will help you find a good fit without rushing the decision.',
    'patel-1': 'Hi Headliner team,\n\nI am writing about voice lessons for Avery. There is a school performance coming up later in the year, and Avery would like to feel more comfortable singing in front of other people. We are looking for an encouraging environment rather than exam preparation.\n\nCould you share how you approach lessons for a beginner, and whether students can work on songs they already know? Monday and Wednesday afternoons would be our first choices, but we can be a little flexible.\n\nMany thanks,\nTaylor Patel',
    'patel-2': 'Hi Taylor,\n\nThat sounds like a lovely reason to start. Our teachers can focus on confidence, healthy vocal habits, and finding songs Avery genuinely enjoys. The pace can be gentle, with plenty of room to ask questions and build comfort over time.\n\nWe would love to learn a little more about Avery’s age and any previous singing experience. Once we have that context, we can explore an appropriate teacher and afternoon options with you. There is no need to prepare a performance before getting in touch again.',
  }
  for (const thread of threads) {
    thread.messages = thread.messages.map(message => ({ ...message, body: bodies[message.id] || message.body,
      unread: message.unread ?? (thread.unread && message.direction === 'inbound'),
    }))
  }
  const chenEmail = threads[1]
  chenEmail.unread = true
  chenEmail.messages.push({ id: 'chen-4', channel: 'email', direction: 'inbound', unread: true, time: 'Today · 10:35 AM',
    body: 'Hi again,\n\nThanks for such a helpful explanation. Jamie has not had formal lessons before, but is very excited to learn a few favorite movie songs. Our keyboard has full-size keys, so it is reassuring to hear that we can start with what we already have.\n\nWe would like to begin sometime next month. Tuesdays would be our first choice, with Thursdays as a backup. Could you let us know what the next step would be and whether we should bring anything along?\n\nBest,\nAlex Chen' })
  threads.splice(2, 0, { ...chenEmail, id: 'chen-welcome', subject: 'Getting to know Headliner', unread: false,
    messages: [{ id: 'chen-welcome-1', channel: 'email', direction: 'outbound', time: 'Monday · 9:00 AM',
      body: 'Hi Alex,\n\nWelcome to Headliner! We are glad you are exploring music lessons for Jamie. Our academy offers individual lessons with teachers who take time to understand each student’s interests, goals, and learning style.\n\nYou do not need to have everything figured out before the first conversation. Tell us what Jamie enjoys, what your week looks like, and any questions you have about getting started. We can help you work through the options together.' }] })
  const today = new Date()
  for (const thread of threads) for (const message of thread.messages) {
    if (message.timestamp) continue
    const day = new Date(today)
    if (message.time.startsWith('Yesterday')) day.setDate(day.getDate() - 1)
    if (message.time.startsWith('Monday')) day.setDate(day.getDate() - ((day.getDay() + 6) % 7 || 7))
    const clock = message.time.match(/(\d+):(\d+) (AM|PM)/)
    const hours = clock ? Number(clock[1]) % 12 + (clock[3] === 'PM' ? 12 : 0) : 0
    message.timestamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${clock?.[2] || '00'}:00`
  }
  return threads

}

/** Explicit fixture contact identity, never guessed from a shared email address. */
export function groupPrototypeContacts(threads: PrototypeThread[]) {
  const ids = [...new Set(threads.map(thread => thread.contactId))]
  return ids.map(id => {
    const history = threads.filter(thread => thread.contactId === id)
    const latest = history[0]
    const unreadCount = (channel: PrototypeChannel) => history.filter(thread => thread.channel === channel).reduce((count, thread) => count + thread.messages.filter(message => message.direction === 'inbound' && message.unread).length, 0)
    return { ...latest, id, threads: history, newSms: unreadCount('sms'), newEmails: unreadCount('email') }
  })
}

export function appendPrototypeMessage(thread: PrototypeThread, body: string, html?: string): PrototypeThread {
  if (!body.trim()) return thread
  return { ...thread, unread: false, messages: [...thread.messages, {
    id: `mock-${thread.id}-${thread.messages.length}`, channel: thread.channel, direction: 'outbound', body: body.trim(),
    ...(thread.subject ? { subject: thread.subject } : {}), ...(html ? { html } : {}), time: 'Just now', timestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19), simulated: true,
  }] }
}

export const prototypeEmailTemplates = [
  { id: 'availability', name: 'Lesson availability', subject: 'Finding a time for lessons', html: '<p>Hi {{firstName}},</p><p>We would love to help {{student}} get started!</p><p><strong>Which days and times work best?</strong> We can explore lesson options together.</p><p>Warmly,<br>Headliner Music Academy</p>' },
  { id: 'follow-up', name: 'Friendly follow-up', subject: 'Checking in about lessons', html: '<p>Hi {{firstName}},</p><p>Just checking in about lessons for {{student}}. Do you have any questions we can help with?</p><p>Warmly,<br>Headliner Music Academy</p>' },
]

/** Self-contained sample artwork: no remote image or tracking request. */
export const PROTOTYPE_LOGO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="56" viewBox="0 0 220 56"><rect width="220" height="56" rx="7" fill="#1a130f"/><text x="14" y="29" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#ffffff">HEADLINER</text><text x="15" y="44" font-family="Arial,sans-serif" font-size="9" letter-spacing="2" fill="#ffffff">MUSIC ACADEMY</text></svg>')}`
export const PROTOTYPE_SIGNATURE = `<p>Warmly,<br><strong>Headliner Office</strong><br>Headliner Music Academy<br>${PROTOTYPE_EMAIL}<br>${PROTOTYPE_PHONE} (sample)</p><img src="${PROTOTYPE_LOGO}" alt="Headliner Music Academy — sample logo">`
