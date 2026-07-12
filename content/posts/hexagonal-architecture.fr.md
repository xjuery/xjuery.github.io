---
title: "L'architecture hexagonale: les fondamentaux pour une application qui dure"
date: 2026-07-19T15:08:12+02:00
tags: [architecture]
featured: false
draft: true
summary: "Le pattern ports & adapters d'Alistair Cockburn, sans les buzzwords : la logique métier au centre, les frameworks à la périphérie, et votre application survivra à sa base de données."
---

Les frameworks passent. Les bases de données se remplacent. L'API REST que
vous exposez aujourd'hui deviendra un service gRPC, puis un consommateur
d'événements. La seule partie de votre application qui mérite de survivre à
tout cela, c'est la logique métier — et dans la plupart des bases de code,
c'est précisément celle qui ne peut pas bouger, parce qu'elle est soudée
aux contrôleurs, à l'ORM et à une demi-douzaine de SDK.

L'architecture hexagonale — formalisée par Alistair Cockburn vers 2005, et
aussi appelée **ports & adapters** — est le modèle mental le plus simple
que je connaisse pour éviter ce piège.

## Le problème qu'elle résout

L'application trois-tiers classique (contrôleur → service → repository)
promet la séparation mais la tient rarement. Le « service » métier importe
les entités de l'ORM, retourne les types de réponse du framework web, et
sait quel dialecte SQL il parle. Pour le tester, il faut démarrer une base
de données. Pour changer le mécanisme de livraison, il faut réécrire des
règles métier.

L'observation de Cockburn : la frontière intéressante n'est pas entre des
couches horizontales, mais entre l'**intérieur** (la logique de votre
application) et l'**extérieur** (tout ce qui lui parle ou à qui elle
parle).

## L'idée : un intérieur, un extérieur, une frontière

Imaginez le cœur de l'application comme un hexagone. À l'intérieur : le
domaine — entités, règles, cas d'usage. Rien d'autre. À l'extérieur :
l'interface utilisateur, la base de données, le bus de messages, le
harnais de test, la CLI. Sur la frontière se trouvent les **ports**, et
chaque élément du monde extérieur se branche sur un port via un
**adaptateur**.

![Diagramme d'architecture hexagonale : le cœur de l'application entouré de ses ports, avec des adaptateurs UI, base de données, notification et CLI branchés depuis l'extérieur](/images/posts/hexagonal-architecture/hexagonal-architecture.svg)
{width="440"}

Le nombre de côtés ne veut rien dire, au passage — Cockburn a choisi un
hexagone pour avoir la place d'y dessiner plusieurs ports. Ç'aurait pu être
un octogone.

## Les ports : qui pilote qui

Un **port** est une interface définie par — et appartenant au — cœur. Il en
existe deux familles :

| Famille | Aussi appelée | Qui a l'initiative | Exemples |
|---------|---------------|--------------------|----------|
| **Pilotant** (*driving*) | Primaire, côté gauche | L'extérieur appelle le cœur | Handler HTTP, CLI, consommateur de messages, test |
| **Piloté** (*driven*) | Secondaire, côté droit | Le cœur appelle l'extérieur | Base de données, envoi d'e-mails, passerelle de paiement, horloge |

Un **adaptateur** est le morceau de glu qui implémente un port piloté (un
repository Postgres, un notificateur SMTP) ou qui traduit un stimulus
extérieur en appel sur un port pilotant (un contrôleur HTTP transformant du
JSON en appel de cas d'usage).

## Un exemple concret

Le cœur définit un cas d'usage et *déclare* ce dont il a besoin — une
interface. Il n'importe rien d'aucun framework :

```go {filename="internal/core/subscribe.go"}
package core

type Subscriber struct {
	Email string
}

// Port piloté : le cœur possède cette interface,
// l'adaptateur l'implémente.
type SubscriberStore interface {
	Save(s Subscriber) error
	Exists(email string) (bool, error)
}

// Port pilotant : ce que le monde extérieur peut nous demander.
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

Les adaptateurs vivent à la périphérie et dépendent du cœur — jamais
l'inverse :

```go {filename="internal/adapters/postgres/store.go"}
package postgres

// Implémente core.SubscriberStore avec database/sql.
// Le cœur ne sait pas que Postgres existe.
type Store struct{ db *sql.DB }

func (s *Store) Save(sub core.Subscriber) error {
	_, err := s.db.Exec(
		"INSERT INTO subscribers (email) VALUES ($1)", sub.Email)
	return err
}
```

```go {filename="internal/adapters/http/handler.go"}
package http

// Adaptateur pilotant : traduit HTTP en appel de cas d'usage.
func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	err := h.useCase.Subscribe(r.FormValue("email"))
	// ... traduire les erreurs métier en codes HTTP
}
```

> La règle de dépendance est tout le pattern : **les dépendances de code
> pointent vers l'intérieur, seulement vers l'intérieur, toujours vers
> l'intérieur.** Le cœur définit les interfaces ; la périphérie les
> implémente.

## Les tests, premier retour sur investissement

Comme chaque dépendance du cœur est une interface qu'il possède, les tests
branchent des fakes sur les mêmes ports que les vrais adaptateurs :

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

Pas de conteneur de base de données, pas de serveur HTTP, pas de framework
de mocks — des tests en millisecondes sur exactement le code qui porte le
risque métier. Et le test lui-même n'est qu'un adaptateur pilotant de plus,
ce qui est précisément l'idée : pour le cœur, un test et un contrôleur REST
sont indiscernables.

## Ce que l'architecture hexagonale n'est pas

- **Ce n'est pas « plus de couches ».** Si vos ports ne font que refléter
  une à une les méthodes CRUD d'un repository, vous avez ajouté de
  l'indirection, pas de l'architecture. Les ports doivent parler la langue
  du domaine (`Exists`, `Reserve`, `Publish`), pas celle de
  l'infrastructure.
- **Elle n'interdit pas les frameworks.** Elle les confine. Utilisez l'ORM
  le plus lourd qui vous plaît — à l'intérieur d'un adaptateur.
- **Elle n'est pas gratuite.** Les petits outils et les scripts jetables ne
  rembourseront jamais la taxe des interfaces. Le pattern devient rentable
  quand le domaine est l'actif et l'infrastructure un détail.

> Posez la question à chaque import de votre package cœur : « survivrait-il
> à une migration de base de données et à un changement de framework ? »
> Sinon, sa place est dans un adaptateur.

Commencez petit : prenez un cas d'usage, donnez-lui un port piloté, et
déplacez un adaptateur vers la périphérie. L'hexagone grandit un port à la
fois.

---

*Diagramme : [Hexagonal Architecture](https://commons.wikimedia.org/wiki/File:Hexagonal_Architecture.svg)
par Cth027 (CC BY-SA 4.0), via Wikimedia Commons.*
