# Architecture Anatomy

> What a strong architecture document looks like. Every decision has a
> flip point. Every NFR maps to a choice.

## 1. Options Considered

Record the system shapes evaluated before choosing the context and containers.
Seed the obvious shape as a labeled baseline and allow it to win. Give every
rejected shape a specific reason tied to a PRD NFR or ADR. Keep trap-flagged
shapes in the table as `[HYPOTHESIS]`, with their scores demoted for the hidden
cost. Name a real tradeoff on the selected shape so the table does not flatter
its own choice. Novelty is not a scoring axis.

## 2. System Context (C4 Level 1)

A diagram showing the system + external actors and systems.

**What good looks like**: every arrow labeled with data flowing and protocol.

```
[User browser] --HTTPS, OAuth flow--> [MRR Tracker]
[Stripe webhooks] --HTTPS, signed payloads--> [MRR Tracker]
[MRR Tracker] --SMTP, daily digest--> [Email user]
[MRR Tracker] --HTTPS--> [Stripe API]
```

## 3. Container Diagram (C4 Level 2)

Major runtime containers with single responsibilities.

```
[Browser SPA] <--HTTPS--> [API Server (Node)]
                                   |
                                   v
                            [Postgres (managed)]
                                   |
                                   v
                            [Worker (BullMQ)]
                                   |
                                   v
                            [Stripe Sync Job]
```

| Container | Single Responsibility |
|-----------|----------------------|
| Browser SPA | Render dashboard, OAuth flow init |
| API Server | Auth, query data, serve dashboard endpoints |
| Postgres | Store user accounts, encrypted Stripe tokens, MRR snapshots |
| Worker | Async Stripe sync, daily digests |
| Stripe Sync Job | Pull Stripe events, compute MRR breakdown |

## 4. Critical Flows

The container diagram says what exists. It does not say what happens, in what
order, or where the work can stop halfway. Draw an ordered interaction for every
flow that crosses a trust boundary or touches more than two containers.

**What good looks like**: every step numbered and attributed to a caller and a
callee, with the steps that write state marked, because those are the steps a
retry must not repeat.

```
OAuth connect (crosses the Stripe boundary, touches 4 containers)

1. Browser SPA  -> API Server    GET /connect/stripe
2. API Server   -> Postgres      WRITE oauth_state (nonce, 10 min TTL)
3. API Server   -> Browser SPA   302 to the Stripe authorize URL
4. Stripe       -> API Server    GET /callback?code&state
5. API Server   -> Postgres      READ oauth_state, delete on match
6. API Server   -> Stripe API    POST /oauth/token (code for refresh token)
7. API Server   -> Postgres      WRITE stripe_account (token encrypted)
8. API Server   -> Worker        ENQUEUE initial_sync(account_id)
9. API Server   -> Browser SPA   302 to /dashboard?connected=1
```

| Flow | Crosses | Writes at | Fails visibly at |
|------|---------|-----------|------------------|
| OAuth connect | Stripe boundary | 2, 5, 7 | 4 (the founder lands on an error page) |
| Nightly MRR sync | Stripe boundary | 7 | nowhere (silent; see section 9) |
| Daily digest | SMTP boundary | none | nowhere (fire and forget) |

The flow that fails visibly nowhere is the one to read hardest. If a row says a
flow fails silently, section 9 owes it a way to be noticed.

Minimum bar: every journey named in the PRD, plus every flow that writes across
a boundary. A one-step flow is a one-line row; the row costs little and its
absence is invisible.

## 5. Architecture Decision Records (ADRs)

For each load-bearing decision:

### ADR-001: Monolith vs Microservices

**Context**: We need to ship V1 in 8 weeks with a solo founder. Scale
expectations are 1000 concurrent users by month 3.

**Decision**: Monolithic Node.js API with a single worker process.

**Rationale**: At 1000 users, complexity of microservices outweighs the
operational benefit. Solo founder can't afford the deploy/observability
overhead of multiple services.

**Flip point**: If we hit 10,000 concurrent users OR we add a second
team that needs independent deploy cadence, split the worker into a
separate service first.

**Consequences**:
- Easier: deploy, debug, develop locally
- Harder: scaling specific bottlenecks (e.g., the Stripe sync) independently

### ADR-002: Postgres vs MongoDB

**Context**: Data is structured (users, accounts, MRR snapshots). Queries
are mostly OLAP (time-series aggregations).

**Decision**: Postgres.

**Rationale**: Strong typing, mature OLAP support via materialized views,
team familiar with SQL.

**Flip point**: If we add document-shaped data (e.g., user-defined custom
metrics with arbitrary schemas), revisit.

**Consequences**:
- Easier: migrations, complex aggregations, integrity
- Harder: schema-less data (we'd have to use JSONB columns)

## 6. NFR-to-Architecture Map

Every NFR from the PRD MUST appear here.

| PRD NFR | Architectural Choice | ADR Reference |
|---------|---------------------|---------------|
| p99 dashboard load < 2s | Materialized views for MRR breakdown; cache layer in API; SPA only fetches deltas | ADR-002, ADR-005 |
| 99.9% uptime | Managed Postgres (auto-failover); single API server with automated restart; health check endpoint | ADR-003 |
| 10,000 users by month 6 | Monolith handles up to ~5000; split worker first when needed | ADR-001 |
| OAuth tokens encrypted at rest | Postgres pgcrypto extension; encryption key in secrets manager | ADR-006 |
| No Stripe API keys stored | We use OAuth (refresh tokens only); never the API key directly | ADR-007 |

If an NFR has no row here: that's a have-not failure (A-03).

## 7. Capacity Envelope

The NFR map says what the system must hit. This says what it will be asked to
do, and where those numbers came from. "p99 dashboard load < 2s" is
unfalsifiable until someone writes down how many requests per second the p99 is
measured over.

| Input | Today | At the PRD horizon | Source |
|-------|-------|--------------------|--------|
| Connected Stripe accounts | 0 | 10,000 (month 6) | PRD success metric |
| Dashboard loads per account per day | n/a | 3 | [HYPOTHESIS] morning, noon, night; validate at 100 accounts |
| Stripe events per account per day | n/a | 400 | Stripe export from a 20-customer account, scaled |
| Snapshot rows per account per year | n/a | 365 | one per account per day, by design |

Derived, per container:

| Container | Derived load | Headroom on the chosen shape |
|-----------|--------------|------------------------------|
| API Server | 30k loads/day = 0.35 rps mean, 4 rps peak hour | three orders of magnitude |
| Worker | 4M events/day = 46/s sustained | roughly 2x on one process |
| Postgres | 3.65M rows/year, about 400 MB with indexes | fits RAM on the smallest managed tier for 3 years |

**Saturates first**: the Worker, at roughly 2,000 connected accounts. That
number, not "10,000 users", is what ADR-001's flip point should name.

Rules:
- Every number is an input with a source, or arithmetic over inputs with
  sources. A number with neither is a guess wearing a table.
- A guessed input is fine when it is labeled `[HYPOTHESIS]` and carries the plan
  that validates it. An unlabeled guess is not.
- Name the container that saturates first. An envelope that does not identify
  the binding constraint has not been read by its own author.

This section is where A-05 gets its numbers and A-12 gets its worst case. The
NFR map states targets; this states the load those targets are measured under.
The frequency annotation on each C4 Level 1 arrow (section 2) is an input to
this table, not a separate claim; if the two disagree, one of them is wrong.

## 8. Trust Boundaries

```
[User Browser] (untrusted)
    |
    | === BOUNDARY: OAuth bearer token, validated per request ===
    |
[Our API Server] (trusted)
    |
    | === BOUNDARY: Stripe API key from secrets manager, never logged ===
    |
[Stripe API] (trusted external)
```

For each boundary:
- Auth method: how identity is established
- Data classification: what flows across (sensitive vs public)
- Failure mode: what happens if the boundary is breached

## 9. Failure and Degradation

Section 8 covers what happens when a boundary is breached. This covers what
happens when the thing on the other side is slow, down, or answering wrong.
Both are failures of the same edge. Only one of them is a security event, and
the other one is the one that happens on a Tuesday.

For each external dependency, and each internal container whose loss is partial
rather than total:

| Dependency | Timeout | On failure | Idempotent | User sees |
|------------|---------|------------|------------|-----------|
| Stripe API (sync) | 10s connect, 30s read | 3 retries, backoff to 4 min, then dead-letter | Yes: upsert keyed on Stripe event id | "Last synced 4h ago" on the dashboard |
| Stripe API (OAuth) | 10s | No retry; the nonce is single-use | No | Error page with a retry link |
| Postgres | 5s statement timeout | Fail the request; the pool already retried the connect | n/a | 503 with Retry-After |
| SMTP (digest) | 20s | 2 retries, then drop and log | No: a duplicate digest is worse than a missing one | Nothing; the digest does not arrive |

Then the two questions the table cannot answer:

**Backpressure**: above 10,000 queued jobs the Worker rejects new syncs instead
of enqueuing them, and the dashboard serves the last snapshot. A queue with no
rejection point is an outage with a delay in front of it.

**Recovery**: after a Stripe outage the dead-letter queue drains at a capped 10
jobs/sec, so the recovery does not become the second incident.

Then the question about our own containers. For each one in section 3, ask what
happens if it dies:

| Container | If it dies | Verdict |
|-----------|-----------|---------|
| API Server | Everything stops | SPOF. Accepted: managed restart, 60s worst case, and the PRD asks for 99.9% not 99.99% |
| Worker | Syncs stall, dashboard serves stale snapshots | Degrades, does not stop |
| Postgres | Everything stops | SPOF. Addressed: managed auto-failover (ADR-003) |

Every "everything stops" row is either addressed or accepted with the blast
radius written down. A SPOF nobody named is the one that gets found at 3am.

Rules:
- Every dependency gets a timeout with a number on it. "A reasonable timeout" is
  the default timeout, which in most clients is no timeout.
- Every retry declares whether the operation is idempotent, and on what key. A
  retry over a non-idempotent write is a duplicate-charge bug that has not
  happened yet.
- Every degraded state names what the user sees. "Degrades gracefully" with no
  described user-visible state is an error page nobody has looked at.
- Every container whose death stops everything is addressed or accepted in
  writing. "Accepted" is a real answer; silence is not.

## 10. Data Model

```
User (1) -- (N) StripeAccount
StripeAccount (1) -- (N) MRRSnapshot
MRRSnapshot {date, mrr, new_mrr, expansion_mrr, churn_mrr, contraction_mrr}
```

| Entity | Owner Service | Consistency Model |
|--------|---------------|-------------------|
| User | API Server | Strong (single Postgres) |
| StripeAccount | API Server | Strong |
| MRRSnapshot | Worker writes, API reads | Eventually consistent (sync lag <1h) |

## 11. Required Format

Every claim must be labeled. Examples:

> [DECISION] We use Postgres because the data is structured and queries
> are OLAP-shaped.
>
> [HYPOTHESIS] BullMQ will handle our worker volume; if we exceed 1000
> jobs/sec we'll need to evaluate alternatives. Validation plan:
> load test before launch.
>
> [OPEN QUESTION] Where do we store OAuth state during the redirect?
> Owner: architect. Due: before /god-build.
