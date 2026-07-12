---
title: "La Clean Architecture (Robert C. Martin) : le code, c'est bien. Bien rangé, c'est mieux"
date: 2026-07-26T15:23:44+02:00
tags: [architecture]
featured: false
draft: true
summary: "Les quatre cercles d'Uncle Bob et l'unique règle qui les tient ensemble. Ce que la règle de dépendance vous apporte vraiment, et comment l'adopter sans se noyer dans les DTO."
---

En 2012, Robert C. Martin — « Uncle Bob » — publie un billet de blog qui
distille vingt ans d'idées d'architectures en couches (hexagonale, Onion,
BCE…) en un diagramme et une règle. Le livre *Clean Architecture* de 2017
l'a développé, mais le cœur du pattern tient toujours sur un coin de
nappe : quatre cercles concentriques, et toutes les dépendances pointées
vers le centre.

![Robert C. Martin, entouré d'ordinateurs](/images/posts/clean-architecture/uncle-bob.jpg)
{width="300"}

## Les quatre cercles

![Le diagramme de la Clean Architecture : les entités au centre, entourées des cas d'usage, des adaptateurs d'interface et des frameworks & drivers, avec les dépendances pointant vers l'intérieur](/images/posts/clean-architecture/clean-architecture-circles.svg)
{width="560"}

De l'intérieur vers l'extérieur :

- **Entities** — les règles métier de l'entreprise. Les objets et
  invariants qui existeraient même sans aucune application : une `Invoice`
  doit être équilibrée, une `Reservation` ne peut pas en chevaucher une
  autre. De la logique pure, zéro dépendance.
- **Use Cases** — les règles métier de l'application. Ils orchestrent les
  entités pour accomplir ce que veut un utilisateur : *passer une
  commande*, *résilier un abonnement*. Ce cercle définit les interfaces
  dont il a besoin du monde extérieur, et ignore tout de leur
  implémentation.
- **Interface Adapters** — les traducteurs. Les contrôleurs convertissent
  les requêtes HTTP en appels de cas d'usage ; les presenters convertissent
  les résultats en modèles de vue ; les gateways convertissent les objets
  du domaine en lignes de base de données. Toute la conversion de format
  vit ici, dans les deux sens.
- **Frameworks & Drivers** — le framework web, la base de données, le
  broker de messages, la boîte à outils UI. Le point d'Uncle Bob : ce
  cercle est un *détail*. On y écrit le moins de code possible, et rien de
  ce qui s'y trouve ne compte pour le métier.

## La règle unique

> **La règle de dépendance** : les dépendances de code source ne doivent
> pointer que vers l'intérieur, vers les politiques de plus haut niveau.
> Rien dans un cercle intérieur ne doit savoir qu'un cercle extérieur
> existe — pas un nom de classe, pas une fonction, pas un format de
> données.

Tout le reste du livre est un commentaire de cette règle. Les cercles ne
sont pas sacrés — Martin dit lui-même qu'il peut en falloir plus de
quatre. La règle, elle, est sacrée. Une entité qui importe l'ORM la viole ;
un cas d'usage qui retourne le type `Response` du framework web la viole ;
un objet du domaine avec des annotations JSON laisse discrètement fuir le
cercle le plus externe dans le plus interne.

## Traverser la frontière sans casser la règle

Le contrôle circule de l'extérieur vers l'intérieur (un contrôleur appelle
un cas d'usage), mais parfois le cas d'usage doit appeler *vers
l'extérieur* — persister quelque chose, notifier quelqu'un. Une dépendance
de code vers l'extérieur étant interdite, on l'inverse : le cas d'usage
définit l'interface, le cercle extérieur l'implémente.

```go {filename="internal/usecase/cancel_subscription.go"}
package usecase

// Définie ici, dans le cercle intérieur. Implémentée dehors.
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
	if err := sub.Cancel(); err != nil { // l'entité applique ses règles
		return err
	}
	if err := uc.repo.Save(sub); err != nil {
		return err
	}
	uc.notifier.SubscriptionCancelled(sub)
	return nil
}
```

À l'exécution, l'appel va du cas d'usage vers Postgres ; à la compilation,
la flèche de dépendance pointe dans l'autre sens. Cette inversion — le bon
vieux principe d'inversion de dépendance appliqué à chaque frontière — est
tout le mécanisme derrière le diagramme.

## Ce code, il va où ?

| Vous écrivez… | Sa place est dans… |
|---------------|--------------------|
| « Le total d'une commande ne peut pas être négatif » | Entities |
| « Passer une commande réserve le stock, puis envoie un reçu » | Use Cases |
| La conversion du JSON vers la structure de requête du cas d'usage | Interface Adapters |
| La requête SQL, le routeur HTTP, la config du consommateur Kafka | Frameworks & Drivers |

En cas d'hésitation, demandez-vous qui s'inquiéterait d'un changement. Le
directeur financier se soucie de la première ligne. Personne en dehors de
l'équipe d'ingénierie ne devrait même remarquer que la dernière a changé.

## Clean, hexagonale, Onion : choisissez un dessin, gardez la règle

La Clean Architecture n'est pas une concurrente de
[l'architecture hexagonale](/fr/posts/hexagonal-architecture/) — c'est la
même idée dessinée avec plus de cercles. L'hexagonale dit *intérieur contre
extérieur, reliés par des ports* ; l'Onion ajoute des couches
concentriques ; la Clean nomme les cercles et durcit la règle. Si votre
équipe pense déjà en ports et adaptateurs, vous y êtes à 90 % ; la valeur
ajoutée de la version d'Uncle Bob, c'est le vocabulaire pour *l'intérieur
de l'hexagone* (entités contre cas d'usage) et l'insistance sur le fait que
la règle compte plus que le dessin.

## Comment les équipes se trompent

- **Le déguisement en dossiers.** Créer des répertoires `entities/`,
  `usecases/`, `adapters/` autour d'un code dont les dépendances pointent
  toujours dans tous les sens. La règle vit dans le graphe d'imports, pas
  dans l'arborescence. (Le conseil de Martin lui-même : votre structure de
  premier niveau doit *crier le domaine* — `billing/`, `catalog/` — pas le
  livre d'architecture que vous avez lu.)
- **L'inflation de DTO.** Quatre cercles n'exigent pas quatre copies de
  chaque structure. Ajoutez une conversion quand une frontière mérite
  d'être protégée, pas par réflexe. Une application CRUD de dix entités
  avec quarante classes de mapping n'est pas devenue plus propre — juste
  plus longue.
- **L'adoption tout-ou-rien.** La règle de dépendance rapporte frontière
  par frontière. Commencez par libérer vos cas d'usage du framework ;
  laissez le reste couplé jusqu'à ce que ça fasse mal. Une architecture
  partiellement clean qui part en production vaut mieux qu'une architecture
  pure qui ne part jamais.

> Le code propre, c'est ce que vous devez au prochain lecteur. Une
> *architecture* propre, c'est ce que vous devez au lecteur dans cinq ans,
> qui devra changer la base de données sans toucher aux règles — ou les
> règles sans toucher à la base de données.

---

*Photo : [Robert C. Martin](https://commons.wikimedia.org/wiki/File:Robert_C._Martin_surrounded_by_computers_(cropped).jpg)
par Angelacleancoder (CC BY-SA 4.0), via Wikimedia Commons. Diagramme :
rendu personnel, d'après l'original de Robert C. Martin.*
