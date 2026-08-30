# Product Repo Strategy

This document captures the current strategy for how **Hey, Cohen**, **BandOS**, and **CharterFlow** should relate to each other so we can keep building without losing context. The guiding idea is: these products can share **design DNA, domain ideas, and selected primitives**, but they should still feel like **distinct apps** in product framing, user flow, and portfolio presentation.

## Base rule

- **Hey, Cohen** stays in this current repo.
- **BandOS** should be a separate repo.
- **CharterFlow** should be a separate repo.

That gives each product room to evolve without forcing everything into one codebase or one product story.

## Why separate repos

Separate repos are cleaner for portfolio presentation, safer for parallel development, and better for product clarity. BandOS and CharterFlow may borrow from Hey, Cohen, but neither should feel like a hidden tab or feature branch of it. They need enough separation in branding, routes, UX language, and product narrative to stand as their own case studies.

## What can be shared or copied

These are good candidates to selectively copy from Hey, Cohen into new product repos:

- UI primitives
- design tokens / styles
- slide panel and list-detail interaction patterns
- notes interaction patterns
- contact and account-holder concepts
- messaging composition ideas
- generic AI route patterns

The rule is to copy **primitives and patterns**, not the whole application. New repos should inherit useful structure, but not unnecessary product baggage.

## What should not be tightly coupled

BandOS and CharterFlow should not depend on Hey, Cohen's full backend shape staying identical forever. They can stay conceptually aligned, but they should own their own product-specific data model, routes, and experience. If Hey, Cohen changes later, we can de-conflict intentionally instead of being trapped by accidental coupling.

## De-confliction rule

If products drift, we reconcile at the level of **shared concepts**, not every implementation detail. In practice, that means we care about staying aligned on ideas like people, guardians/account holders, notes, staff, and messaging behavior — not on forcing every repo to keep the exact same schema or field layout at all times.

## Portfolio rule

For portfolio purposes, each app must feel different in its center of gravity:

- **Hey, Cohen** = relationship orchestration and communications
- **BandOS** = band identity, coordination, and public presence
- **CharterFlow** = funded-student operations, compliance, and payment workflow

Shared DNA is good. Product blur is bad.

## BandOS — what to adhere to, and what to veer away from

BandOS should adhere to Hey, Cohen's strongest reusable primitives: clean admin UI patterns, lightweight notes flows, account-holder-aware contact thinking, and a clear human-centered tone. It should also preserve the idea that communication and context matter as much as raw records. But BandOS should intentionally veer away from Hey, Cohen's communications-first identity. For portfolio purposes, it needs to feel like a band-native product, not a CRM with a music skin. That means emphasizing bands as the core object, leaning into identity, rehearsal artifacts, curated public presence, and a more expressive front-end language. It can share internals, but its user-facing story should clearly say: this app helps a band become real.

## CharterFlow — what to adhere to, and what to veer away from

CharterFlow should adhere to the same discipline around clean workflows, human review over blind automation, thoughtful AI assistance, and reusable product primitives where they help. It should borrow the best structural habits from Hey, Cohen — clarity, modularity, and pragmatic AI — but it should veer away sharply in product character. CharterFlow is not about warmth, engagement, or creative group identity. It is about operational certainty: payer rules, case states, document handling, invoice preparation, routing, and payment visibility. For portfolio purposes, it should feel more like a focused operations and compliance tool than a communication product, even if some shared components under the hood came from the same ecosystem.

## Practical next step

When starting BandOS or CharterFlow, begin from a fresh repo and intentionally copy only the primitives that still make sense. If later we need to reconcile the products more deeply, we can do that deliberately instead of carrying accidental coupling from the start.