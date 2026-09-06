---
title: "Les fondamentaux du Domain-Driven Design : quand le métier prend le volant"
date: 2026-09-06T11:42:17+02:00
tags: [architecture]
featured: true
draft: false
summary: "Le grand livre bleu d'Eric Evans en un article : langage omniprésent, bounded contexts et briques tactiques - et pourquoi c'est la moitié stratégique qui rapporte."
---

En 2003, Eric Evans publie *Domain-Driven Design: Tackling Complexity in
the Heart of Software*, le « livre bleu ».
Sa thèse est simple et toujours aussi radicale : pour les logiciels complexes, la difficulté essentielle n’est pas nécessairement la technique, mais la complexité du *domaine* : ses règles, ses concepts, ses relations et les connaissances que les experts portent dans leur tête.
C'est donc le domaine qui doit piloter la conception, et le code qui doit suivre.

Il y a une phrase que je reprends régulièrement pendant la phase de design des diverses applications ou 
platformes que j'ai été, ou que je suis, amené à construire: "Le logiciel est là pour être au service du Métier, et non l'inverse".

Un peu plus de vingt ans plus tard, le DDD est souvent réduit à une arborescence de
dossiers et à un sac de patterns. Les patterns sont importants, certes, mais ils ne devraient pas être la priorité n°1.
Si vous voulez que votre application (ou autre) soit au service du Métier votre première priorité doit être le Domaine, le langage et les différentes frontières existantes dans le Métier. 
C'est là que réside la valeur. Et c'est ce sur quoi je vous propose de nous pencher aujourd'hui.

## Le langage omniprésent (*ubiquitous language* selon Eric Evans) : un seul vocabulaire, partout

Le fondement du DDD n'est pas un diagramme, c'est un *langage commun*. Ce langage omniprésent n’est donc pas simplement un glossaire : c’est le langage partagé autour du modèle, utilisé dans les conversations, les documents, les diagrammes, les tests et le code.
Si le métier dit *police*, la classe s'appelle `Policy`, pas
`InsuranceContractRecord`. 
Autre exemple, si le métier distingue réellement un devis d’une commande et que cette distinction porte des règles ou des comportements différents, le modèle doit être capable de l’exprimer clairement; éventuellement avec deux types plutôt qu’un Order encombré d’un simple champ status.
Le test est brutal et très utile : lisez un cas d'utilisation à
voix haute devant un expert métier. Si vous devez traduire en cours de
route, votre modèle a dérivé.

> Quand le langage du code s'écarte du langage du métier, chaque
> conversation devient une traduction - et chaque traduction perd de
> l'information.

## Les bounded contexts : un seul modèle ne peut pas tout régner

L'erreur classique consiste à vouloir construire *le* modèle d'entreprise :
une seule classe `Customer` au service de la facturation, de la livraison
et du support. On finit avec quarante champs, et plus personne n'ose y
toucher.

La réponse du DDD, c'est le **bounded context** : une frontière explicite à
l'intérieur de laquelle un modèle - et son langage omniprésent - reste
cohérent. Le même concept du monde réel peut être modélisé
différemment dans chaque contexte :

| Contexte     | « Client » signifie...                                 |
|--------------|------------------------------------------------------|
| Ventes       | Un prospect avec une étape de pipeline et un commercial |
| Facturation  | Une entité légale avec un numéro de TVA et des conditions de paiement |
| Livraison    | Un nom et une adresse de livraison validée           |
| Support      | Un historique de tickets et un niveau de SLA         |

Les contextes communiquent entre eux par des relations explicites : noyau partagé, relation client/fournisseur, conformisme, couche anticorruption, chemins séparés, service hôte ouvert, etc.
Une couche anticorruption est particulièrement utile lorsqu’on veut protéger son modèle d’un autre modèle, notamment d’un système legacy.


Dessiner les contextes et leurs relations donne une **context map**: C'est, d'ailleurs, le
diagramme d'architecture le plus utile que la plupart des équipes ne
dessinent jamais.

## Les briques tactiques

À l'intérieur d'un bounded context, le DDD nomme les pièces qui composent
le modèle.

### Entités et objets-valeurs

Une **entité** a une identité qui survit au changement : la commande
`Order #42` reste la même commande après correction de son adresse. 
Un **objet-valeur** n’a pas d’identité : il est défini par ses attributs. Deux `Money(10, EUR)` sont donc équivalents. Les objets-valeurs sont généralement immuables, ce qui permet notamment de les partager sans risque.

La plupart des bases de code ont beaucoup trop d'entités et beaucoup trop
peu d'objets-valeurs. Montants, plages de dates, adresses, quantités : les
modéliser comme des valeurs immuables dotées de leur propre comportement
élimine des catégories entières de bugs.

{{< codetabs >}}
{{< tab >}}
```java
// Money est un objet-valeur : immuable, comparé par valeur,
// et qui fait respecter ses propres invariants.
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
# Money est un objet-valeur : immuable, comparé par valeur,
# et qui fait respecter ses propres invariants.
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

### Les agrégats : la frontière de cohérence

Un **agrégat** est un groupe d'entités et de valeurs qui change comme un
tout, gardé par un point d'entrée unique : la **racine d'agrégat**. Le code
extérieur ne détient une référence que vers la racine, et toute
modification passe par elle - c'est ainsi qu'elle peut faire respecter les
invariants.

{{< codetabs >}}
{{< tab >}}
```java
public class Order { // racine d'agrégat

    private final OrderId id;
    private final List<OrderLine> lines = new ArrayList<>();
    private Money total;

    // addLine est le seul moyen de faire grossir la commande -
    // l'invariant « le total correspond aux lignes » ne peut pas être contourné.
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
class Order:  # racine d'agrégat

    def __init__(self, order_id: OrderId, currency: Currency) -> None:
        self._id = order_id
        self._lines: list[OrderLine] = []
        self._total = Money(0, currency)

    # add_line est le seul moyen de faire grossir la commande -
    # l'invariant « le total correspond aux lignes » ne peut pas être contourné.
    def add_line(self, product: Product, quantity: int) -> None:
        if quantity <= 0:
            raise InvalidQuantityError()
        line = OrderLine(product, quantity)
        self._lines.append(line)
        self._total = self._total.add(line.subtotal())
```
{{< /tab >}}
{{< /codetabs >}}

La règle de conception qui en découle : **gardez les agrégats petits**, et référencez les autres agrégats par leur identifiant, pas par objet. Un agrégat est avant tout une frontière de cohérence, pas simplement une unité transactionnelle ; si vous devez modifier deux agrégats de façon atomique, vos frontières sont probablement mal placées. Si l’atomicité n’est pas nécessaire, un événement de domaine peut au contraire permettre de coordonner les changements entre agrégats de manière découplée.

### Repositories, services de domaine, événements de domaine

- Les **repositories** donnent l'illusion d'une collection en mémoire
  d'agrégats (`orders.findById(id)`, `orders.save(order)`), en cachant la base
  de données. Un repository par racine d'agrégat - pas par table.
- Les **services de domaine** portent la logique métier qui n'appartient à
  aucune entité en particulier - une politique de tarification qui pèse le
  client, le panier et la saison. S'il est sans état et parle un langage
  purement métier, c'est un service de domaine ; s'il parle à la base de
  données, ce n'en est pas un.
- Les **événements de domaine** ne font pas partie des blocs de construction centraux présentés par Evans dans le livre bleu, mais ils sont aujourd’hui un concept courant du DDD. Ils représentent le fait qu’un événement métier s’est produit : OrderPlaced, PaymentReceived. Ils découplent les
  agrégats entre eux et offrent aux bounded contexts un moyen naturel de
  communiquer.

{{<nb title="Nota bene">}}
Cet article ne couvre volontairement pas deux autres briques importantes du DDD tactique : les Factories et les Modules. Elles mériteraient à elles seules quelques explications et exemples pour être correctement abordées.

Ce sera peut-être l’occasion d’y consacrer un prochain article. 😉
{{</nb>}}

## Le DDD et les diagrammes d'architecture

Le DDD ne dit rien des cercles ni des hexagones - il est antérieur à la
célébrité de ces deux diagrammes et s'y insère naturellement. En termes
d'[architecture hexagonale](/fr/posts/hexagonal-architecture/), le modèle
de domaine vit à l'intérieur de l'hexagone ; en termes de
[Clean Architecture](/fr/posts/clean-architecture/), les entités et les
objets-valeurs forment le cercle le plus central, et les repositories sont
des interfaces définies là et implémentées à l'extérieur. Les architectures
protègent le modèle ; le DDD s'occupe de ce que le modèle *raconte*.

## Comment les équipes se trompent

- **Le DDD purement tactique.** Adopter des classes de base `Entity`,
  `ValueObject` et `Repository` en sautant le langage omniprésent et les
  bounded contexts. On obtient le cérémonial sans la compréhension - les
  patterns existent pour servir le modèle, pas l'inverse.
- **Le modèle de domaine anémique.** Des entités réduites à des sacs de
  getters et de setters, avec toute la logique dans des classes
  « service ». C'est un modèle de données avec des étapes en plus ; tout
  l'intérêt est justement que `order.addLine(...)` fasse respecter les
  règles elle-même.
  
- **Le DDD partout.** Evans est explicite : le DDD est rentable dans le
  *domaine cœur* (*core domain*), là où votre métier se différencie
  vraiment. Les écrans d'administration CRUD et les sous-domaines
  génériques n'ont pas besoin d'agrégats - achetez-les, générez-les, ou
  gardez-les ennuyeux.
- **Le DDD partout.** Evans insiste surtout sur la nécessité de concentrer l’effort de conception sur le Coeur de Domaine, là où le système porte les connaissances qui différencient réellement l’entreprise. Les sous-domaines génériques peuvent être isolés, réutilisés, achetés ou traités avec beaucoup moins d’investissement. Toutes les parties d’une application ne méritent pas le même niveau de sophistication. Les écrans CRUD sans logique métier significative peuvent rester simples, tout comme les sous-domaines génériques peuvent être achetés, réutilisés ou implémentés de façon pragmatique.

> Le Domain-Driven Design n'est pas un plan de couches à recopier - c'est
> une discipline : laisser ceux qui connaissent le métier façonner le
> modèle, donner une frontière à chaque modèle, et faire parler au code la
> même langue qu'au domaine. Le métier prend le volant ; le code suit.
