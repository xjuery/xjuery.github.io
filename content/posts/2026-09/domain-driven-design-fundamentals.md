---
title: "Domain-Driven Design fundamentals: when the business takes the wheel"
date: 2026-09-06T11:42:17+02:00
tags: [architecture]
banner: /images/posts/domain-driven-design-fundamentals/banner.jpg
featured: true
draft: false
summary: "Eric Evans's big blue book in one article: ubiquitous language, bounded contexts and tactical building blocks - and why it's the strategic half that pays off."
---

In 2003, Eric Evans published *Domain-Driven Design: Tackling Complexity in
the Heart of Software*, the "blue book."
His thesis is simple and still just as radical: for complex software, the essential difficulty isn't necessarily the technology, but the complexity of the *domain*: its rules, its concepts, its relationships and the knowledge that domain experts carry in their heads.
So it's the domain that should drive the design, and the code that should follow.

There's a sentence I keep coming back to during the design phase of the various applications or
platforms I've been, or am, brought in to build: "Software is there to serve the Business, not the other way around."

A little over twenty years later, DDD is often reduced to a folder
tree and a bag of patterns. The patterns matter, sure, but they shouldn't be priority number one.
If you want your application (or anything else) to serve the Business, your first priority has to be the Domain, the language and the various boundaries that exist within the Business.
That's where the value lies. And that's what I'd like us to dig into today.

## The ubiquitous language: a single vocabulary, everywhere

The foundation of DDD isn't a diagram, it's a *shared language*. This ubiquitous language isn't just a glossary: it's the shared language around the model, used in conversations, documents, diagrams, tests and code.
If the business says *policy*, the class is called `Policy`, not
`InsuranceContractRecord`.
Another example: if the business genuinely distinguishes a quote from an order, and that distinction carries different rules or behaviors, the model has to be able to express it clearly - possibly with two types rather than one `Order` cluttered with a plain status field.
The test is brutal and very useful: read a use case out
loud in front of a domain expert. If you have to translate along the
way, your model has drifted.

> When the language of the code drifts from the language of the business, every
> conversation becomes a translation - and every translation loses
> information.

## Bounded contexts: a single model can't rule everything

The classic mistake is wanting to build *the* enterprise model:
a single `Customer` class serving billing, shipping
and support all at once. You end up with forty fields, and nobody
dares touch it anymore.

DDD's answer is the **bounded context**: an explicit boundary within
which a model - and its ubiquitous language - stays
consistent. The same real-world concept can be modeled
differently in each context:

| Context  | "Customer" means...                                    |
|----------|---------------------------------------------------------|
| Sales    | A prospect with a pipeline stage and a sales rep         |
| Billing  | A legal entity with a VAT number and payment terms       |
| Shipping | A name and a validated delivery address                  |
| Support  | A ticket history and an SLA tier                          |

Contexts communicate with each other through explicit relationships: shared kernel, customer/supplier relationship, conformist, anticorruption layer, separate ways, open host service, and so on.
An anticorruption layer is especially useful when you want to protect your model from another model, notably from a legacy system.


Drawing the contexts and their relationships gives you a **context map**: it's, incidentally, the
most useful architecture diagram that most teams never
draw.

## The tactical building blocks

Inside a bounded context, DDD names the pieces that make up
the model.

### Entities and value objects

An **entity** has an identity that survives change: order
`Order #42` remains the same order after its address gets corrected.
A **value object** has no identity: it's defined by its attributes. So two `Money(10, EUR)` are equivalent. Value objects are generally immutable, which in particular makes them safe to share.

Most codebases have far too many entities and far too
few value objects. Amounts, date ranges, addresses, quantities: modeling
them as immutable values with their own behavior
eliminates entire categories of bugs.

{{< codetabs >}}
{{< tab >}}
```java
// Money is a value object: immutable, compared by value,
// and enforces its own invariants.
public record Money(long amountInCents, Currency currency) {

    public Money add(Money other) {
        if (currency != other.currency()) {
            throw new CurrencyMismatchException();
        }
        return new Money(amountInCents + other.amountInCents(), currency);
    }
}
```
{{< /tab >}}
{{< tab >}}
```python
# Money is a value object: immutable, compared by value,
# and enforces its own invariants.
@dataclass(frozen=True)
class Money:
    amount_in_cents: int
    currency: Currency

    def add(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise CurrencyMismatchError()
        return Money(self.amount_in_cents + other.amount_in_cents, self.currency)
```
{{< /tab >}}
{{< /codetabs >}}

### Aggregates: the consistency boundary

An **aggregate** is a group of entities and values that changes as a
whole, guarded by a single entry point: the **aggregate root**. Code
outside only ever holds a reference to the root, and every
modification goes through it - that's how it can enforce its
invariants.

{{< codetabs >}}
{{< tab >}}
```java
public class Order { // aggregate root

    private final OrderId id;
    private final List<OrderLine> lines = new ArrayList<>();
    private Money total;

    // addLine is the only way to grow the order -
    // the invariant "the total matches the lines" can't be bypassed.
    public void addLine(Product product, int quantity) {
        if (quantity <= 0) {
            throw new InvalidQuantityException();
        }
        OrderLine line = new OrderLine(product, quantity);
        lines.add(line);
        total = total.add(line.subtotal());
    }
}
```
{{< /tab >}}
{{< tab >}}
```python
class Order:  # aggregate root

    def __init__(self, order_id: OrderId, currency: Currency) -> None:
        self._id = order_id
        self._lines: list[OrderLine] = []
        self._total = Money(0, currency)

    # add_line is the only way to grow the order -
    # the invariant "the total matches the lines" can't be bypassed.
    def add_line(self, product: Product, quantity: int) -> None:
        if quantity <= 0:
            raise InvalidQuantityError()
        line = OrderLine(product, quantity)
        self._lines.append(line)
        self._total = self._total.add(line.subtotal())
```
{{< /tab >}}
{{< /codetabs >}}

The design rule that follows: **keep aggregates small**, and reference other aggregates by their identifier, not by object. An aggregate is first and foremost a consistency boundary, not merely a transactional unit; if you find yourself needing to modify two aggregates atomically, your boundaries are probably in the wrong place. When atomicity isn't needed, a domain event can instead coordinate changes across aggregates in a decoupled way.

### Repositories, domain services, domain events

- **Repositories** give the illusion of an in-memory collection
  of aggregates (`orders.findById(id)`, `orders.save(order)`), hiding the database
  behind them. One repository per aggregate root - not per table.
- **Domain services** carry business logic that doesn't belong to
  any single entity - a pricing policy that weighs the
  customer, the cart and the season. If it's stateless and speaks a
  purely business language, it's a domain service; if it talks to the
  database, it isn't one.
- **Domain events** aren't part of the core building blocks presented by Evans in the blue book, but they're a common DDD concept today. They represent the fact that a business event occurred: OrderPlaced, PaymentReceived. They decouple
  aggregates from each other and give bounded contexts a natural way to
  communicate.

{{<nb title="Nota bene">}}
This article deliberately doesn't cover two other important tactical DDD building blocks: Factories and Modules. They'd each deserve their own explanations and examples to be covered properly.

That might be the occasion for a future article. 😉
{{</nb>}}

## DDD and architecture diagrams

DDD says nothing about circles or hexagons - it predates the
fame of either diagram and fits naturally into both. In terms of
[hexagonal architecture](/posts/hexagonal-architecture/), the domain
model lives inside the hexagon; in terms of
[Clean Architecture](/posts/clean-architecture/), entities and
value objects form the innermost circle, and repositories are
interfaces defined there and implemented on the outside. Architectures
protect the model; DDD is concerned with what the model *says*.

## How teams get it wrong

- **Purely tactical DDD.** Adopting base classes like `Entity`,
  `ValueObject` and `Repository` while skipping the ubiquitous language and the
  bounded contexts. You get the ceremony without the understanding - the
  patterns exist to serve the model, not the other way around.
- **The anemic domain model.** Entities reduced to bags of
  getters and setters, with all the logic sitting in "service"
  classes. That's a data model with extra steps; the whole
  point is precisely that `order.addLine(...)` enforces the
  rules itself.
- **DDD everywhere.** Evans is explicit: DDD pays off in the
  *core domain*, where your business genuinely differentiates
  itself. CRUD admin screens and generic subdomains don't need
  aggregates - buy them, generate them, or keep them boring.
- **DDD everywhere, take two.** Evans's real point is that design effort should be concentrated on the Core Domain, where the system carries the knowledge that genuinely differentiates the business. Generic subdomains can be isolated, reused, bought or handled with far less investment. Not every part of an application deserves the same level of sophistication. CRUD screens with no meaningful business logic can stay simple, just as generic subdomains can be bought, reused or implemented pragmatically.

> Domain-Driven Design isn't a layer diagram to copy - it's
> a discipline: let the people who know the business shape the
> model, give every model a boundary, and make the code speak the
> same language as the domain. The business takes the wheel; the code follows.
