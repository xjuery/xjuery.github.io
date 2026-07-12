---
title: "The Clean Architecture (Robert C. Martin): keep your code clean, your conscience cleaner"
date: 2026-07-26T15:23:44+02:00
tags: [architecture]
featured: false
draft: true
summary: "Uncle Bob's four circles and the one rule that holds them together. What the Dependency Rule actually buys you, and how to adopt it without drowning in DTOs."
---

In 2012, Robert C. Martin — "Uncle Bob" — published a blog post that
distilled twenty years of layered-architecture ideas (Hexagonal, Onion,
BCE…) into one diagram and one rule. The 2017 book *Clean Architecture*
expanded it, but the heart of the pattern still fits on a napkin: four
concentric circles, and every dependency pointing toward the center.

![Robert C. Martin, surrounded by computers](/images/posts/clean-architecture/uncle-bob.jpg)
{width="300"}

## The four circles

![The Clean Architecture diagram: Entities at the center, wrapped by Use Cases, Interface Adapters, and Frameworks & Drivers, with dependencies pointing inward](/images/posts/clean-architecture/clean-architecture-circles.svg)
{width="560"}

From the inside out:

- **Entities** — enterprise business rules. The objects and invariants that
  would exist even if there were no application at all: an `Invoice` must
  balance, a `Reservation` can't overlap. Pure logic, zero dependencies.
- **Use Cases** — application business rules. They orchestrate entities to
  accomplish something a user wants: *place an order*, *cancel a
  subscription*. This circle defines the interfaces it needs from the
  outside world, and knows nothing about how they're implemented.
- **Interface Adapters** — translators. Controllers convert HTTP requests
  into use-case calls; presenters convert use-case results into view
  models; gateways convert domain objects into rows. All the format
  conversion lives here, in both directions.
- **Frameworks & Drivers** — the web framework, the database, the message
  broker, the UI toolkit. Uncle Bob's point: this circle is *detail*. You
  write as little code here as possible, and none of it matters to the
  business.

## The one rule

> **The Dependency Rule**: source-code dependencies must point only inward,
> toward higher-level policy. Nothing in an inner circle may know that an
> outer circle exists — not a class name, not a function, not a data
> format.

Everything else in the book is commentary on this rule. The circles aren't
sacred — Martin says himself you may need more than four. The rule is
sacred. An entity that imports the ORM breaks it; a use case that returns
the web framework's `Response` type breaks it; a domain object with JSON
annotations is quietly leaking the outermost circle into the innermost one.

## Crossing the boundary without breaking the rule

Control flows outward-in (a controller calls a use case), but sometimes the
use case must call *outward* — persist something, notify someone. Pointing
a source-code dependency outward is forbidden, so you invert it: the use
case defines the interface, the outer circle implements it.

```go {filename="internal/usecase/cancel_subscription.go"}
package usecase

// Defined here, in the inner circle. Implemented outside.
type SubscriptionRepo interface {
	Find(id string) (*entity.Subscription, error)
	Save(*entity.Subscription) error
}

type Notifier interface {
	SubscriptionCancelled(sub *entity.Subscription)
}

type CancelSubscription struct {
	repo     SubscriptionRepo
	notifier Notifier
}

func (uc *CancelSubscription) Execute(id string) error {
	sub, err := uc.repo.Find(id)
	if err != nil {
		return err
	}
	if err := sub.Cancel(); err != nil { // entity enforces its rules
		return err
	}
	if err := uc.repo.Save(sub); err != nil {
		return err
	}
	uc.notifier.SubscriptionCancelled(sub)
	return nil
}
```

At runtime the call goes from the use case to Postgres; at compile time the
dependency arrow points the other way. That inversion — plain old
dependency-inversion principle applied at every boundary — is the entire
mechanical trick behind the diagram.

## Where does this code go?

| You're writing… | It belongs in… |
|-----------------|----------------|
| "An order total can't be negative" | Entities |
| "Placing an order reserves stock, then emails a receipt" | Use Cases |
| Mapping JSON to a use-case request struct | Interface Adapters |
| The SQL query, the HTTP router, the Kafka consumer config | Frameworks & Drivers |

If you hesitate, ask who would care if it changed. The CFO cares about the
first row. Nobody outside the engineering team should even notice the last
one changing.

## Clean, Hexagonal, Onion: pick a diagram, keep the rule

Clean Architecture is not a competitor to
[hexagonal architecture](/posts/hexagonal-architecture/) — it's the same
idea drawn with more circles. Hexagonal says *inside vs outside, connected
by ports*; Onion adds concentric layers; Clean names the circles and
sharpens the rule. If your team already thinks in ports and adapters,
you're 90% there; the extra value of Uncle Bob's version is the vocabulary
for *what's inside the hexagon* (entities vs use cases) and the insistence
that the rule matters more than the picture.

## How teams get it wrong

- **Folder cosplay.** Creating `entities/`, `usecases/`, `adapters/`
  directories around code whose dependencies still point every which way.
  The rule lives in the import graph, not the directory tree. (Martin's
  own tip: your top-level structure should *scream the domain* — `billing/`,
  `catalog/` — not the architecture book you read.)
- **DTO inflation.** Four circles don't require four copies of every
  struct. Add a mapping when a boundary needs protecting, not by reflex.
  A ten-entity CRUD app with forty mapper classes didn't get cleaner — it
  got longer.
- **All-or-nothing adoption.** The Dependency Rule pays per boundary. Start
  by freeing your use cases from the framework; leave the rest coupled
  until it hurts. A partially clean architecture that ships beats a pure
  one that doesn't.

> Clean code is what you owe the next reader. A clean *architecture* is
> what you owe the reader five years from now, who needs to change the
> database without touching the rules — or the rules without touching the
> database.

---

*Photo: [Robert C. Martin](https://commons.wikimedia.org/wiki/File:Robert_C._Martin_surrounded_by_computers_(cropped).jpg)
by Angelacleancoder (CC BY-SA 4.0), via Wikimedia Commons. Diagram: own
rendering, after Robert C. Martin's original.*
