---
title: Pourquoi votre YAML fait 400 lignes
date: 2026-05-30
tags: [ops]
summary: La prolifération de la config est un symptôme. Petit guide de terrain pour la dompter avant qu'elle ne vous dompte.
---

Personne n'écrit 400 lignes de YAML volontairement. Ça s'accumule — un
override, un environnement, un flag « temporaire » à la fois — jusqu'à ce que
la config devienne plus difficile à relire que le code qu'elle configure.

## Comment ça arrive

La config grossit quand il est moins coûteux d'ajouter une clé que de
demander pourquoi cette clé est nécessaire. Chaque bouton que vous exposez
devient une promesse que vous devez tenir.

```yaml {filename="values.yaml"}
replicas: 3
resources:
  requests:
    cpu: 100m       # personne ne se souvient pourquoi
    memory: 128Mi
featureFlags:
  newCheckout: true # « temporaire », depuis 14 mois
```

## Trois questions avant d'ajouter une clé

1. Est-ce que ça change *par environnement*, ou est-ce juste la peur de coder en dur ?
2. Qui modifie cette valeur, et connaîtrait-il les valeurs sûres ?
3. Le code pourrait-il choisir un défaut raisonnable et le journaliser à la place ?

> Une valeur de config que personne n'a jamais changée n'est pas de la
> configuration. C'est du code source avec un moins bon outillage.

## S'en sortir

Supprimez les défauts qui correspondent aux défauts intégrés. Fusionnez les
fichiers par environnement en un petit diff au-dessus d'une base unique. Et
quand un flag est déployé à 100 %, sa prochaine release est son enterrement.
