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
has zero imports from any framework, whatever the language:

{{< codetabs >}}
{{< tab >}}
```java
public record Subscriber(String email) {}

// Driven port: the core owns this interface,
// the adapter implements it.
public interface SubscriberStore {
    void save(Subscriber s);
    boolean exists(String email);
}

// Driving port: what the outside world may ask of us.
public class SubscribeUseCase {
    private final SubscriberStore store;

    public SubscribeUseCase(SubscriberStore store) {
        this.store = store;
    }

    public void subscribe(String email) {
        if (!Emails.isValid(email)) {
            throw new InvalidEmailException(email);
        }
        if (store.exists(email)) {
            throw new AlreadySubscribedException(email);
        }
        store.save(new Subscriber(email));
    }
}
```
{{< /tab >}}
{{< tab >}}
```python
from dataclasses import dataclass
from typing import Protocol


@dataclass
class Subscriber:
    email: str


# Driven port: the core owns this interface,
# the adapter implements it.
class SubscriberStore(Protocol):
    def save(self, s: Subscriber) -> None: ...
    def exists(self, email: str) -> bool: ...


# Driving port: what the outside world may ask of us.
class SubscribeUseCase:
    def __init__(self, store: SubscriberStore):
        self._store = store

    def subscribe(self, email: str) -> None:
        if not valid_email(email):
            raise InvalidEmailError(email)
        if self._store.exists(email):
            raise AlreadySubscribedError(email)
        self._store.save(Subscriber(email=email))
```
{{< /tab >}}
{{< /codetabs >}}

The adapters live at the edge and depend on the core — never the reverse:

{{< codetabs >}}
{{< tab >}}
```java
// Implements SubscriberStore with plain JDBC.
// The core never knows Postgres exists.
public class PostgresStore implements SubscriberStore {
    private final DataSource ds;

    public PostgresStore(DataSource ds) {
        this.ds = ds;
    }

    @Override
    public void save(Subscriber s) {
        try (var conn = ds.getConnection();
             var stmt = conn.prepareStatement(
                 "INSERT INTO subscribers (email) VALUES (?)")) {
            stmt.setString(1, s.email());
            stmt.executeUpdate();
        } catch (SQLException e) {
            throw new StorageException(e);
        }
    }
}
```
{{< /tab >}}
{{< tab >}}
```python
# Implements SubscriberStore with the raw DB-API.
# The core never knows Postgres exists.
class PostgresStore:
    def __init__(self, conn):
        self._conn = conn

    def save(self, s: Subscriber) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO subscribers (email) VALUES (%s)",
                (s.email,),
            )
```
{{< /tab >}}
{{< /codetabs >}}

{{< codetabs >}}
{{< tab >}}
```java
// Driving adapter: translates HTTP into a use-case call.
@PostMapping("/subscribe")
public ResponseEntity<Void> subscribe(@RequestParam String email) {
    useCase.subscribe(email);
    // ... map domain exceptions to status codes
    return ResponseEntity.noContent().build();
}
```
{{< /tab >}}
{{< tab >}}
```python
# Driving adapter: translates HTTP into a use-case call.
@app.post("/subscribe")
def subscribe():
    use_case.subscribe(request.form["email"])
    # ... map domain errors to status codes
    return "", 204
```
{{< /tab >}}
{{< /codetabs >}}

> The dependency rule is the whole pattern: **source-code dependencies
> point inward, only inward, always inward.** The core defines interfaces;
> the edge implements them.

## Testing is where it pays off first

Because every dependency of the core is an interface the core owns, tests
plug fakes into the same ports the real adapters use:

{{< codetabs >}}
{{< tab >}}
```java
@Test
void subscribeRejectsDuplicates() {
    var store = new FakeStore(List.of("a@b.io"));
    var useCase = new SubscribeUseCase(store);

    assertThrows(AlreadySubscribedException.class,
        () -> useCase.subscribe("a@b.io"));
}
```
{{< /tab >}}
{{< tab >}}
```python
def test_subscribe_rejects_duplicates():
    store = FakeStore(existing=["a@b.io"])
    use_case = SubscribeUseCase(store)

    with pytest.raises(AlreadySubscribedError):
        use_case.subscribe("a@b.io")
```
{{< /tab >}}
{{< /codetabs >}}

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
