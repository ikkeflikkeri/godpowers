# Documentation Profile

Which documents a project needs is a function of the project, not a fixed
checklist. Derive the required documentation set from the signals intake already
produced, do not draft a document because a template exists, and do not skip one
a comparable project of this shape would need. A prototype does not get a
business-continuity plan; a regulated multi-tenant platform does not ship without
a threat model and a traceability record.

## Inputs (already detected, do not re-derive)

- Product form: web-application, api-service, cli-sdk, mobile-desktop, data-ml, or
  infrastructure-iac (from `lib/product-routing.selectProductForm`).
- Scale: prototype, internal-tool, funded-product, or enterprise (git and intent
  signals).
- Risk profile: balanced, security-critical, growth, or library.
- Regulatory overlays: GDPR, CCPA/CPRA, PIPEDA, HIPAA, PCI DSS, and accessibility
  obligations, owner-verified.

## Evidence states: what licenses a not-applicable row

The failure mode of a documentation profile is not a missing document. A missing
document is visible and arguable. It is **marking a document unnecessary without
ever deciding it was**, because an unexamined absence reads exactly like a
considered decision, and it is the row an auditor pulls first.

So every not-applicable row records the state of the evidence behind it.

| State | What the profile is saying | May it mark not-applicable? |
|---|---|---|
| `present` | the project has the thing | no, it selects the document |
| `absent` | this was checked and the thing is not there; the reason names what checked | yes |
| `by-design` | the project deliberately will not have the thing | yes |
| `unknown` | nobody looked, or the answer is not derivable from the signals | no |
| `hint` | something matched and it is not enough to decide on | no |

`unknown` is not `absent`, and conflating them is the whole point. "We did not
look" and "we decided this does not apply" read identically and have opposite
consequences a year later. A row whose state is `unknown` or `hint` becomes
required, or becomes an open question with a recommended default. One confidently
false not-applicable costs more trust than ten honest unknowns, because the
unknowns advertise themselves.

In brownfield mode an `absent` reason names the search that came back empty, not
just the conclusion. `by-design` needs no search: it records a decision.

## Tripwires: every not-applicable row carries its expiry

A reason explains the decision at the moment it was made. It does not reopen it.
A document correctly skipped at prototype scale stays skipped after the project
becomes a funded product, because nothing in the manifest can notice.

Every not-applicable row therefore carries a `revisit when` predicate: an
observable event that would make the document required again. The bar is the same
as a roadmap trigger. "Later", "eventually", "post-MVP", "if needed", and "TBD"
are refused, because none of them is an event anybody could notice.

```
| Incident response plan | not-applicable | by-design: no on-call rotation and no
production surface at prototype scale | revisit when: any deploy target other than
a local run enters the roadmap, or somebody is assigned to carry a pager |
```

`/god-reconcile` re-evaluates every tripwire on the way in and leads with the ones
now firing. That is the reason to run the manifest a second time, and it is what
makes a not-applicable row a decision with an expiry rather than a silence with a
reason attached.

## Lifecycle stage and durability

Two columns that change what a document is for and how it may be updated.

**Stage** is where a document first becomes load-bearing: `frame` (why does this
exist), `decide` (what did we choose), `design` (what shape is it), `build` (how
do I work on it), `verify` (how do we know it works), `assure` (how do we prove it
to an outsider), `operate` (how do we run it), `serve` (how does someone use it),
`govern` (how is the work managed), `retire` (how does it end). The stage list is
an ordering of first authorship, not a maturity ladder: a brownfield project has
`build` and `operate` documents years before anything in `frame`, and the manifest
reports the set rather than scolding the shape of the history.

**Durability** decides the update contract, and it has three values because two is
one short.

| Durability | Update contract | Examples in this profile |
|---|---|---|
| `durable` | edited in place by the task that changes the code | README, PRD, architecture, runbook, user guide |
| `evidence` | **never edited**; a new run produces a new dated artifact | post-mortems, operational readiness reviews, scan and audit outputs, release records |
| `transient` | written once, dated, abandoned | scratch investigation notes; never drafted as a deliverable |

Collapsing `evidence` into `durable` is the failure this split prevents. A
post-mortem is a snapshot of a moment, and editing it in place destroys the only
property that made it evidence, which is that it says what was true on a date.
`god-updater` and `/god-sync` sweep artifacts on every feature; both must treat an
`evidence` row as append-only. Key ADRs are `durable` but immutable in the same
sense: superseded by a new number, never rewritten.

## Lifecycle metadata on every drafted document

A document with no owner and no review contract rots silently, and missing
metadata kills document sets more often than missing document types. Every
required or recommended document carries, in frontmatter or a document-control
block:

```yaml
stage: operate
durability: durable
owner: <role, never a person's name in a public repository>
system_of_record: repo
status: draft
review_cadence: on-change | on-release | none
covers: [src/api/health.ts, ops/alerts.yaml]
```

`status` starts at `draft` on anything an agent generates; promotion is a human
act. `review_cadence` is taken from this profile, never invented; when it is
`none` the next review is a sentence, not a date, because a date implies a
calendar obligation nobody agreed to.

## Staleness is four verdicts, never one red light

```
drift-stale    = covers is non-empty AND a covered path changed since last verified
calendar-stale = review_cadence is not none AND the cadence has elapsed
expiry-stale   = an evidence row is past its retention or validity date
unverifiable   = covers is empty
```

Godpowers detects drift-stale today and nothing else. The other three are
independent and are never merged into one status. `unverifiable` is the honest
and expected state for most `frame` and `govern` documents: a business case and an
initiation brief have no code to hash, so reporting them as drift-stale is
theater, and a reader shown one piece of theater discounts the rest of the page.

## System of record, and the boundary statement

Every row carries `system_of_record`: `repo`, `product`, `org`, or `external`. A
document that lives in a wiki, an intranet, or a compliance platform is not
absent; it is somewhere this repository cannot see, and the honest verdict is
`present-elsewhere`, which asks rather than reports.

Any manifest rendered for a human states its boundary, whether or not anything
prompted it:

> This manifest covers documentation committed to this repository. Documents held
> in a wiki, an intranet, or a compliance platform are marked present-elsewhere.

One false "missing" for a document that already exists elsewhere discredits every
other row on the page.

## Verdict times state equals action

The verdict describes need. The state describes what the repository actually has.
The action is a lookup, not a judgement.

| | absent | present-current | present-drifted | present-stub | present-elsewhere |
|---|---|---|---|---|---|
| **required** | `draft` | `adopt` | `refresh` | `complete` | `confirm` |
| **recommended** | `offer` | `adopt` | `refresh` | `complete` | `confirm` |
| **optional** | `note` | `adopt` | `note` | `note` | `note` |
| **not-applicable** | `skip` | `orphan` | `orphan` | `orphan` | `skip` |

- `adopt` is the cheap win and the most common result on an existing repository:
  the document is fine and only lacks lifecycle metadata. Adopting costs a
  frontmatter block, not a drafting pass.
- `orphan` is a real result, not an error: a document the repository carries that
  nothing in the profile justifies. That is where doc rot starts, and
  `lib/linkage.js` reports orphan artifact IDs but nothing reports this. An orphan
  gets a row and a question, never a deletion task; deleting is a records decision
  and not one a documentation pass gets to make.

## How to build the manifest

1. Start from the scale row. It sets the baseline document set.
2. Apply the form modifier: add the form's required documents, mark documents the
   form makes irrelevant as not-applicable with a reason.
3. Apply the risk and regulatory modifier: elevate security, privacy, and
   continuity documents from recommended to required.
4. Tag every document required, recommended, optional, or not-applicable, each
   with the signal that set it, plus its stage, durability, owner, and system of
   record. Draft required documents; offer recommended ones. Every not-applicable
   row carries an evidence state, a reason, and a `revisit when` predicate.
   Multiple documents may live in one file for small projects.
5. Cross the verdict with what the repository already has and record the action.
   Report orphans. State the boundary.

## Scale baseline

| Document | prototype | internal-tool | funded-product | enterprise |
|---|---|---|---|---|
| README | required | required | required | required |
| Style genome (`CODEDNA.md`) | recommended | required | required | required |
| Product brief / vision | required | required | required | required |
| Key ADRs | recommended | required | required | required |
| PRD | optional | required | required | required |
| Architecture document | recommended | required | required | required |
| User stories + acceptance | optional | recommended | required | required |
| Test strategy | optional | recommended | required | required |
| Deploy + rollback plan | n/a | required | required | required |
| Operations runbook | n/a | recommended | required | required |
| Release notes / changelog | recommended | required | required | required |
| Security / threat model | conditional | recommended | required | required |
| Risk, assumption, dependency log | optional | recommended | required | required |
| Requirements traceability matrix | n/a | optional | required | required |
| Incident response plan | n/a | optional | required | required |
| User / admin guide | optional | recommended | required | required |
| Initiation brief (charter + business case + stakeholders/RACI) | n/a | optional | recommended | required |
| Closeout report + lessons learned | n/a | optional | recommended | required |

## Form modifier

- web-application: UX/UI design spec and user flows required; adds SEO and
  accessibility conformance where a public surface exists.
- api-service: API specification required; UX/UI documents not-applicable.
- cli-sdk: CLI or SDK reference required; UX/UI not-applicable.
- library: public API reference required; deploy, ops runbook, and launch reduced
  to recommended or not-applicable; the `library` risk profile applies.
- data-ml: data model and data dictionary elevated; evaluation and dataset
  documentation required.
- infrastructure-iac: operations runbook, deploy/rollback, and disaster-recovery
  references elevated; UX not-applicable.

## Risk and regulatory modifier

- security-critical or a verified regulatory overlay: promote security design and
  threat model, privacy and data-handling records, audit-logging documentation,
  and incident response to required; add the regulatory-overlay records (GDPR
  ROPA and DPIA, HIPAA BAA, PCI scope) named in the compliance standards.
- enterprise scale with regulated data: the initiation brief and closeout become
  required, and a service-level and business-continuity reference is expected
  even when this suite does not draft the full contract.

## Drafting ownership

Existing agents draft the manifest's documents; the orchestrator runs a document
drafter only when the manifest marks its output required or the user requests it.

| Document | Drafter |
|---|---|
| PRD, initiation brief | god-pm |
| Architecture, ADRs | god-architect |
| Roadmap, release plan | god-roadmapper |
| User stories + acceptance | god-storyteller |
| UX/UI design spec | god-designer |
| Security / threat model | god-harden-auditor |
| Deploy + rollback | god-deploy-engineer |
| Operations runbook, SLOs, incident | god-observability-engineer, god-incident-investigator |
| Release notes / launch | god-launch-strategist |
| README, contributing, dev standards, style genome (`CODEDNA.md`) | god-repo-scaffolder |
| Requirements traceability matrix, user/admin guide, general docs | god-docs-writer |
| Closeout report + lessons learned | god-retrospective |

## Governance documents (high-value set)

- Initiation brief: one document combining the project charter (problem,
  objectives, sponsor, high-level scope, timeline, approval), a business case
  (benefits, costs, alternatives, justification), and a stakeholder register with
  a RACI for major activities. Drafted by god-pm before the PRD when the manifest
  requires it. Small projects fold it into the product brief.
- Requirements traceability matrix: links each requirement to its design
  component, build task or slice, and verifying test, reusing the plan-aware
  R-id-to-check-to-task tracing. Drafted by god-docs-writer and kept current by
  god-updater. It is the single artifact that proves nothing was planned but not
  built, or built but not verified.
- Closeout report + lessons learned: delivered-versus-committed scope, unresolved
  items, handover status, outcomes and approvals, plus what worked, what failed,
  root causes, and actions for next time. Drafted by god-retrospective at
  milestone or project close.
- Style genome: the house style new code must match, at `CODEDNA.md`. Derived
  from the configs, then measured with `lib/style-stats.js`, then close-read;
  `references/building/STYLE-GENOME.md` is the contract. It is the one document
  in this profile that two agents already consume as an input (`god-executor`
  while editing, `god-quality-reviewer` while reviewing), which is why nothing
  producing it was a gap rather than a preference.

Governance documents are never certification or compliance theater; they capture
decisions, ownership, and outcomes so the project has continuity from the original
business need through production support.

## Evidence rows in this profile

These are `durability: evidence`. A sync or update pass may append a new dated
instance and may never rewrite an existing one:

- Post-mortems and incident records (drafted by god-incident-investigator).
- Operational readiness reviews and release records.
- Security scan, audit, and dependency-inventory outputs.
- Closeout reports, once approved at milestone close.

Key ADRs are `durable` but immutable in the same sense: a decision that changes
gets a new ADR number that supersedes the old one, and the old file stays where it
is, because a citation written last year has to keep resolving to the same
decision.
