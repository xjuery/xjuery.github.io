---
title: "The Domain Driven Design fundamentals: where the domain rules and the code follows"
date: 2026-08-09T11:42:17+02:00
tags: [architecture]
featured: false
draft: true
summary: "Eric Evans' big blue book in one post: ubiquitous language, bounded contexts, and the tactical building blocks — and why the strategic half is the one that pays."
---

In 2003, Eric Evans published *Domain-Driven Design: Tackling Complexity in
the Heart of Software* — the "big blue book". Its thesis is simple and still
radical: the hardest part of most software is not the technology, it's the
*domain* — the business rules, the vocabulary, the edge cases the experts
carry in their heads. So the domain should drive the design, and the code
should follow.

Twenty years later, DDD is often reduced to a folder layout and a bag of
patterns. The patterns matter, but they're the second half of the book. The
first half — language and boundaries — is where the value is.

## Ubiquitous language: one vocabulary, everywhere

The foundation of DDD is not a diagram, it's a *glossary*. The domain
experts and the developers agree on one language — the **ubiquitous
language** — and use it everywhere: in conversation, in documents, in tests,
and in the code itself.

If the business says *policy*, the class is `Policy`, not
`InsuranceContractRecord`. If the business distinguishes a *quote* from an
*order*, the code has two types, not one `Order` with a `status` flag. The
test is brutal and useful: read a use case aloud to a domain expert. If you
have to translate as you go, your model has drifted.

> When the language in the code diverges from the language of the business,
> every conversation becomes a translation — and every translation loses
> information.

## Bounded contexts: one model can't rule them all

The classic mistake is trying to build *the* enterprise-wide model: one
`Customer` class to serve billing, shipping, and support. It ends up with
forty fields, and every team is afraid to touch it.

DDD's answer is the **bounded context**: an explicit boundary inside which
a model — and its ubiquitous language — is consistent. The same real-world
concept can, and should, be modeled differently in each context:

| Context   | "Customer" means…                          |
|-----------|--------------------------------------------|
| Sales     | A lead with a pipeline stage and an owner   |
| Billing   | A legal entity with a VAT number and terms  |
| Shipping  | A name and a validated delivery address     |
| Support   | A ticket history and an SLA tier            |

Contexts talk to each other through explicit relationships — a shared
kernel, a customer/supplier arrangement, or most often an
**anticorruption layer**: a translation layer that keeps another context's
model (or a legacy system's) from leaking into yours. Drawing the contexts
and their relationships gives you a **context map** — the most useful
architecture diagram most teams never draw.

## The tactical building blocks

Inside a bounded context, DDD names the pieces the model is built from.

### Entities and value objects

An **entity** has an identity that persists through change: `Order #42` is
the same order after its address is corrected. A **value object** has no
identity — it *is* its attributes: two `Money(10, EUR)` are
interchangeable, immutable, and freely copied.

Most codebases have far too many entities and far too few value objects.
Money, date ranges, addresses, quantities — modeling these as immutable
values with their own behavior removes entire categories of bugs.

```go {filename="internal/domain/money.go"}
package domain

// Money is a value object: immutable, compared by value,
// and it enforces its own invariants.
type Money struct {
	amount   int64 // cents
	currency Currency
}

func (m Money) Add(other Money) (Money, error) {
	if m.currency != other.currency {
		return Money{}, ErrCurrencyMismatch
	}
	return Money{m.amount + other.amount, m.currency}, nil
}
```

### Aggregates: the consistency boundary

An **aggregate** is a cluster of entities and values that changes as one
unit, guarded by a single entry point — the **aggregate root**. Outside
code holds a reference to the root only, and every change goes through it,
so the root can enforce the invariants.

```go {filename="internal/domain/order.go"}
package domain

type Order struct { // aggregate root
	id    OrderID
	lines []OrderLine
	total Money
}

// AddLine is the only way to grow the order —
// the invariant "total matches the lines" can't be bypassed.
func (o *Order) AddLine(p Product, qty int) error {
	if qty <= 0 {
		return ErrInvalidQuantity
	}
	line := NewOrderLine(p, qty)
	o.lines = append(o.lines, line)
	o.total, _ = o.total.Add(line.Subtotal())
	return nil
}
```

The design rule that follows: **keep aggregates small**, and reference
other aggregates by ID, not by object. One aggregate = one transaction; if
you need to update two aggregates atomically, your boundaries are probably
wrong — or you need a domain event.

### Repositories, domain services, domain events

- **Repositories** give the illusion of an in-memory collection of
  aggregates (`orders.Find(id)`, `orders.Save(order)`), hiding the
  database. One repository per aggregate root — not per table.
- **Domain services** hold business logic that doesn't belong to any single
  entity — a pricing policy that weighs the customer, the cart, and the
  season. If it's stateless and speaks pure domain language, it's a domain
  service; if it talks to the database, it isn't.
- **Domain events** record that *something happened*, in the past tense:
  `OrderPlaced`, `PaymentReceived`. They decouple aggregates from each
  other and give bounded contexts a natural way to communicate.

## DDD and the architecture diagrams

DDD says nothing about circles or hexagons — it predates both diagrams'
fame and slots neatly into them. In
[hexagonal architecture](/posts/hexagonal-architecture/) terms, the domain
model lives inside the hexagon; in
[Clean Architecture](/posts/clean-architecture/) terms, entities and value
objects are the innermost circle and repositories are interfaces defined
there, implemented outside. The architectures protect the model; DDD is
about what the model *says*.

## How teams get it wrong

- **Tactical-only DDD.** Adopting `Entity`, `ValueObject`, and `Repository`
  base classes while skipping the ubiquitous language and bounded contexts.
  You get the ceremony without the insight — the patterns exist to serve
  the model, not the other way around.
- **The anemic domain model.** Entities as bags of getters and setters,
  with all the logic in "service" classes. That's a data model with extra
  steps; the whole point is that `order.AddLine(...)` enforces the rules
  itself.
- **DDD everywhere.** Evans is explicit: DDD pays off in the *core domain*,
  the part where your business actually competes. The CRUD admin screens
  and the generic subdomains don't need aggregates — buy them, generate
  them, or keep them boring.

> Domain-Driven Design is not a layer cake to copy — it's a discipline:
> let the people who know the business shape the model, give each model a
> boundary, and make the code speak the same language as the domain. The
> domain takes the wheel; the code follows.
