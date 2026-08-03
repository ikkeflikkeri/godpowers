# Architecture Antipatterns

## 1. Architecture Theater
Diagrams without load-bearing decisions. Boxes connected by arrows that
nobody can articulate the rationale for. Looks impressive; decides nothing.

**Fix**: For every box and every arrow, write the WHY. If you can't, delete it.

## 2. Cargo-Cult Cloud-Native
Kubernetes + Kafka + microservices for a 10-user CRUD app.

**Fix**: Match complexity to scale from PRD. If PRD says 1000 users by
month 6, monolith is fine. Don't import patterns from a scale you'll
never reach.

## 3. Stackitecture
Picking React + Postgres + Vercel and calling it architecture.

**Fix**: Architecture is system shape (services, boundaries, data flow).
Stack is tool selection. They're separate documents. Read /god-stack
after /god-arch, not instead of it.

## 4. "Scalable" Without Numbers
> "Our system is highly scalable."

**Fix**: Replace with quantification. "Handles 10K concurrent users at p99
< 200ms in a single region. Beyond that, we add read replicas (ADR-008)."

## 5. Resume-Driven Architecture
Choosing GraphQL/Kubernetes/Rust because they're trendy or because the
architect wants the experience, not because they fit.

**Fix**: Tie every choice to a PRD requirement. If you can't, drop it.

## 6. Paper-Tiger Architecture
Looks robust on paper. Breaks under first real load.

**Fix**: Every NFR gets a worst-case analysis. "Sustained 100 reqs/sec at
p99 < 200ms" needs a load test before launch, not after.

## 7. Hidden Single Points of Failure
Diagram shows redundancy at every layer EXCEPT one (the auth service, the
config server, the deploy bot).

**Fix**: For each container, ask "what happens if this dies?" If the answer
is "everything stops," it's a SPOF. Address it or document it.

## 8. ADR Without Flip Point
> "Decision: monolith. Rationale: simpler. Consequences: easier deploy."

**Fix**: Add the flip point. "Reverse this decision when [specific
condition]." Without it, the decision is forever and unfalsifiable.

## 9. Static-Only Architecture
Boxes and arrows, no time. The diagram says the API server talks to Postgres
and to Stripe. It never says in what order, so nobody notices that the OAuth
nonce is written before the token exchange and never cleaned up when the
exchange fails.

**Fix**: Draw an ordered interaction for every flow that crosses a trust
boundary or touches more than two containers, and mark the steps that write
state. Those are the steps a retry must not repeat.

## 10. Numbers Without Inputs
> "Handles 10K concurrent users at p99 < 200ms."

Real numbers derived from nothing. This one clears antipattern 4 (it is
quantified) and still decides nothing, because the load the target is measured
under was never written down. The first load test then argues about the test
instead of the result.

**Fix**: A capacity envelope. Inputs with sources, arithmetic from those inputs
to per-container load, and the name of the container that saturates first.

## 11. Happy-Path Architecture
Every arrow assumes the far end answers. No timeout, no retry stance, no
statement of what the user sees while Stripe is down. This is not antipattern 7:
the redundancy may be fine and every replica healthy: what is missing is the
caller's behavior when the answer does not come back.

**Fix**: For each dependency, write the timeout in seconds, the retry stance
with the key that makes the write idempotent, and the user-visible degraded
state. Then the backpressure limit and the rate the backlog drains at.
