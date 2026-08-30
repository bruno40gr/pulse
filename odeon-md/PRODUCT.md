# ODEON — Product Roadmap & Context

**Headliner Music Academy · Internal Admin Platform**
*Last updated: July 6, 2026*

> ODEON is the laboratory inside **Layered Labs**. It is Headliner's operating system and the proving ground for standalone products. For company strategy and the extraction candidate roadmap, see `LAYERED_LABS_VISION.md`.

---

## Project Overview

ODEON is the internal operations platform for **Headliner Music Academy**, a music school in Rocklin, CA offering private lessons, band programs, camps, and third-party-funded programs (charter school instructional funds — South Sutter, Visions [unverified, see decision log] — and SDP/Regional Center funding via FMS providers and regional centers — Alta California Regional Center, Mains'l, ACE FMS, Aveanna, On My Own Independent Living Services, Accura FMS, Public Partnerships/PPL). It is built and owned by Layered Labs, which uses ODEON as its primary product laboratory. Modules that prove their value inside ODEON become candidates for extraction as standalone products: CharterFlow (funded-student pipeline), Pulse (smart communications), BandOS (band program), and Signal (ops and follow-ups).

### Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **SMS:** Twilio
- **AI:** Anthropic (Claude / Claude Haiku for in-app AI)
- **Styling:** Tailwind CSS
- **Media:** Cloudinary
- **Hosting:** Vercel

---

## Guiding Principles

- **Modular by design** — each feature is self-contained with its own tables, UI, and API routes. Shared foundation: auth, tenant_id, contact records, Supabase.
- **Shell-first UI** — build the complete UI shell with all tabs before enabling features. Tabs start as empty states, enabled module by module as backends complete.
- **One Cline brief at a time** — no one-shots. Each session is one focused task to avoid context overload and poor decisions.
- **Backend schema first, then UI** — never build UI on top of an unready schema.
- **Domain-centered, not feature-centered** — the platform is built around a small number of core entities: contacts, families, enrollments, services, programs, bands, communications, billing. Each phase expands capabilities around those entities.
- **Parametric over duplicative** — service templates with variables, not one record per combo.
- **Policies over clones** — cancellation, makeup, billing rules attach to service types, not duplicate services.
- **Admin-driven, flexible billing** — the system works for the business, not the other way around.
- **AI prepares a draft using student context. Staff review, edit if needed, and send.** — AI doesn't make decisions. Humans do.
- **Plain English config** — 3 questions, system handles the logic behind the scenes.
- **Build Headliner-first, sell as SaaS later** — every table gets a `tenant_id` from day one.

---

## Core Domain Entities

Everything in ODEON is built around these entities. Every phase expands capabilities around them:

| Entity | Description |
|---|---|
| **Contacts** | Students, parents, teachers, leads, institutional contacts |
| **Families** | Grouped contacts sharing billing and account management |
| **Enrollments** | A student enrolled in a service — the central transactional record |
| **Services** | Parametric service templates (private lessons, band, camps, etc.) |
| **Programs** | Institutional program configurations (Alta California Regional Center, other SDP/FMS and charter programs) |
| **Bands** | Band profiles, members, stage status, setlists — built on top of enrollments |
| **Communications** | All outbound messages — campaigns, smart drafts, reminders |
| **Billing** | Invoices, payments, credits, payroll |
| **Tasks** | Internal staff tasks — linked to any entity (student, family, band, invoice) |

---

## Current State (What's Built)

| Feature | Status | Notes |
|---|---|---|
| **Contacts** | ✅ Built | Flat list, CSV import, deduplication. No family grouping yet. |
| **Campaigns** | ✅ Built | Filter contacts + AI-powered search. Compose and send SMS or Email. |
| **Inbox** | ✅ Built | View incoming messages. |
| **History** | ✅ Built | View past campaign sends. |
| **Auth** | ✅ Built | Login page with Supabase Auth. |
| **Admin Dashboard** | ❌ Not built | Redirects to campaigns for now. |

### Current Data Model

```
contacts: id, first_name, last_name, phone, email, service_type,
          instrument, lesson_day, lesson_time, instructor, plan_name,
          session_name, client_status, last_attended, tags[], opted_out,
          created_at, updated_at

campaigns: id, name, channel, message, media_url, filter_query,
           recipient_count, status, sent_at, created_at

messages: id, campaign_id, contact_id, channel, direction, body,
          media_url, status, twilio_sid, error_message, created_at
```

---

## Architecture Decisions (Foundation)

| Decision | Detail |
|---|---|
| `tenant_id` on every table | Schema-ready for SaaS from day one. Each school = isolated data on shared infra. 20 min now vs weeks to retrofit. |
| Multi-enrollment schema | One student → many enrollments, each with own service/teacher/schedule/price |
| Family account model | Account managers, minors, siblings — needed before Pipeline and Portal |
| Payment plan as policy | Attached to service type, not a separate service record |
| Global policy cascade | Business default → service template inherits → individual service can override |
| Enrollments before Band | Band membership is just another enrollment type. Enrollment engine first, Band builds on top. |
| Modular by design | Each feature has own tables, UI, and API routes |
| Parametric over duplicative | Service templates with variables, not one record per combo |
| AI-assisted, human-approved | AI prepares draft using student context. Staff review, edit, send. |
| Caseworker access = shareable link | No login required for institutional caseworkers — read-only URL per student |
| Document hub per student | Not per family — a family may have one child in Alta, another in a different program |
| Tasks as infrastructure | Lightweight task system linked to any entity — not a phase, used by every module |
| Calendar split into 7A/7B | Core scheduling first, automation layer second — calendar is too large for one phase |

---

## Extraction Readiness

ODEON is built for Headliner. But every module is also a prototype for a Layered Labs standalone product. The decisions made here determine how hard or easy extraction becomes later. This section is a standing checklist — Cline must honor these on every module, not just the ones obviously headed toward extraction.

**Schema rules**

- No hardcoded tenant-specific values in the database. Headliner-specific things (instrument names, service types, program names) live in configuration rows, not in enums or column names. The schema describes structure. Configuration describes content.
- Service types, contact types, program types, and entity categories are always stored as configurable values, not hardcoded in migrations or API logic. If adding a new service type requires a schema change, something is wrong.
- Every table has `tenant_id`. No exceptions. A table without it cannot be extracted into a multi-tenant product without a migration.
- Music-specific concepts stay at the application layer. The `enrollments` table doesn't know it's for music lessons. The `programs` table doesn't know it's for Alta. That context lives in the data, not the structure.

**API rules**

- Every module's API routes are self-contained. A module's endpoints should be portable — meaning if CharterFlow ships as a separate product, its `/api/pipeline` routes move with it without pulling half of ODEON along.
- No cross-module database joins in hot paths. Modules share the contacts and families foundation, but their own tables are their own. If the Band module needs billing data, it calls the billing API, it doesn't join across billing tables directly.
- No Headliner-specific strings in API responses. Labels, copy, and display names come from config or the UI layer, not from API logic.

**UI rules**

- All user-facing copy lives in the component or a config file, not hardcoded in API responses or database values. This means when Pulse ships as a standalone product, its UI copy can be rebranded without touching the backend.
- Module UI is self-contained. Each tab in the ODEON shell is its own component tree. Extracting it means lifting that tree, not untangling shared state across the whole app.
- Empty states, labels, and navigation items for each module live in that module's config. Not in a global constants file shared across everything.

**The practical test**

Before marking any module complete, ask: could this module be deployed as a standalone product for a non-music-school customer without a schema migration? If the answer is no, identify what's hardcoded and move it to configuration before moving on.

This isn't about building everything twice. It's about not making decisions in session 3 that block a pivot in month 14.

---

## Phased Build Plan

---

### Phase 0 — Foundation Migration
**Status:** 🔜 Next up
**Time:** ~3 sessions, ~45–60 min each
**Risk:** Low — additive only, existing functionality untouched
**Prerequisite for:** Everything else

**What gets added:**
1. `tenant_id uuid` on all existing tables (contacts, campaigns, messages) — backfill with default single-tenant UUID
2. Retrofit `contacts` with family scaffolding:
   - `contact_type` enum: `adult_student` · `minor_student` · `account_manager` · `teacher` · `institutional_contact` · `lead`
   - `family_id` uuid nullable FK
   - `is_family_owner` boolean default false
3. Create `families` table: `id`, `tenant_id`, `name`, `primary_account_manager_id`, `created_at`
4. Create `programs` table (funding organizations — charter AND FMS, see CharterFlow BRD §4.2): `id`, `tenant_id`, `name`, `org_type` (charter / fms / other — configurable value, not enum), `contact_info jsonb`, `required_documents jsonb`, `workflow_steps jsonb`, `payment_terms jsonb` (must support conditional cadence rules, e.g. Mains'l's dollar-tiered payout schedule — not a flat text field), `recipient_routing` (direct / portal / family_routed), `profile_version int`, `field_metadata jsonb` (per-field source, confidence, last-verified-by/date), `created_at`
   > ⚠️ Changed from original spec: `payment_terms` was `text`, now `jsonb`; `org_type`, `recipient_routing`, `profile_version`, `field_metadata` added. Rationale: real Mains'l/ACE FMS/Aveanna correspondence shows flat fields can't represent tiered cadence, routing differences, or per-field confidence. Profile edits create a new version, never overwrite — historical explainability ("this invoice used profile v12") is a requirement, not a nice-to-have.
5. Create `enrollments` table (minimal): `id`, `tenant_id`, `contact_id`, `service_type`, `status`, `start_date`, `end_date`, `created_at`
6. Create `tasks` table (infrastructure): `id`, `tenant_id`, `title`, `body`, `assigned_to`, `due_date`, `status`, `linked_entity_type`, `linked_entity_id`, `is_recurring`, `created_at`
7. API route updates + new family/program/enrollment/task endpoints
8. UI: family grouping toggle on Contacts page, contact type badges

**Sessions:**
- Session 1: Migration SQL + schema deployment
- Session 2: API route updates
- Session 3: UI — contacts page family view + programs admin stub

**Do not touch:** Campaigns page, messages table, SMS sending logic, auth flow.

---

### Phase 0.5 — UI Shell
**Status:** 🔜 After Phase 0
**Time:** ~1–2 sessions
**Risk:** Low — no backend logic, UI only
**Prerequisite for:** All feature modules

Build the complete ODEON sidebar and navigation shell. All tabs present, most as empty states. This is the house — features get enabled room by room.

**Sidebar tabs:**

| Tab | Enabled in phase | Empty state copy |
|---|---|---|
| Dashboard | 0.5 | Summary cards — all empty for now |
| Contacts & Families | 0 | ✅ Active |
| Campaigns | existing | ✅ Active (replaced in Phase 8) |
| Inbox | existing | ✅ Active |
| Institutional Pipeline | 1 | "Manage funded-student enrollments, documents, and payments here — charter schools and SDP/FMS programs." |
| Enrollments & Services | 2 | "Build your service catalog and manage student enrollments here." |
| Band Program | 3 | "Manage your bands, setlists, stage readiness, and gig opportunities here." |
| Billing & Payments | 4 | "Invoices, subscriptions, and payment tracking will live here." |
| Makeup Bin | 5 | "Track and manage all outstanding makeup credits here." |
| Tasks | 0.5 | ✅ Basic active — linked task creation per entity added per phase |
| Communications | 8 | "AI-assisted smart communications replace Campaigns here." |
| Calendar | 9A | "Your full schedule — lessons, rooms, teachers, and coverage." |
| Parent & Student Portal | 10 | "Student and parent-facing portal management will live here." |
| Reporting & Insights | 11 | "Enrollment trends, churn risk, revenue dashboards, and more." |
| Camps & Programs | 12 | "Create and manage summer camps and seasonal programs here." |
| Staff & Payroll | 13 | "Teacher tools, session notes, and payroll tracking will live here." |
| Settings | 0.5 | ✅ Active stub — programs config, discount engine, policies |

**Empty states are intentional** — not blank pages. Each says what the feature will do.

---

### Phase 1 — Funded-Student Pipeline (CharterFlow)
**Status:** 🔜 After Phase 0.5
**Priority:** #1 — revenue-blocking, no Opus equivalent
**Dependencies:** Phase 0 (family model, programs table), Phase 0.5 (shell)
**Canonical spec:** `CharterFlow_BRD.md` — this section is the ODEON-integration summary; the BRD is the source of truth for the domain model.

Replaces email-based back-and-forth for ALL third-party-funded students — charter school instructional funds (South Sutter, Visions — unverified, see decision log) **and** SDP/Regional Center funding via FMS providers and regional centers (Alta California Regional Center, Mains'l, ACE FMS, Aveanna). Built generically: every funding organization is configuration, not code. Scope decision (July 2026): both funding worlds in from day one. They differ in regulator and mechanics but share the same operational shape for the vendor; building charter-only and retrofitting FMS later hits exactly the retrofitting pain Phase 0 exists to prevent.

**The problem it solves:** Every funded student requires enrollment forms, compliance documents, correctly-coded invoices, submission in that funder's required channel, and payment tracking — currently managed via email with the rules living in staff memory. The rules genuinely differ per organization (submission channel, invoice format, service codes, payment cadence, approval gates) and even per rep within one organization.

**Core model (see BRD §4 for full detail):**
- **Case = one student × one funding organization.** Not per family (siblings can be on different funders; authorizations/POs are per child per funder).
- **Case states:** Discovery (unknown funder — build profile or decline) → Blocked → Active. Blocked splits into three owned sub-states: *vendor approval pending* (once per funder, unblocks all cases with it), *student linking pending* (per student, often family-owned — e.g. adding the vendor in the FMS portal), *document task pending* (one-off form/signature, assigned to vendor or family).
- **Invoice states:** Pending → Overdue → Rejected → Paid. Action-oriented — each state implies a next move. No flat "sent" status.
- **Invoice generation:** pull raw billing data (Opus CSV bridge now; native ODEON billing after Phase 4 replaces it) → match to case → enrich with case data (service code, PO/auth number) and program rules (aggregation grain, format, numbering constraints) → generate compliant document → deliver per the program's recipient routing.
- **Delivery = scoped links, no logins.** One envelope per event: onboarding envelope (vendor-level + case-level docs bundled on first case with a new funder; vendor docs included on every later case until that funder is *observed* accepting reuse — never assumed), then long-lived per-invoice links for the recurring cycle. Confirmed existing decision: caseworker/FMS access is a shareable link, not an account.
- **Programs are versioned living profiles**, per-field confidence and source metadata, observed behavior (actual days-to-pay) tracked separately from stated terms.

**Key features (updated):**
- Configurable funding org setup (documents, routing, invoice rules, conditional payment cadence — see programs table, Phase 0)
- Pipeline board: one row per case, action states as columns — Kanban or table view
- Admin action log per case — no more referencing emails
- Family flow via scoped link, no account: complete document task → fill/sign in-browser → approve/attest where the funder requires it (Mains'l-style approval, Aveanna-style family-routed submission)
- Document hub per student (existing decision — confirmed, now per case where a student has multiple funders)
- Multi-month invoice generation: admin selects case + date range, generates all invoices at once
- Auto-follow-up: nudge when a case stalls in any state beyond X days (feeds Phase 6)
- Funding org profile view: all cases, total revenue, outstanding balances, observed vs stated payment behavior

**Out of scope for this phase** (per BRD): payment fund-holding/payout smoothing (money transmitter territory — deferred, legal review required), FMS-facing portals, email-ingest payment detection (Phase 2+ of BRD), multi-vendor profile library (activates at extraction — but schema must support it now via tenant_id and versioned programs).

---

### Phase 2 — Enrollment & Service Catalog
**Status:** 🔜 After Phase 1
**Priority:** #2 — foundation that Band, Billing, Calendar, and Portal all depend on
**Dependencies:** Phase 0 (enrollments table)

> Moved ahead of Band Program. Band membership is just another enrollment type. Building the enrollment engine first means Band becomes "a service type + stage/setlist logic on top" rather than a duplicated system.

**Key features:**
- Parametric service templates (define once, variables at enrollment: instrument, level, duration, teacher)
- Teacher capability profiles (instrument × level matrix — admin-managed, filters enrollment dropdown)
- Service types:

| Type | Category | Billing model |
|---|---|---|
| Private lessons | Recurring | Monthly or pay per visit |
| Semi-private lessons | Recurring | Monthly or pay per visit |
| Group lessons | Recurring | Monthly |
| Band program | Recurring | Monthly per member |
| Birthday parties | One-off | Upfront |
| Band rehearsals | One-off booking | Per session |
| Studio recording | One-off booking | Per session |
| Summer camps | Program | Upfront at enrollment |

- Payment plans as policy (not service records): monthly, pay per visit, à la carte, upfront multi-month
- Flexible discount engine: promo codes, named rules (adjustable rates), one-time/recurring/trial, stackable or exclusive, audit trail
- Global cancellation & makeup policy cascade:
  - Set once at business level, services inherit, can override per service
  - Plain English builder: 3 questions → system sets all logic
- Multi-enrollment per student: multiple active subscriptions, each with own service/teacher/schedule/price

---

### Phase 3 — Band Program
**Status:** 🔜 After Phase 2
**Priority:** #3 — core to Headliner identity
**Dependencies:** Phase 0 (family model), Phase 2 (enrollment engine — band membership is an enrollment)

*Program name TBD — options: The Lineup, Ensemble, Stage*

**Key features:**
- Band profiles: name, members, instruments, formation date, stage status, setlists, teacher notes, notes to musicians/parents
- Stage status (teacher-owned): Just Created → In Development → Ready for Stage
- Two formation paths:
  - Internal: teacher assembles from existing private/semi-private students
  - External: group arrives already formed — all members enrolled and put on record
- External members subscribe to band program via enrollment engine (Phase 2)
- Enrollment types: lessons only · band only · lessons + band
- Permission model: students update info, only teachers set stage readiness, admin sees all
- Curriculum integration: stage milestones defined in separate curriculum project, surfaced here

**Future (band):**
- Event opportunity pipeline: log area gig invitations, filter by stage status, trigger targeted SMS/email
- Student-facing access: band members view profile, setlist, teacher notes from portal

**Band curriculum:**
Structured curriculum being developed in a separate Claude project. Will live inside ODEON where teachers assign stages based on milestones, log session notes tied to curriculum progress, and track setlists against stage requirements.

---

### Phase 4 — Billing & Payments
**Status:** 🔜 After Phase 3
**Priority:** #4
**Dependencies:** Phase 2 (service catalog)

**Key features:**
- Stripe integration (own billing, replacing Opus)
- Multi-line invoices per student per cycle
- Multi-month batch invoice generation (critical for charter schools paying upfront)
- Family billing: multiple account managers, split payments, sibling accounts
- Payment failure: retry logic, grace period, suspension flow
- Refunds: full, partial, or credit back to account vs card
- Payroll tracking: sessions × rate, makeup sessions separate, teacher discount sessions flagged, monthly export
- Charter school: end-of-month or upfront, any combination, grouped/tagged

---

### Phase 5 — Makeup Bin
**Status:** 🔜 After Phase 4
**Priority:** #5 — replaces manual spreadsheet
**Dependencies:** Phase 2 (cancellation policies)

Replaces the manual Opus export (currently a spreadsheet: student, instructor, instrument, date, duration — no status, no expiry, no actions).

**Key features:**
- Live admin view: credit status, expiration date, days remaining (color-coded urgency)
- Columns: student · instructor · instrument + level · missed date · status · expiry · makeup date
- Filters: by status, instructor, instrument, date range; "Expiring this week" smart filter
- Actions from the bin: send reminder, schedule makeup, mark redeemed, extend expiration, bulk remind
- Automation: auto-remind X days before expiry, auto-expire past deadline, weekly digest
- Credit ledger per student: full history, visible in profile and parent portal
- Makeup sessions flagged on the session itself — visible on calendar, roster, billing, reports

---

### Phase 6 — Scheduled Follow-Up System
**Status:** 🔜 After Phase 5
**Priority:** #6
**Dependencies:** Phase 0 (contacts), Phase 1 (pipeline)

Snooze-and-resurface mechanism tied to any entity. Replaces manual email reminders and lost sticky notes.

**From any student, family, band, or invoice record:**
- Set date or trigger (specific date or relative — "in 6 weeks")
- Add reason/note ("gone for summer, reach out about fall enrollment")
- Assign to a staff member
- Set action type: call · SMS · email · internal reminder

**Follow-up queue (admin view):**
- All pending follow-ups, sortable by date and owner
- Filter by type: win-back · seasonal · trial · pause · renewal · charter
- Bulk actions (e.g. 10 summer students → September outreach)

**Auto-created by:**
- Churn risk signals (at-risk threshold hit)
- Institutional pipeline (stage stalls)
- Manual admin action from any profile

**Example use cases:**
- Student gone for summer → resurface September 1st
- Trial didn't convert → check in after 2 weeks
- Parent said "maybe in September" → resurface September 1st
- Student paused → follow up in 6 weeks
- Charter school contract renewal → flag 30 days before end date
- Win-back after churn → outreach in 3 months

---

### Phase 7 — Task System
**Status:** 🔜 After Phase 6 (infrastructure in Phase 0, UI here)
**Priority:** #7
**Dependencies:** Phase 0 (tasks table)

Internal staff task management. Not just student follow-ups — any operational task the school needs to track.

**Key features:**
- Tasks linked to any entity: student · family · band · invoice · program · none
- Assigned to staff member, due date, status: open · in progress · done
- Recurring tasks (e.g. "check makeup bin every Monday")
- Task creation available from any entity's profile page
- Task queue per staff member — their daily to-do list
- Admin view: all open tasks across all staff, sortable by due date and assignee

**Example use cases:**
- Call parent about trial conversion
- Order books for new semester
- Print recital tickets
- Find substitute for next Tuesday
- Teacher owes session notes
- Invoice needs correction
- Follow up with Alta caseworker

---

### Phase 8 — Pulse (Smart Communications)
**Status:** 🔜 After Phase 7
**Priority:** #8 — replaces current Campaigns tool
**Dependencies:** Phase 0 (contacts), Phase 2 (enrollments), Phase 9A (calendar)

**The problem it solves:** Admin manually writes personalized emails for every schedule change, enrollment, and follow-up. Opus offers templates — obviously templated, impersonal. ODEON prepares drafts that sound like a human wrote them.

**Core philosophy:** ODEON knows the context → AI prepares a draft using student context → staff review, edit if needed, and send → parent feels it was written for them. Personal at scale.

**Trigger scenarios:**
- Schedule change (grouped by family — all affected children in one message)
- New enrollment confirmation
- Makeup credit issued
- Credit expiring soon
- Payment failed
- Milestone reached ("Jamie just leveled up to Guitar Level 2")
- Coverage assigned
- Win-back after churn
- Camp enrollment confirmation
- Institutional pipeline stage updates
- Multi-month invoice batch delivery

**Communication preferences per family:** SMS, email, or both. Admin can always override.

**Note:** Current Campaigns page = Pulse v0. Keep running as-is through Phases 0–7. Replace wholesale here. Contacts becomes full CRM hub, Communications becomes AI-assisted action layer.

---

### Phase 9A — Calendar: Core Scheduling
**Status:** 🔜 After Phase 8
**Priority:** #9A
**Dependencies:** Phase 2 (service catalog, teacher capabilities)

*Calendar is split into two phases — it's large enough to warrant it.*

**Key features:**
- Multi-branch responsive calendar (day, week, month, by teacher, by room)
- Branch switcher — one location or all
- Mobile responsive
- Create enrollment/subscription directly from a calendar slot
- Makeup sessions visually tagged
- Camp weeks blocked, institutional students flagged
- Recurring lesson display and management

---

### Phase 9B — Calendar: Automation Layer
**Status:** 🔜 After Phase 9A
**Priority:** #9B
**Dependencies:** Phase 9A, Phase 8 (Smart Communications)

**Key features:**
- Substitute matching: when teacher is out, surface qualified replacements from capability profiles
- Conflict detection: flag double-bookings, room conflicts, teacher over-assignment
- Break management: mandatory break blocks, visually enforced
- Communication triggers: schedule change detected → Pulse draft fired automatically
- Branch management: multi-location scheduling rules

---

### Phase 10 — Parent & Student Portal
**Status:** 🔜 After Phase 9B
**Priority:** #10
**Dependencies:** Phase 2, Phase 8, Phase 9A

*Mobile-first, AI-native*

**Key features:**
- One login manages multiple children
- Pay invoices, manage payment methods, view billing history
- Schedule, cancel, request makeup — triggers credit automatically
- Institutional program document hub: upload, download, track status
- Progress & learning feed: session notes, homework, repertoire log, milestones, practice log
- Band profile, setlist, upcoming gig opportunities
- Camp deliverable download (video/recording)
- AI-native: auto-generated lesson summaries, AI practice coach, progress insights, smart reminders, AI front desk chat, homework suggestions

**Portal access tiers:**
- Parent of minor: full access — billing, progress, communications, documents
- Teen student (15+): own login, homework, band, limited billing visibility
- Adult student: full self-service
- Institutional caseworker: read-only shareable link, no login required

---

### Phase 11 — Reporting & Insights
**Status:** 🔜 After Phase 10
**Priority:** #11 — layer on top of live data

> Renamed from "CRM & Reporting" — the CRM already exists by this point as the contacts + lifecycle layer. This phase delivers dashboards and analytics.

**Dashboards:**
- Active students · churn rate · new trials · attendance
- Lifetime value · conversion rate (trial → active)
- Teacher utilization · room utilization
- Revenue by instrument · revenue by program · revenue by teacher
- Outstanding invoices · makeup credit liability
- Enrollment trends over time

**CRM intelligence:**
- Trial tracking, churn risk scoring, attrition alerts
- Student lifecycle: Trial → Active → At-risk → Paused → Churned → Win-back
- Auto-flag lapsed students for Pulse outreach

**SaaS differentiator:** Analytics dashboards are a major advantage over Opus and competitors.

---

### Phase 12 — Camps & Programs
**Status:** 🔜 After Phase 11
**Priority:** #12 — seasonal
**Dependencies:** Phase 2, Phase 4, Phase 9A

**Key features:**
- Camp templates: name, dates, age range, capacity, price (upfront), staff, deliverable type
- Enrollment with age gate, capacity gate, auto-waitlist
- Deliverable delivery: staff uploads, parent notified, downloads from portal, optional watermark
- Promo targeting by age/interest/past attendance, early bird codes, camp alumni targeting
- Calendar integration: camp blocks staff and rooms for duration

---

### Phase 13 — Staff Tools & Payroll
**Status:** 🔜 After Phase 12
**Priority:** #13
**Dependencies:** Phase 2, Phase 9A

**Key features:**
- Post-session tools: session notes (private or shared), homework, notes for substitute, AI session assist, affiliate gear links
- Teacher profile & landing page: bio, availability, shareable referral link, direct booking
- Progress tracker, repertoire log, parent comms log, practice reminders, goal setting
- Payroll: sessions × rate, makeup sessions separate, teacher discount sessions flagged, monthly export

---

### Phase 14 — Affiliate & Gear Revenue
**Status:** 🔜 Future
**Priority:** #14
**Dependencies:** Phase 13

- School earns commission, teacher recommends via homework/notes
- Tracked to school's affiliate account (Amazon, Sweetwater, Guitar Center, etc.)
- Admin-approved catalog or link submission
- Per-tenant affiliate accounts in SaaS context

---

## Platform Vision — Layered Labs

ODEON is the first product inside Layered Labs. Every architectural decision — multi-tenancy, modular design, domain-centered entities — is made with extraction in mind. Headliner is tenant #1 and the proof of concept. When a module works well enough that other organizations ask for it, it becomes a standalone product.

**Extraction candidates (see LAYERED_LABS_VISION.md for full detail):**
- **CharterFlow** — the Funded-Student Pipeline extracted for any enrichment vendor managing third-party funding workflows (charter instructional funds AND SDP/FMS)
- **Pulse** — the Smart Communications layer extracted as a contextual AI communications product for any lesson-based business
- **BandOS** — the Band Program extracted as a lifecycle management platform for youth performing organizations
- **Signal** — the follow-up and operational intelligence layer extracted as a standalone ops tool for education businesses

**SaaS path for ODEON itself:**
- `tenant_id` on every table from day one
- Each school = completely isolated data, shared infrastructure
- White-label: custom logo, colors, domain per tenant
- Subdomain (school.odeon.com) or fully custom domain per tenant
- Onboarding flow, tiered pricing by student count or flat monthly fee

**Key differentiators vs Opus and competitors:**
- Parametric service templates (no record explosion)
- CharterFlow pipeline (no equivalent exists in market)
- Makeup Bin (live actionable view vs manual spreadsheet)
- Pulse communications (AI-drafted, human-approved, personal at scale)
- AI-native parent portal
- Plain English policy builder
- Signal follow-up system
- Analytics dashboards (teacher utilization, room utilization, LTV, conversion)
- Task system linked to every entity
- BandOS curriculum integration

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| Jul 3, 2026 | Add Phase 0 (Foundation Migration) | Building Pipeline on flat schema causes painful retrofitting. Family model needed first. |
| Jul 3, 2026 | Defer Contacts/Campaigns merge to Phase 8 | Current Campaigns is Smart Comms v0. Don't over-invest — replaced wholesale in Phase 8. |
| Jul 3, 2026 | Quick win: selection-based SMS/Email on Contacts | ~30 min, reuses ComposePanel. Low effort bridge until Phase 8. |
| Jul 6, 2026 | Add Phase 0.5 — UI Shell | Shell-first strategy: build full nav structure before enabling features tab by tab. |
| Jul 6, 2026 | Move Enrollment & Services to Phase 2, Band to Phase 3 | Band membership is an enrollment type. Enrollment engine first, Band builds on top. Avoids duplicating pricing/billing/scheduling concepts. |
| Jul 6, 2026 | Split Calendar into Phase 9A and 9B | Calendar is too large for one phase. Core scheduling first, automation layer second. |
| Jul 6, 2026 | Rename Phase 9 to Reporting & Insights | CRM already exists by then. This phase delivers dashboards and analytics. |
| Jul 6, 2026 | Add Task System as Phase 7 | Schools need internal task tracking beyond student follow-ups. Tasks table added to Phase 0 as infrastructure. |
| Jul 6, 2026 | Caseworker access = shareable link, not login | Simpler, more secure, less friction. Login only if approval inside system is required. |
| Jul 6, 2026 | Document hub per student, not per family | A family may have children in different programs. Keep pipeline per student. |
| Jul 6, 2026 | Create PRODUCT.md as single source of truth | Avoid losing context between sessions. Hand to Cline at start of every session. |
| Jul 13, 2026 | Phase 1 scope: charter AND SDP/FMS from day one | Same operational shape for the vendor; charter-only would force the exact retrofitting Phase 0 warns about. CharterFlow_BRD.md is canonical spec. |
| Jul 13, 2026 | Case = student × funding org, not per family | Authorizations/POs are per child per funder; siblings can be on different programs. Extends the existing "document hub per student" decision. |
| Jul 13, 2026 | Programs table: payment_terms text → jsonb; add org_type, recipient_routing, profile_version, field_metadata | Real Mains'l/ACE FMS/Aveanna correspondence shows flat fields can't hold tiered cadence, routing, or per-field confidence. Profiles are versioned, never overwritten. |
| Jul 13, 2026 | Action states replace linear pipeline stages | "Sent" implies nothing; Blocked (3 owned sub-types) / Pending / Overdue / Rejected each imply a next move. |
| Jul 13, 2026 | Fund-holding / payout smoothing explicitly deferred | Money transmitter territory. Legal review required before any design work. |
| Jul 13, 2026 | **Correction:** Alta is Alta California Regional Center (SDP/FMS side), not a charter school | Confirmed with Bruno after documents consistently showed Alta issuing SDP authorizations (Kaleb Borja, Service Coordinator) and never appearing in any charter-side document. Prior drafts of PRODUCT.md and CharterFlow_BRD.md listed it alongside South Sutter/Visions as a charter example — corrected everywhere. **Open:** South Sutter, Visions, Pacific Coast Academy, and Horizon have also never appeared in a real document; provenance is early illustrative brainstorming, not confirmed fact. Do not treat as real until verified. |
| Jul 13, 2026 | Confirmed via email search: three additional real SDP/FMS entities — On My Own Independent Living Services, Accura FMS, Public Partnerships (PPL) | Web-verified as real, active CA SDP FMS providers (not yet cross-checked against actual correspondence content). Brings confirmed SDP-side organizations to seven (Alta California Regional Center, Mains'l, ACE FMS, Aveanna, On My Own, Accura FMS, PPL) against zero confirmed charter organizations. Phase 0's "five hand-built profiles" placeholder is now understated on the SDP side and unfounded on the charter side — prioritize the actual five-to-seven by real case volume per funder, not by which names surfaced first, and resolve the charter-side question before assuming any charter profiles belong in the initial set. |
| Jul 13, 2026 | **Guardrail:** funding organizations must never be modeled as a type of account holder | A separate session proposed adding Alta/ACE FMS/Mains'l to the `accounts` table as `account_type = 'institution'` with flat `institution_code`/`billing_contact_*` columns, alongside private-pay parents and self-pay adults. Rejected — this collapses the entire `programs` table design (recipient routing, conditional cadence, versioned profiles, per-field confidence) into a few text columns, and repeats the Alta-is-a-charter-school error already corrected once. Account holders (who pays, simple) and funding organizations (`programs` table, §6.2 of the BRD) are structurally different entities and must stay separate tables. If a shared payer reference is needed on a case, it's a `payer_type` field pointing to either `accounts` or `programs`, never a merge. Any future session proposing to fold funding orgs into a generic accounts/entities table should be pointed to this entry and to CharterFlow_BRD.md §6.2 before proceeding. **The legitimate underlying need (admin sees a student's funding context at a glance; correspondence links to the right student+institution) is already served by the `case` entity (student_id + program_id), not by tagging the student or account. Solve it by surfacing case summaries on the student's ODEON profile and letting Pulse messages optionally link to a `case_id`, not by adding new fields to `accounts`.** |

---

## Open Questions (Architectural Gap Review)

*To be answered before relevant modules are built:*

- Is there a front desk / non-teacher admin role?
- Can a parent also be a student themselves?
- What is the formal makeup credit expiration policy?
- What happens when a student pauses (not cancels) — does billing pause too?
- Can a student transfer between teachers mid-enrollment? What happens to history?
- Do lessons have fixed room assignments or is room booking separate?
- What happens to a recurring slot when a teacher leaves?
- What is the payment failure / grace period / suspension flow?
- Do sibling discounts exist beyond discount codes?
- Are any communications always human-only (never automated)?
- Can teachers see each other's students?
- Is there a student onboarding checklist (waivers, intake forms)?
- What documents need to be retained per student?
- What if a band loses a member mid-subscription — does billing adjust?
- What if a camp is cancelled by the school — refund, credit, or choice?
- What if two siblings are in the same camp — one invoice or two?
- What if a charter school student drops mid-month — prorate or full month?
- In SaaS model: free trial, tiered by student count, or flat monthly fee?
- Do Alta caseworkers need to approve inside ODEON or is read-only sufficient? → **Answered Jul 13:** neither logs in. Approval, where a funder requires it (Mains'l parent attestation, Aveanna family-routed submission), happens via scoped link — one action, no account. Read-only links for caseworkers stand.
- Are document requirements different per institutional program? → **Answered Jul 13:** yes, substantially — per organization AND sometimes per rep within one organization (see ACE FMS accepted-alternatives saga in BRD). This is why programs are versioned profiles with per-field confidence, not static config.
- Can a teacher be assigned to a camp and still have regular lessons that week?

---

## Session Structure

**Division of labor:**
- **Claude** — architecture, product thinking, Cline brief authoring, decisions
- **Cline** — implementation
- **Return to Claude** — when Cline gets stuck or makes poor architectural decisions

**Each Cline session:**
1. Hand Cline this PRODUCT.md + the specific brief for that session
2. Cline works (~10–20 min autonomous)
3. Review and test (~5–10 min): run migrations, check app loads, verify existing features still work
4. Debug if needed (~10–15 min)
5. Decision gates: approve before moving to next step

**One brief at a time — no one-shots.** Context overload leads to poor decisions.
**Sessions can be spread across days** — no marathon blocks needed.

---

## Next Steps

1. ✅ PRODUCT.md created and updated
2. 🔜 Phase 0 Session 1 — Schema migration SQL (use Kimi's brief)
3. 🔜 Phase 0 Session 2 — API route updates
4. 🔜 Phase 0 Session 3 — Contacts page family view
5. 🔜 Phase 0.5 — UI Shell brief (Claude writes after Phase 0 complete)
6. 🔜 Phase 1 — Institutional Pipeline (CharterFlow) brief (Claude writes after shell complete)