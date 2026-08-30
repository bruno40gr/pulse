# CharterFlow — Business Requirements Document

*Canonical domain spec for ODEON Phase 1 (Funded-Student Pipeline) and the future extracted product. Companion to PRODUCT.md, which owns build sequencing and ODEON integration. Implementation candidates live in the Appendix, not in the body — the body says what must be true, the appendix suggests how.*

---

## 1. Thesis

**CharterFlow doesn't standardize funding organizations. It standardizes how vendors work with them.**

Alta California Regional Center, Mains'l, ACE FMS, and Aveanna (all SDP/FMS) are different from each other and from South Sutter and Visions (charter instructional funds — unverified as real entities, see PRODUCT.md decision log) — and will stay different, with legitimate reasons to be so. CharterFlow models those differences once, as data, so that every vendor interacts with all of them through one consistent operational framework — and so the knowledge of how each one works stops living in staff memory and email threads.

## 2. Problem statement

Every California enrichment provider that accepts charter or SDP funding is forced to rebuild the same operational knowledge independently. Every funding organization has different onboarding requirements, invoice rules, submission channels, payment cadences, and contacts — and sometimes different answers depending on which rep responds. That knowledge rarely lives in software; it lives in experienced administrators, email threads, and shared drives, and it fails silently when a person leaves, a rep changes, or a form quietly updates. Structurally, it's an N×M problem: N funding organizations × M vendors, with no shared layer between them, re-paid in full by every vendor for every organization.

## 3. Jobs to be done

**Vendor (primary customer, primary user):**
- *When a funded student enrolls,* I want to satisfy that funder's requirements correctly the first time, without relearning them, so lessons start fast and nothing bounces.
- *When I look at my funded students,* I want to know exactly what needs my action today — what's blocked, what's overdue, what got rejected — not a log of what happened.
- *When I invoice,* I want the correct code, format, aggregation, and recipient applied automatically, so my front desk doesn't need to know what "331" means.
- *When cash flow matters,* I want to know when each funder actually pays (observed, not promised), so I can plan.

**Family (participant, never a payer):**
- *When my child's funding requires something from me* — an approval, a signature, adding the vendor in a portal — I want one small, specific, obvious action, so services continue without me becoming a bureaucracy expert.
- *When something stalls upstream,* I want the vendor to already know it's not my fault or theirs, so nobody chases me for a delay a Regional Center caused.

**Funding organization (non-user, served indirectly):**
- *When a vendor submits anything,* I want it complete, correctly formatted, and in my required channel the first time, so my staff doesn't burn hours on back-and-forth.
- Served without asking them to adopt anything: they keep receiving email or portal submissions exactly as they do today. No logins, no new tools on their side.

## 4. MVP vs. the full ecosystem

**MVP (ODEON Phase 1, single tenant, Headliner):** one vendor, hand-built funding org profiles, prioritized by real case volume from seven confirmed SDP-side candidates (Alta California Regional Center, Mains'l, ACE FMS, Aveanna, On My Own Independent Living Services, Accura FMS, Public Partnerships/PPL — all confirmed via real correspondence or verified as active entities; charter-side profiles pending Phase 0 confirmation of which charter organizations Headliner actually works with, if any) seeded from lived correspondence, Opus CSV bridge for billing data, generated compliant invoices delivered by scoped link, action-state case tracking, manual mark-paid. The value delivered is **operational certainty for one vendor**: nothing re-learned, nothing silently stalled, nothing formatted wrong.

**Full ecosystem (post-extraction):** multi-vendor shared profile library where every vendor's corrections compound; AI-assisted profile authoring from funder-published documents; observed-behavior intelligence across the network (real days-to-pay, rejection causes, which document unblocks what); funding organizations eventually maintaining their own profiles — shifting maintenance to the source of truth; families with a consistent one-tap surface across every vendor they use. Optionally, much later and only after legal review: a payments layer.

The bridge between the two is the compounding mechanic: profiles built for vendor #1 are reused by vendor #2, whose corrections improve them for vendor #3. MVP must be architected so this activates at extraction without a migration (tenant_id everywhere, profiles versioned and tenant-independent in structure).

## 5. Scope and non-users

**In scope:** the vendor's relationship to each funding organization, from first contact through recurring invoicing and payment. Charter instructional funds AND SDP/FMS from day one — confirmed deliberately; earlier drafts repeatedly narrowed to charter-only by accident, and the schema cost of retrofitting FMS later is exactly what ODEON's Phase 0 exists to prevent.

**Out of scope:** anything between an FMS, the state (DDS), and Regional Center coordinators — authorization queues, fiscal-year backlogs. CharterFlow captures these as contextual information on a case (e.g. "Alta authorizations delay every July"), never as workflows it manages.

## 6. Domain model

### 6.1 Vendor vault (company-level, entered once)

Identity and compliance data that never varies per student: legal name, EIN, business license, insurance, W-9, standing signature, and the list of SDP service codes the vendor is eligible to bill under (a list — not a single default; the correct one is selected per authorization, occasionally more than one per case).

### 6.2 Funding organization profile — a living knowledge asset

**Principle: a profile is not a settings object.** It is a living operational record of how a specific organization works *today*, how confidently each fact is held, who verified it, when, and how it has changed over time. Every workflow in CharterFlow depends on these profiles; collectively they are the product's core intellectual property and the reason vendor #2 onboards faster than vendor #1.

**Field groups:**

| Group | Contents |
|---|---|
| Identity & contact | Legal name, aliases, contacts (each shown on their own card as **Payer: [organization]** distinct from **Role: [Vendor Support Rep / Service Coordinator / Independent Facilitator / SDP Specialist]**, tagged confirmed-by/date — reps within one org give different answers, and roles outside the FMS itself, like a Regional Center Service Coordinator, are still worth logging as case contacts even though the process they manage stays out of scope per §5) |
| Recipient routing | direct-to-FMS / **portal (file upload)** / **portal (manual entry — vendor re-enters invoice data into the funder's own form; no generated document to deliver, routes to assist-mode instead)** / family-routed / **card-on-file charge** (funder provides a payment card the vendor charges; money is pulled, not pushed — the "invoice" may never be transmitted, only charged) — governs where every envelope and invoice goes, or which mechanism applies. **A single funder can require more than one portal for different purposes** (PPL's "My Account" for enrollment/signature vs. "PPL@Home" for ongoing invoice submission, a separate registration a vendor can complete onboarding without discovering); routing is tagged by purpose, not assumed to be one system per funder. |
| Onboarding requirements | Required documents, accepted alternatives per document, known rejections (the ACE FMS accepted-alternatives list only surfaced across three rejection emails — this field exists so the next vendor submits right the first time). Some requirements are conditional on a **vendor-level fact that resolves once**, not per case (e.g. PPL's Setting Assessment applies only if a vendor delivers services at its own business location rather than in-home; once determined, this is a fixed fact on the vendor's relationship with that funder, never re-asked per student). |
| Invoice mechanics | Required fields, format, aggregation grain (per-lesson / weekly / monthly, plus grouping by service/lesson type where a student has more than one concurrent enrollment with the same funder — e.g. piano and voice invoiced separately even at the same code and month; dates can be itemized within a coarser-grain invoice, not only used to pick the bucket), numbering constraints (e.g. unique per invoice, one service code per invoice) |
| Payment | Cadence as conditional logic — dollar-tiered (Mains'l: ≤$500 pays in 1 week, ≤$9,999.99 in 3, ≥$10k in 5) or **date/approval-gated** (ACE FMS: submitted 1st–15th + approved by the 18th → paid the 25th same month; submitted 16th–EOM + approved by the 3rd next month → paid the 10th next month — behavior if the approval deadline is missed is unstated by them and marked unknown, not guessed), cutoff schedule, approval gates (parent attestation), coverage caps, retry constraints, typical method **and, for card-based methods, who provisions the card** (family-held and vendor-charged, e.g. RAMP; or FMS-pushed directly to the vendor in a batch, e.g. On My Own's PEX cards) — this determines who owns the "no payment method" blocker, family or vendor, not just that one exists, known sender addresses. Where cadence depends on an approval event, that event's timestamp is captured as real data, not display-only text — it drives a computation, unlike the native-status passthrough (§6.4) which is cosmetic. |
| Capacity & limits | Vendor slot caps, per-family linking requirements (distinct from vendor-level approval) |
| Lifecycle | Renewal cadence; rename/rebrand handling (old vendor identity stays active until its invoices clear); vendor-doc reuse policy (see 6.5) |

**The placement rule — what goes in a profile vs. on a case:** *if a difference affects every vendor using an organization, it belongs in the organization profile; if it affects one family or one conversation, it belongs on the case.* ACE FMS's accepted-alternatives list is structural — profile. A rep's temporary instruction ("email invoices here while I'm covering for Susan") is variance — case note, expiring with the situation. Representatives are contacts, never business logic; per-field confirmed-by metadata is provenance on structural facts, not rep-specific rule variants. This single rule is what prevents the configuration system from exploding into unmaintainable micro-variants.

**Every field carries metadata:** source (AI-extracted / vendor-confirmed / parent-reported), confidence, last verified by/when. Parent-relayed rules (e.g. a requirement forwarded secondhand by a family) enter as low-confidence flags, never as overwrites — that channel demonstrably loses precision in transit.

**Profiles are versioned, never overwritten.** Every edit creates a new version with a change note. Any case or invoice records which profile version was active when it acted, so "why was this invoice formatted this way?" always has an answer ("profile v12 was active"), including after the org changes its rules.

**Stated vs. observed behavior are separate fields.** Aveanna states 30 business days; if observed reality averages 43, both numbers are kept and shown. Observed values (real days-to-pay, per funder) drive the Overdue threshold and accumulate automatically from case history — they are never hand-entered.

### 6.3 Case — one student × one funding organization

Not per family: authorizations and PO numbers are per child per funder, and siblings can sit on different programs.

**States: Discovery → Blocked → Active.**

- **Discovery** — the family named a funder with no profile yet. Resolve by building the profile (via the authoring flow, 8-Phase 3) or declining and logging why.
- **Blocked** — profile exists; the case can't invoice yet. Three owned sub-states, always shown distinctly so it's obvious whose court the ball is in:
  - *Vendor approval pending* — once per funder, not per student. Resolving it unblocks every case with that funder.
  - *Student linking pending* — per student, usually family-owned (e.g. adding the vendor inside the FMS portal; slot caps can block this on the funder's side). The system supplies the family the exact instruction from the profile rather than the vendor improvising it.
  - *Document task pending* — a one-off form, signature, or **payment credential** (e.g. entering an FMS-provisioned card, PEX/RAMP-style) whose content is unique to this case and can't be auto-generated. Assigned to vendor or family — credential entry is typically vendor-owned when a funder pushes the card directly rather than routing it through the family, as with On My Own's PEX cards; the point is to make "did we actually do this" a visible, assigned task instead of something that only surfaces when a Service Coordinator flags a downstream billing failure. Completed in-browser via scoped link, no account. See 6.6 for how one-offs relate to reusable templates.
- **Active** — invoicing proceeds.

Each case exposes a timeline (drill-down from the dashboard, vendor-facing only): creation, each blocker's resolution, every invoice with sent/paid dates. This is also where observed payment behavior accumulates.

### 6.4 Invoice — generated per billing cycle within an Active case

**Principle: CharterFlow generates compliant invoices from raw billing data; it does not ingest finished invoices.** Billing platforms produce a ledger (student, dates, amounts) and know nothing about funders. The pipeline: pull raw billing data → match to case (one-time student↔case mapping; the source platform has no notion of funder) → enrich from the case (service code, PO/auth number) and the profile (required fields, aggregation grain, numbering rules) → generate the document → deliver per the profile's recipient routing.

Raw data arrives in three tiers, designed as one generic interface from day one: a known platform's structured export (Opus CSV — a bridge, retired when ODEON's native billing ships in its Phase 4); a generic CSV import with a once-per-platform column mapping, reused across vendors on the same platform; or manual line-item entry, making CharterFlow the ledger of record where no system exists.

**States: Pending → Overdue → Rejected → Paid.** Action-oriented: Pending needs nothing, Overdue means follow up (threshold = that funder's *observed* window), Rejected means fix and resubmit, Paid closes it. There is deliberately no "sent" status — it records an event and implies no action. Paid is recorded manually with method metadata (ACH / check / prepaid card / VCC / cash, date, reference); automated detection is an accelerant added later (Appendix C), never a dependency.

**Native status passthrough — real funder granularity without exploding the model.** Some funders expose far more detail than four states (ACE FMS's own portal shows Draft, Pending Client Approval, Pending FMS Approval, Pending FMS Payment, Pending VCC Payment, Correction Needed, Client Rejected, FMS Rejected). None of this becomes new top-level states — every funder's dashboard must stay the same four-state shape, or the "one workflow, not forty" thesis breaks. Instead, capture the funder's own status text as a passthrough field alongside the normalized state (e.g. normalized: Rejected; native: "FMS Rejected"). Full fidelity preserved on drill-in, zero schema growth per funder added.

**Expected-pay-date calculator, where a funder publishes a deterministic formula.** Stronger than the observed-average approach (§6.2): when a funder states its cadence explicitly as a rule over known dates (ACE FMS's submission-window-plus-approval-deadline formula), CharterFlow computes an exact expected pay date rather than an estimate, the moment submission (and, once it happens, approval) are logged. Turns "waiting" into a visible, specific deadline — e.g. "approved by the 18th → paid the 25th" — surfaced to whoever needs to chase the approval, proactive rather than the reactive Overdue flag, which only fires after something is already late.

Every cadence rule seen so far among push-style funders (submit an invoice, wait to be paid), however different it looks, is one instance of the same shape: `expected_pay_date = funder_formula(submitted_at, approved_at, amount)`. Mains'l uses amount only; Aveanna and ACE FMS gate on approval, with different math once gated. `approved_at` is not new data invented for this — it's the same envelope-approval event (§6.5) already required for Mains'l's attestation and Aveanna's family-routed submission, now also feeding the cadence formula. New funders should be checked against this formula before anything is added to the schema: if a rule needs an input outside `submitted_at` / `approved_at` / `amount`, that is the actual signal the input set needs to grow — not a reason to add a per-funder workflow.

**This formula does not extend to `card-on-file-charge` routing (RAMP, UCP).** Push and pull are two genuinely different mechanisms, not one formula with different inputs: push waits for a funder to act, pull has the vendor act against a cap whenever they choose, so there is no `expected_pay_date` to compute — timing is the vendor's decision, not a fact to predict. The two mechanisms are cleanly separated by a single field, `recipient_routing`: three values (direct-to-FMS, portal, family-routed) get the formula; `card-on-file-charge` skips it entirely and uses cap-tracking and retry-constraint logic instead (§6.2). Two bounded mechanisms switched by one field, not a universal formula, is the accurate claim — the earlier framing overstated it.

**Split-payer invoices.** One bill can have two payer lines — the case's funder up to its coverage cap, and the family for the remainder — each with its own status. "Partially paid" is therefore a real, first-class condition (funder line Paid, family line Pending/Overdue), not an anomaly. Where a funder cap is known, the system should surface bill-shaping options before generation (discount allocation across siblings, amount timing) rather than leaving that optimization to be done by hand and documented nowhere — the same class of advice as cadence-vs-payment-tier guidance.

**Delivery for portal (manual entry) funders.** No document to generate and hand off; the vendor retypes the invoice into the funder's own form. The assist-mode panel (§6.6, originally designed for one-time onboarding documents) extends here, but populated by the already-computed invoice values from this pipeline, not static vault data, so the vendor copies correct, pre-formatted numbers field by field rather than reconstructing the invoice from scratch. Status has a real limit worth stating plainly: with no email confirmation or API from these funders, CharterFlow cannot automatically detect a status change inside their portal. V1 relies on the vendor updating status when they check it themselves, low marginal cost since submitting already requires being logged in there. Credential-based portal scraping is a possible later option but carries real cost (storing a vendor's third-party password) and fragility (breaks on any UI change) — not scoped now.

### 6.5 Envelopes and delivery

**Principle: one link per completion event; no portals, no logins, ever, for families or funders.** A single link opening one bounded action (complete this envelope, view this invoice) keeps blast radius small and matches how funders already operate — they receive email or use their own portal; they will not adopt a vendor's system.

- **Onboarding envelope** — one link, one session, containing every document due at that moment. The first case with a new funder bundles vendor-level docs (ACH, W-9, agreements) with that case's documents, mirroring how real packets arrive (Aveanna physically combines them).
- **Vendor-doc reuse is observed per funder, never assumed.** A document containing only vendor-level fields does not mean the funder's *process* accepts it once — that's their business rule, and it varies by rep. Default: include vendor docs in every new case's envelope (a redundant resend is harmless; a stalled case is not). Skip only after the profile records *confirmed reusable, by whom, when* — and revert to unknown if the funder ever asks again.
- **Recurring invoice links** — long-lived (default sized to the slowest known cadence plus reconciliation lag), scoped to a single invoice, never a student's history. Access-logged; revocation exists for leaks, not as routine.
- **Sequencing removes co-delivery questions:** a case can't have an invoice until it's Active, which requires its envelope completed — the two link types are never sent together.

### 6.6 Documents: one-off by default, promoted to template only by evidence

**Principle: every document requirement begins life as an ad-hoc task. CharterFlow promotes it to a reusable template only after repeated, human-confirmed use.** A wrong auto-fill on an unchecked form is a silent error; one extra manual fill is a minor cost. Mechanics: at upload, a structural check (does the file have real form fields?) routes genuinely fillable documents to template mapping regardless of recurrence. Flat/scanned documents get an in-browser click-to-place fill-and-sign task (Appendix B); on a second occurrence of the same named document from the same funder, whoever filled it first is asked whether to save those placements as a starting template — suggested, human-confirmed, never auto-promoted.

**Venue-mandated vs. artifact-mandated requirements.** Some funders dictate only the artifact ("complete, sign, and return this form") — the vendor controls the venue, and everything above applies. Others dictate the venue itself: their own DocuSign envelope, their vendor portal. CharterFlow never attempts to substitute its own version for a funder-mandated venue — that envelope is the funder's system of record and audit trail, and counter-offering an alternative asks them to change their process, the one thing this product must never require. For venue-mandated tasks, CharterFlow's role shifts from completion venue to completion support: **track** (the inbound link becomes a document task on the case, subject to Overdue like anything else, instead of dying in an inbox), **assist** (surface the vault values the form will ask for — EIN, registered entity name, license number, service code — beside the task; a cheat sheet, not an auto-fill), and **record** (the completed copy the venue emails back lands in the case's document hub, and the fact that this funder uses this venue for this step becomes profile knowledge). Which mode applies is a per-requirement profile field, observed from real correspondence, never assumed.

**Capture-and-carry-forward: what the external system hands back, not just what gets pushed into it.** A venue-mandated task often produces a new reference the funder's system generated, a PPL ID, a portal username, a confirmation number, that later steps with the same funder need. On completing a venue-mandated task, the vendor is prompted to record that reference; it's stored against the vendor-funder relationship (or the case, if it's case-specific, like a PPL ID) and surfaces automatically in every future cheat sheet for that funder, rather than being retyped from memory each time.

**Recorded walkthroughs, not a live embed.** A short screen-recording or annotated GIF of what an unfamiliar venue actually looks like (ACE FMS's vendor portal, PPL's "My Account") is cheap to capture once during profile authoring and removes real first-time confusion, no live integration or funder partnership required, just an asset attached to the profile like any other field. Same staleness discipline as everything else: it needs a last-verified date and a vendor-facing flag if a redesigned portal no longer matches what's recorded.

## 7. Security principles

- No public exposure of any document, ever. Invoices name a child tied to a disability-funded service; vault data (EIN, license) is impersonation raw material if scraped.
- Scoped links per single artifact, high-entropy, access-logged, revocable.
- Banking details are a higher tier: ACH-bearing envelopes expire fast (hours or first confirmed open, vs. the long invoice default); encrypt at rest minimum; decide deliberately whether raw account numbers are retained after delivery at all rather than defaulting to indefinite storage.
- Inbound email ingestion (Appendix C) is deferred partly for this reason: processing funder emails at scale means holding children's PHI-adjacent data as infrastructure — done deliberately when justified, not bundled early.

## 8. Build phases

Sequenced inside ODEON as its Phase 1 module (see PRODUCT.md); these are CharterFlow's internal stages. Each gate is a falsifiable test.

- **Phase 0 — Seed, not software. This phase is also the architecture validation.** Ten vendor interviews (mixed charter- and SDP-serving; walk one student from inquiry to final payment). Hand-build the five profiles from lived correspondence — deliberately against one shared schema, side by side. *Gate: can ~90% of the five organizations' differences be expressed as field values within the fixed schema and pipeline?* Differences absorbed as data (Aveanna's family routing became a routing value; Regional Center delays became case context — two stress tests passed so far) mean the abstraction holds: build the configurable engine. Differences that keep forcing new field groups or new pipeline stages mean it's breaking: stop before Phase 1 and find a different abstraction (possibly visibility/tracking-first rather than generation-first). *Nothing is coded until this gate is answered.*
- **Phase 1 — Vault, cases, generation, delivery.** The MVP of §4. *Gate: the redundant-refilling and formatting pain measurably disappears for Headliner.*
- **Phase 2 — Action states everywhere.** *Gate: the dashboard tells the vendor what to do today, not what happened.*
- **Phase 3 — Profile authoring pipeline.** AI drafts a profile from funder-published material; a human confirms per-field. This is where the business begins compounding — without it every new organization is manual work; with it every one is cheaper than the last. *Gate: time-to-onboard a new funding org falls materially with each one added.*
- **Phase 4 — Second vendor.** *Gate: coverage % (their funders already profiled at signup) trends up across successive vendors. Flat = consulting with software on top; stop and fix Phase 3 before vendor #3.*
- **Phase 5 — Family and funder surfaces.** Attestation click, family-routed submission, in-browser fill-and-sign — thin single-purpose link actions. Optional email-forward payment detection (Appendix C).

## 9. Explicitly deferred

- **Fund-holding / payout smoothing** (money transmitter or BaaS-partner territory, KYC/AML obligations). Real future direction; requires legal counsel before design work.
- **Funder-facing portals or accounts.** Adds friction on their side; links match observed behavior.
- **Funder self-service profile editing.** The right end state; not a v1 assumption.
- **Expansion beyond California charter/SDP.** Generalize only after this is solved here.

## 10. Known risks

- **Rule instability is often person-dependent, not policy-dependent.** Three ACE FMS reps gave three incrementally different answers. Per-field confidence/source metadata exists to surface this, not hide it.
- **Configuration explosion.** Modeling rep quirks and one-off variances as profile rules would create endless micro-variants nobody can maintain. Mitigation is the placement rule (§6.2): structural differences → profile; situational variance → case note. If profiles start accumulating rep-specific or family-specific entries, the rule is being violated.
- **Quiet scope narrowing to charter-only.** Happened repeatedly in drafting. In-scope decision is explicit; watch for regression.
- **Moat overclaim.** Fragmentation explains *underserved*, not *defensible*. Defensibility = switching costs + compounding profile data, and both only exist after volume.
- **Admin workload creep.** If any flow requires a human to touch more than a small bounded set of fields per event, that flow's design has failed — lazy-populate, AI-draft, confirm-only.
- **The family-access claim is unverified.** "Providers decline SDP families due to friction" was inference. It ships in no external material until vendor interviews substantiate it.

## 11. Success metrics

- **Coverage %** — share of a new vendor's funders already profiled at signup (rising = the library compounds).
- **Time to onboard a new funding organization** — first profile may take hours; the fiftieth should take minutes. If this curve doesn't fall dramatically, this is a services business — the metric exists to force that reckoning early.
- **Vendor admin hours and days-to-payment** vs. Phase-0 interview baselines.
- **Observed-vs-stated payment gap per funder** — proof the observed layer is accumulating real intelligence.

---

## Appendix — Implementation candidates

*Everything here is a suggestion the body doesn't depend on. Engineering may replace any of it.*

**A. Links & storage.** Object storage (S3-class) with pre-signed high-entropy URLs; per-link access log table; expiration policy per link type (invoice: long default sized to slowest cadence; ACH envelope: hours/first-open). No SharePoint/Laserfiche as infrastructure — enterprise document platforms solve internal records management, not per-transaction scoped delivery; at most a future push-integration target if a specific agency requires it.

**B. In-browser fill-and-sign.** PDF rendering via pdf.js or a commercial SDK (PSPDFKit/Apryse); click-to-place text/signature overlays; flatten to final PDF server-side on submit. AcroForm detection at upload decides template-mapping vs. click-to-place routing. This is a small e-sign product in miniature — scope it as its own Phase 5 line item.

**C. Email-forward payment detection (Phase 2+).** One ingest address per vendor (not per case); vendor sets a one-time mail rule forwarding known funder senders (from the profile). LLM parses forwarded confirmations (e.g. Mains'l's auto-reply states a processing date) and *proposes* a Paid match against open invoices by amount/date/reference — human-confirmed, never auto-applied. Deferred for both sequencing and data-custody reasons (§7).

**D. Profile authoring (Phase 3).** LLM extraction from funder-published PDFs/pages/correspondence into the 6.2 schema, each field tagged AI-extracted at draft confidence; the confirm pass is the wizard flow (small guided review, only low-confidence fields demand attention). Field placements from a first manual fill seed template suggestions per 6.6.

**E. Billing import tiers.** Opus CSV parser against its known columns (bridge — retire at ODEON native billing); generic CSV importer with per-platform saved column mappings stored as a shared library; manual line-item entry UI. One import interface, three sources.

**F. Payment method normalization.** Paid-event metadata (method/date/reference). Later: bank-linking (Plaid-class) to auto-suggest ACH matches by amount against open invoices — suggest, don't auto-mark.

**G. Vault autofill browser extension (venue-mandated forms, later phase).** For funder-mandated venues (their DocuSign, their portal) where server-side generation is impossible by definition, the password-manager pattern applies: a browser extension recognizes form fields on the third-party page and offers to fill them from the vault (EIN, entity name, address, ACH), human-reviewed before submit. Works without any funder cooperation because it operates client-side in the vendor's own browser. Not v1: a browser extension is its own product surface, and prefilled banking data in-browser raises the security bar (per-field user confirmation, no silent fills, domain allowlisting against phishing lookalikes). Until it exists, the cheat-sheet (§6.6 assist mode) covers the same need minus the typing.
