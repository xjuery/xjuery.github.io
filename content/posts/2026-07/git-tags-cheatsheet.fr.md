---
title: "Les tags Git, la cheatsheet en cinq minutes"
date: 2026-07-12T14:49:35+02:00
tags: [tools, git]
banner: /images/posts/git-tags-cheatsheet/banner.png
bannerAlt: "A git tag banner"
featured: true
draft: false
summary: "Tout ce qu'il faut pour taguer ses releases sereinement : tags annotés vs légers, les commandes qui comptent, et pourquoi git push ignore silencieusement vos tags."
---

Un tag marque un commit précis comme important — en général une release.
Contrairement à une branche, un tag ne bouge jamais : une fois créé, il
pointe définitivement vers un seul commit. C'est cette propriété qui fait
que tous les processus de release du monde reposent sur eux, et qui rend la
poignée de commandes ci-dessous indispensable à connaître par cœur.

## Un tag est un marque-page, une branche est un pointeur

Une branche avance à chaque commit qu'on y fait. Un tag reste exactement là
où on l'a posé, pour toujours. Dans le graphe de révisions classique
ci-dessous, la branche principale (qu'on peut aussi appeler trunks, souvent nommée "main" ou "master") et les autres branches continuent de grandir — mais le tag
`T1` est figé sur le commit depuis lequel il a été créé.

![Graphe de révisions montrant un tronc, des branches, des fusions et un tag T1 attaché définitivement à un commit](/images/posts/git-tags-cheatsheet/revision-graph.svg)
{width="260"}

> Un tag est un marque-page permanent ; une branche est un pointeur mobile.
> Si le code au niveau d'un tag doit *changer*, on ne déplace pas le tag —
> on crée une branche à partir de lui.

## Deux types de tags

| Type | Ce qu'il stocke | À utiliser pour |
|------|-----------------|-----------------|
| **Annoté** | Un objet complet : auteur, date, message, signature GPG optionnelle | Les releases (recommandé) |
| **Léger** | Un simple nom pointant vers un commit | Marqueurs temporaires / privés |

Les tags annotés sont de vrais objets Git avec leurs propres métadonnées —
c'est ce qu'il faut pour tout ce dont un autre humain (ou une pipeline CI)
dépendra. Les tags légers ne sont que des étiquettes ; réservez-les aux
marqueurs locaux et jetables.

## Créer

```bash
# Tag annoté sur le commit courant (recommandé)
git tag -a v1.0.0 -m "Release version 1.0.0"

# Tag léger
git tag v1.0.0-light

# Taguer un commit passé précis via son hash
git tag -a v0.9.0 9fceb02 -m "Beta release"
```

> Vous avez oublié de taguer avant que d'autres commits n'arrivent ? Pas de souci — la
> troisième forme tague n'importe quel commit rétroactivement.

## Lister & inspecter

```bash
git tag                  # Lister tous les tags
git tag -l "v1.*"        # Lister les tags correspondant à un motif
git show v1.0.0          # Détails du tag + le commit pointé
```

## Push — les tags ne sont PAS poussés par défaut

C'est le piège classique : `git push` envoie vos commits et avance la
branche distante, mais ne fait rien des tags. Ils vivent dans un espace de
noms séparé et ne voyagent que si on les pousse explicitement.

![Diagramme des opérations Git entre le dépôt distant, le clone local, les branches et les fichiers de travail](/images/posts/git-tags-cheatsheet/git-operations.svg)
{width="560"}

```bash
git push origin v1.0.0   # Pousser un seul tag
git push origin --tags   # Pousser tous les tags d'un coup
```

> Si votre release a « disparu », vérifiez le dépôt distant : neuf fois sur
> dix, le tag n'a simplement jamais été poussé.

## Consulter le code d'un tag

```bash
git checkout v1.0.0              # Inspecter le code au tag (HEAD détaché)
git checkout -b hotfix v1.0.0    # Créer une branche depuis le tag pour modifier
```

Faire un checkout d'un tag vous place en état *HEAD détaché* — parfait pour
regarder ou compiler, mais tout commit fait là n'appartient à aucune
branche. Pour vraiment corriger une vieille release, utilisez la seconde
forme : créez d'abord une branche depuis le tag.

## Supprimer

```bash
git tag -d v1.0.0                  # Supprimer en local
git push origin --delete v1.0.0    # Supprimer sur le dépôt distant
```

## Bien les nommer : le versionnage sémantique

La convention de fait pour les tags de release est `vMAJOR.MINOR.PATCH`
(p. ex. `v2.4.1`) :

![Le numéro de version 1.2.3 décomposé en ses composantes MAJOR, MINOR et PATCH](/images/posts/git-tags-cheatsheet/semver.png)
{width="480"}

- **MAJOR** — changements incompatibles (*breaking changes*)
- **MINOR** — nouvelles fonctionnalités (rétrocompatibles)
- **PATCH** — corrections de bugs

Incrémentez le chiffre le plus à gauche concerné et remettez à zéro ceux à
sa droite. Vos utilisateurs peuvent alors lire le risque d'une mise à jour
directement dans le nom du tag.

## À retenir

- Un tag est un marque-page permanent ; une branche est un pointeur mobile.
- Préférez les tags **annotés** pour tout ce que vous publiez.
- `git push` ignore les tags — poussez-les explicitement.
- Pour modifier le code d'un tag, créez d'abord une branche depuis celui-ci.

---

*Images : [logo Git](https://commons.wikimedia.org/wiki/File:Git-logo.svg)
par Jason Long (CC BY 3.0), [graphe de révisions](https://commons.wikimedia.org/wiki/File:Revision_controlled_project_visualization-2010-24-02.svg)
(CC BY-SA 3.0), [diagramme des opérations Git](https://commons.wikimedia.org/wiki/File:Git_operations.svg)
par Daniel Kinzler (CC BY 3.0), et [versionnage sémantique](https://commons.wikimedia.org/wiki/File:SemanticVersioning.png)
par Leetrout (CC BY-SA 4.0) — toutes via Wikimedia Commons.*
