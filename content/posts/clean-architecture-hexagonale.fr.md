---
title: "Mixer Clean Architecture et architecture hexagonale : exemple concret"
date: 2026-07-14T09:00:00+02:00
tags: [architecture]
featured: false
draft: true
summary: "Clean Architecture et architecture hexagonale ne s'opposent pas : la première organise l'intérieur, la seconde nomme le bord. Un service de commandes complet, en Java et en Python, pour voir comment les combiner sans se nouer le cerveau."
---

*« Faut-il choisir entre Clean Architecture et architecture hexagonale ? »*
Mauvaise question : les deux disent la même chose avec un vocabulaire
différent, et elles se combinent très bien. Cet article le montre sur un
exemple complet — un service de commandes — en Java et en Python.

Si les deux modèles ne vous sont pas familiers, commencez par les articles
dédiés : [l'architecture hexagonale](/fr/posts/hexagonal-architecture/) et
[la Clean Architecture](/fr/posts/clean-architecture/). Ici, on passe
directement au mariage.

## Deux cartes, un même territoire

Les deux architectures reposent sur la **même règle de dépendance** : le
code métier ne doit dépendre de rien de technique. Ni du framework web, ni
de la base de données, ni du bus de messages. Les dépendances pointent vers
l'intérieur, jamais vers l'extérieur.

Là où elles diffèrent, c'est sur ce qu'elles détaillent :

- **L'hexagonale** est précise sur le **bord** : elle nomme les *ports*
  (les interfaces par lesquelles le monde parle à l'application, ou
  l'application au monde) et les *adaptateurs* (les implémentations
  techniques branchées sur ces ports). Mais elle ne dit rien de ce qu'il y
  a *dans* l'hexagone.
- **La Clean Architecture** est précise sur l'**intérieur** : entités au
  centre, cas d'utilisation autour. Mais ses cercles extérieurs
  (« interface adapters », « frameworks & drivers ») restent flous sur la
  mécanique de branchement.

La combinaison tombe donc sous le sens : **les cercles de Clean organisent
l'intérieur de l'hexagone, les ports et adaptateurs structurent son bord.**

![Diagramme combinant l'hexagone (ports et adaptateurs) et les cercles de la Clean Architecture (entités, cas d'utilisation)](/images/posts/clean-architecture-hexagonale/clean-hexagonale.svg)

## L'exemple : passer une commande

Le cas d'utilisation est classique : *passer une commande*. La règle métier
tient en trois lignes — une commande a des lignes, elle calcule son total,
et au-delà de 100 € la livraison est offerte. Une fois la commande
enregistrée, on notifie le client.

Ce qu'il nous faut :

- une **entité** `Order` (le centre) ;
- un **cas d'utilisation** `PlaceOrder` (le cercle du milieu) ;
- deux **ports sortants** : `OrderRepository` et `NotificationSender` ;
- un **port entrant** : l'interface du cas d'utilisation lui-même ;
- des **adaptateurs** : un contrôleur HTTP à gauche, une persistance SQL
  et un envoi d'e-mail à droite.

### L'arborescence

L'arborescence raconte l'architecture toute seule — c'est un bon test :

{{< codetabs >}}
{{< tab >}}
```text
src/main/java/shop/
├── domain/                 # Entités : zéro import technique
│   └── Order.java
├── application/            # Cas d'utilisation + ports
│   ├── PlaceOrder.java
│   └── port/
│       ├── OrderRepository.java
│       └── NotificationSender.java
└── adapter/                # Tout ce qui est technique
    ├── in/web/OrderController.java
    └── out/
        ├── persistence/JpaOrderRepository.java
        └── mail/SmtpNotificationSender.java
```
{{< /tab >}}
{{< tab >}}
```text
shop/
├── domain/                 # Entités : zéro import technique
│   └── order.py
├── application/            # Cas d'utilisation + ports
│   ├── place_order.py
│   └── ports.py
└── adapters/               # Tout ce qui est technique
    ├── web.py              # FastAPI
    ├── persistence.py      # SQLAlchemy
    └── mail.py             # SMTP
```
{{< /tab >}}
{{< /codetabs >}}

Une règle simple à faire respecter en revue de code : **`domain/` n'importe
rien, `application/` n'importe que `domain/`, et seuls les `adapter(s)/`
ont le droit d'importer un framework.**

## Le centre : l'entité

L'entité porte les règles métier qui ne dépendent d'aucun cas
d'utilisation particulier. Ici, le calcul du total et la règle de
livraison gratuite :

{{< codetabs >}}
{{< tab >}}
```java {filename="domain/Order.java"}
public class Order {
    private static final BigDecimal FREE_SHIPPING = new BigDecimal("100");

    private final UUID id;
    private final List<OrderLine> lines;

    public Order(UUID id, List<OrderLine> lines) {
        if (lines.isEmpty()) {
            throw new EmptyOrderException(id);
        }
        this.id = id;
        this.lines = List.copyOf(lines);
    }

    public BigDecimal total() {
        return lines.stream()
            .map(OrderLine::subtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public boolean qualifiesForFreeShipping() {
        return total().compareTo(FREE_SHIPPING) >= 0;
    }
}
```
{{< /tab >}}
{{< tab >}}
```python {filename="domain/order.py"}
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

FREE_SHIPPING = Decimal("100")

@dataclass(frozen=True)
class OrderLine:
    product: str
    quantity: int
    unit_price: Decimal

    @property
    def subtotal(self) -> Decimal:
        return self.quantity * self.unit_price

@dataclass(frozen=True)
class Order:
    id: UUID
    lines: tuple[OrderLine, ...]

    def __post_init__(self) -> None:
        if not self.lines:
            raise EmptyOrderError(self.id)

    @property
    def total(self) -> Decimal:
        return sum((l.subtotal for l in self.lines), Decimal(0))

    @property
    def qualifies_for_free_shipping(self) -> bool:
        return self.total >= FREE_SHIPPING
```
{{< /tab >}}
{{< /codetabs >}}

Remarquez ce qui **manque** : pas d'annotation JPA, pas de `Base` de
SQLAlchemy, pas de sérialisation JSON. Cette classe se teste avec un simple
constructeur et des assertions.

## Les ports : le vocabulaire de l'hexagonale

Les ports sont des interfaces déclarées **par** la couche application,
**pour** son propre besoin. C'est le point crucial : c'est le cas
d'utilisation qui dicte le contrat, pas la base de données.

{{< codetabs >}}
{{< tab >}}
```java {filename="application/port/OrderRepository.java"}
public interface OrderRepository {
    void save(Order order);
    Optional<Order> findById(UUID id);
}
```
{{< /tab >}}
{{< tab >}}
```python {filename="application/ports.py"}
from typing import Protocol
from shop.domain.order import Order

class OrderRepository(Protocol):
    def save(self, order: Order) -> None: ...
    def find_by_id(self, order_id: UUID) -> Order | None: ...

class NotificationSender(Protocol):
    def order_confirmed(self, order: Order, email: str) -> None: ...
```
{{< /tab >}}
{{< /codetabs >}}

En Python, `typing.Protocol` est parfait pour ça : l'adaptateur n'a même
pas besoin d'hériter du port, il suffit qu'il ait la bonne forme
(*structural typing*).

## Le cercle du milieu : le cas d'utilisation

Le cas d'utilisation orchestre : il charge, applique les règles, persiste,
notifie. C'est le vocabulaire de Clean (« interactor »), branché sur les
ports de l'hexagonale :

{{< codetabs >}}
{{< tab >}}
```java {filename="application/PlaceOrder.java"}
public class PlaceOrder {
    private final OrderRepository orders;
    private final NotificationSender notifications;

    public PlaceOrder(OrderRepository orders, NotificationSender notifications) {
        this.orders = orders;
        this.notifications = notifications;
    }

    public UUID handle(PlaceOrderCommand command) {
        Order order = new Order(UUID.randomUUID(), command.lines());
        orders.save(order);
        notifications.orderConfirmed(order, command.customerEmail());
        return order.id();
    }
}
```
{{< /tab >}}
{{< tab >}}
```python {filename="application/place_order.py"}
from uuid import UUID, uuid4
from shop.domain.order import Order, OrderLine
from shop.application.ports import OrderRepository, NotificationSender

class PlaceOrder:
    def __init__(self, orders: OrderRepository,
                 notifications: NotificationSender) -> None:
        self._orders = orders
        self._notifications = notifications

    def handle(self, email: str, lines: tuple[OrderLine, ...]) -> UUID:
        order = Order(id=uuid4(), lines=lines)
        self._orders.save(order)
        self._notifications.order_confirmed(order, email)
        return order.id
```
{{< /tab >}}
{{< /codetabs >}}

Toujours aucun import technique. Ce cas d'utilisation se teste avec deux
doublures en mémoire — pas de base, pas de conteneur, pas de mock
framework si on n'en veut pas.

## Le bord : les adaptateurs

Les adaptateurs sont le seul endroit où les frameworks ont droit de cité.
À droite (sortant), l'implémentation SQL du port :

{{< codetabs >}}
{{< tab >}}
```java {filename="adapter/out/persistence/JpaOrderRepository.java"}
@Repository
public class JpaOrderRepository implements OrderRepository {
    private final SpringDataOrderRepository springData;

    @Override
    public void save(Order order) {
        springData.save(OrderJpaEntity.fromDomain(order));
    }

    @Override
    public Optional<Order> findById(UUID id) {
        return springData.findById(id).map(OrderJpaEntity::toDomain);
    }
}
```
{{< /tab >}}
{{< tab >}}
```python {filename="adapters/persistence.py"}
from sqlalchemy.orm import Session
from shop.domain.order import Order

class SqlOrderRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def save(self, order: Order) -> None:
        self._session.add(OrderRow.from_domain(order))
        self._session.commit()

    def find_by_id(self, order_id: UUID) -> Order | None:
        row = self._session.get(OrderRow, order_id)
        return row.to_domain() if row else None
```
{{< /tab >}}
{{< /codetabs >}}

Notez le motif récurrent : l'adaptateur **traduit** entre le modèle du
domaine (`Order`) et son modèle technique (`OrderJpaEntity`, `OrderRow`).
Ce mapping a un coût, c'est le prix de l'isolation — et il reste bien plus
faible que le coût d'un domaine truffé d'annotations.

À gauche (entrant), le contrôleur HTTP n'est qu'un traducteur lui aussi :

{{< codetabs >}}
{{< tab >}}
```java {filename="adapter/in/web/OrderController.java"}
@RestController
public class OrderController {
    private final PlaceOrder placeOrder;

    @PostMapping("/orders")
    public ResponseEntity<UUID> create(@RequestBody PlaceOrderRequest body) {
        UUID id = placeOrder.handle(body.toCommand());
        return ResponseEntity.created(URI.create("/orders/" + id)).body(id);
    }
}
```
{{< /tab >}}
{{< tab >}}
```python {filename="adapters/web.py"}
from fastapi import APIRouter, Depends

router = APIRouter()

@router.post("/orders", status_code=201)
def create_order(body: PlaceOrderRequest,
                 place_order: PlaceOrder = Depends(get_place_order)) -> dict:
    order_id = place_order.handle(body.email, body.to_lines())
    return {"id": str(order_id)}
```
{{< /tab >}}
{{< /codetabs >}}

## Le branchement final

Reste à assembler le tout au démarrage — le *composition root*. C'est le
seul endroit qui connaît à la fois les ports et leurs implémentations :

{{< codetabs >}}
{{< tab >}}
```java {filename="ShopConfiguration.java"}
@Configuration
public class ShopConfiguration {
    @Bean
    PlaceOrder placeOrder(OrderRepository orders, NotificationSender mail) {
        return new PlaceOrder(orders, mail);
    }
}
```
{{< /tab >}}
{{< tab >}}
```python {filename="main.py"}
def get_place_order() -> PlaceOrder:
    session = SessionLocal()
    return PlaceOrder(
        orders=SqlOrderRepository(session),
        notifications=SmtpNotificationSender(),
    )
```
{{< /tab >}}
{{< /codetabs >}}

## Ce que le mix apporte aux tests

C'est là que l'investissement paye. Trois niveaux de test, chacun avec un
périmètre net :

- **Domaine** : tests unitaires purs sur `Order` — instantanés, sans
  doublure.
- **Application** : tests du cas d'utilisation avec des adaptateurs en
  mémoire (`InMemoryOrderRepository`, une liste Python fait l'affaire).
- **Adaptateurs** : quelques tests d'intégration ciblés — le repository
  contre une vraie base (Testcontainers), le contrôleur contre le cas
  d'utilisation doublé.

La pyramide de tests découle mécaniquement de l'architecture, au lieu de
se battre contre elle.

## Les pièges classiques

- **Trop de couches trop tôt.** Sur un CRUD de trois écrans, cette
  structure est un échafaudage autour d'une cabane. Commencez par un
  domaine isolé et un port ou deux ; le reste peut venir plus tard.
- **Le domaine anémique.** Si `Order` n'a que des getters et que toute la
  logique vit dans le cas d'utilisation, vous avez les couches sans les
  bénéfices. Les règles métier vont dans les entités.
- **Le port qui copie la base.** Un port `findByStatusAndDateBetween(...)`
  a été dicté par SQL, pas par le métier. Nommez les ports d'après le
  besoin du cas d'utilisation.

> Clean Architecture et architecture hexagonale ne sont pas deux options
> sur un menu : l'une décrit l'intérieur (entités, cas d'utilisation),
> l'autre le bord (ports, adaptateurs). Utilisez le vocabulaire de
> l'hexagonale pour vos frontières, les cercles de Clean pour organiser le
> cœur — et la règle de dépendance, commune aux deux, comme seul dogme.
