---
title: "Hexagonal architecture: the fundamentals of an application that lasts"
date: 2026-07-19T15:08:12+02:00
tags: [architecture]
featured: false
draft: true
summary: "Alistair Cockburn's ports & adapters pattern, minus the buzzwords: keep the business logic in the middle, push the frameworks to the edge, and your app will outlive its database."
---

Frameworks come and go. Databases get swapped. The REST API you expose
today becomes a gRPC service, then an event consumer. The only part of your
application that deserves to survive all of that is the business logic —
and in most codebases, it's precisely the part that can't move, because
it's welded to the controllers, the ORM, and half a dozen SDKs.

Hexagonal architecture — formalized by Alistair Cockburn around 2005, and
also called **ports & adapters** — is the simplest mental model I know for
avoiding that trap.

## The problem it solves

The classic three-layer application (controller → service → repository)
promises separation but rarely delivers it. The domain "service" imports
the ORM's entities, returns the web framework's response types, and knows
which SQL dialect it's talking to. Test it, and you're booting a database.
Replace the delivery mechanism, and you're rewriting business rules.

Cockburn's observation: the interesting boundary is not between horizontal
layers, but between **inside** (your application's logic) and **outside**
(everything that talks to it or that it talks to).

## The idea: an inside, an outside, and a border

Picture the application core as a hexagon. Inside: the domain — entities,
rules, use cases. Nothing else. Outside: the UI, the database, the message
bus, the test harness, the CLI. On the border sit the **ports**, and each
piece of the outside world plugs into a port through an **adapter**.

![Hexagonal architecture diagram: the application core surrounded by its ports, with UI, database, notification and CLI adapters plugged in from the outside](/images/posts/hexagonal-architecture/hexagonal-architecture.svg)
{width="440"}

The number of sides means nothing, by the way — Cockburn picked a hexagon
so there'd be room to draw several ports. It could have been an octagon.

## Ports: who drives whom

A **port** is an interface defined by — and owned by — the core. It comes
in two flavors:

| Kind | Also called | Who initiates | Examples |
|------|-------------|---------------|----------|
| **Driving** | Primary, left side | The outside calls the core | HTTP handler, CLI, message consumer, test |
| **Driven** | Secondary, right side | The core calls the outside | Database, mail sender, payment gateway, clock |

An **adapter** is the piece of glue that implements a driven port (a
Postgres repository, an SMTP notifier) or that translates an outside
stimulus into a call on a driving port (an HTTP controller mapping JSON to
a use-case method).

## A concrete example

The core defines a use case and *declares* what it needs — an interface. It
has zero imports from any framework:

```go {filename="internal/core/subscribe.go"}
package core

type Subscriber struct {
	Email string
}

// Driven port: the core owns this interface,
// the adapter implements it.
type SubscriberStore interface {
	Save(s Subscriber) error
	Exists(email string) (bool, error)
}

// Driving port: what the outside world may ask of us.
type SubscribeUseCase struct {
	store SubscriberStore
}

func NewSubscribeUseCase(store SubscriberStore) *SubscribeUseCase {
	return &SubscribeUseCase{store: store}
}

func (uc *SubscribeUseCase) Subscribe(email string) error {
	if !validEmail(email) {
		return ErrInvalidEmail
	}
	exists, err := uc.store.Exists(email)
	if err != nil {
		return err
	}
	if exists {
		return ErrAlreadySubscribed
	}
	return uc.store.Save(Subscriber{Email: email})
}
```

The adapters live at the edge and depend on the core — never the reverse:

```go {filename="internal/adapters/postgres/store.go"}
package postgres

// Implements core.SubscriberStore with database/sql.
// The core never knows Postgres exists.
type Store struct{ db *sql.DB }

func (s *Store) Save(sub core.Subscriber) error {
	_, err := s.db.Exec(
		"INSERT INTO subscribers (email) VALUES ($1)", sub.Email)
	return err
}
```

```go {filename="internal/adapters/http/handler.go"}
package http

// Driving adapter: translates HTTP into a use-case call.
func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	err := h.useCase.Subscribe(r.FormValue("email"))
	// ... map domain errors to status codes
}
```

> The dependency rule is the whole pattern: **source-code dependencies
> point inward, only inward, always inward.** The core defines interfaces;
> the edge implements them.

## Testing is where it pays off first

Because every dependency of the core is an interface the core owns, tests
plug fakes into the same ports the real adapters use:

```go {filename="internal/core/subscribe_test.go"}
func TestSubscribeRejectsDuplicates(t *testing.T) {
	store := &fakeStore{existing: []string{"a@b.io"}}
	uc := NewSubscribeUseCase(store)

	err := uc.Subscribe("a@b.io")

	if !errors.Is(err, ErrAlreadySubscribed) {
		t.Fatalf("want ErrAlreadySubscribed, got %v", err)
	}
}
```

No database container, no HTTP server, no mocking framework — millisecond
tests over exactly the code that carries the business risk. And the test
itself is just another driving adapter, which is the point: to the core, a
test and a REST controller look identical.

## What hexagonal architecture is not

- **It is not "more layers".** If your ports merely mirror a repository's
  CRUD methods one-for-one, you've added indirection, not architecture.
  Ports should speak the domain's language (`Exists`, `Reserve`, `Publish`),
  not the infrastructure's.
- **It does not forbid frameworks.** It confines them. Use the heaviest ORM
  you like — inside an adapter.
- **It is not free.** Small tools and short-lived scripts don't earn back
  the interface tax. The pattern pays off when the domain is the asset and
  the infrastructure is a detail.

> Ask of every import in your core package: "would this survive a database
> migration and a framework change?" If not, it belongs in an adapter.

Start small: pick one use case, give it one driven port, and move one
adapter to the edge. The hexagon grows one port at a time.

---

*Diagram: [Hexagonal Architecture](https://commons.wikimedia.org/wiki/File:Hexagonal_Architecture.svg)
by Cth027 (CC BY-SA 4.0), via Wikimedia Commons.*
