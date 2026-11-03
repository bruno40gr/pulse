# Service catalogue model — proposal (not implemented)

Status: **proposal only.** Nothing here is built. It records the agreed direction
and the current problem so the work can be picked up with context. Filtering by
these dimensions is blocked on this model; the Contacts filter drawer currently
reflects the existing catalogue, which is why it reads as a list of one-offs.

## The problem

The imported catalogue encodes several independent axes as one enumerated
"service type". Every combination becomes its own record:

- level × instrument × duration each mint a new service type;
- instructors are manually assigned per service type;
- two payment-plan variants are duplicated per type;
- a makeup needed "Makeup of [the whole previous type]" — another full type.

Consequences: the catalogue grows multiplicatively, the same teaching
arrangement appears many times, and any filter has to be expressed in opaque
service names rather than in the terms staff actually use.

## Target model — dimensions, not names

A service is the **combination** of axes, resolved at enrollment. It is not a
catalogue row per combination.

| Axis | Values | Notes |
| --- | --- | --- |
| **Service** (format) | Private · Semiprivate · Group | Owns which programs are valid. |
| **Program** | Depends on Service | Private/Semiprivate → instrument (Piano, Voice, Guitar, Drums…). Group → branded programs (Tiny Keys, Little Rockers, Band). |
| **Duration** | e.g. 30 / 45 / 60 minutes | Independent axis, not part of the name. |
| **Level** | e.g. beginner → advanced | Applies where it is meaningful; confirm for group programs. |
| **Payment plan** | e.g. weekly / fortnightly | A pricing axis orthogonal to the service. |
| **Instructor** | Assignment, not a field | Who teaches this service/student. A departure is an assignment change, never a catalogue migration. |
| **Makeup** | Session attribute | A makeup *of* a missed session (reason + link to it). Never a service type. |

Open questions before implementation:

- Which programs are valid for each Service, and who owns that list?
- Does Level apply to every group program, or only some?
- Which payment plans are eligible per Service/Duration, and how does that
  interact with funding?
- How do existing enrolled students map onto the new axes, and what is the
  compatibility window for the old service types?

## Consequences

- **Filters** become Service → Program → Duration/Level, with Program options
  driven by the selected Service. "Makeup" becomes a session filter, not a
  service name.
- **Enrollment** composes a service instead of picking from an ever-growing list.
- **Pricing** attaches to the plan axis rather than being duplicated per type.
- **Migration** keeps the existing service types as a compatibility mapping while
  the axes are populated; nothing is deleted until every enrollment resolves.

This is a data-model, enrollment and pricing change. It must not ride along with
table or toolbar work.
