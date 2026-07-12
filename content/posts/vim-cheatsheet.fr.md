---
title: "La cheatsheet Vim que je ressors sans arrêt"
date: 2026-07-12T13:41:52+02:00
tags: [vim]
banner: /images/posts/vim-cheatsheet/vim-console.png
bannerAlt: "Une session Vim avec des fenêtres scindées"
featured: false
draft: true
summary: "Les commandes Vim essentielles au quotidien — modes, déplacements, édition, macros — plus les techniques avancées (bloc visuel, :g, répétition avec .) qui font tout basculer."
---

De temps en temps, je vois quelqu'un ouvrir Vim sur un serveur,
paniquer, et se rabattre sur `nano`. Et je dois admettre que, parfois, il peut s'agir de moi. Voici la cheatsheet que je garde à
portée de main à la place : les commandes que j'utilise vraiment au
quotidien en tant que développeur, plus une poignée de techniques avancées
qui transforment Vim de « l'éditeur dont on ne sait pas sortir » en l'outil
le plus rapide du terminal.

![Le logo de Vim](/images/posts/vim-cheatsheet/vim-logo.svg)
{width="160"}

## Les modes : le modèle mental

Tout dans Vim devient logique dès qu'on accepte que c'est un éditeur
*modal*. On est toujours dans un mode, et les touches changent de sens
selon celui-ci. Il y en a quatre à connaître : **Normal** (se déplacer et
agir), **Insertion** (taper du texte), **Visuel** (sélectionner) et
**Ligne de commande** (lancer des commandes `:`).

![Diagramme d'états des modes de Vim : Normal au centre, avec les modes Insertion, Visuel et Ligne de commande accessibles via i/v/: et quittés avec Échap](/images/posts/vim-cheatsheet/vim-modes.svg)
{width="420"}

| Touche | Action |
| --- | --- |
| `i` | Insérer avant le curseur |
| `I` | Insérer en début de ligne |
| `a` | Ajouter après le curseur |
| `A` | Ajouter en fin de ligne |
| `o` | Ouvrir une ligne **en dessous** |
| `O` | Ouvrir une ligne **au-dessus** |
| `v` | Mode visuel **caractère** |
| `V` | Mode visuel **ligne** |
| `Ctrl`+`v` | Mode visuel **bloc** |
| `Esc` | Revenir en mode **Normal** |
| `:` | Entrer en mode **Ligne de commande** |

> En cas de doute, appuyez sur `Esc`. Le mode Normal est le camp de base —
> tous les workflows ci-dessous partent de là.

## Se déplacer

Les déplacements sont le vocabulaire de Vim : chaque commande d'édition
ci-dessous se combine avec eux (`d` comme *delete* + `w` comme *word* =
`dw`).

| Touche | Action |
| --- | --- |
| `h` `j` `k` `l` | ← ↓ ↑ → (caractère) |
| `w` / `W` | Début du mot / MOT suivant |
| `b` / `B` | Début du mot / MOT précédent |
| `e` / `E` | Fin du mot / MOT |
| `0` | Début de ligne |
| `^` | Premier caractère non blanc |
| `$` | Fin de ligne |
| `gg` | Première ligne du fichier |
| `G` | Dernière ligne du fichier |
| `:N` | Aller à la ligne **N** |
| `%` | Sauter au crochet correspondant |
| `{` / `}` | Ligne vide précédente / suivante |
| `Ctrl`+`d` | Défiler d'une demi-page vers le bas |
| `Ctrl`+`u` | Défiler d'une demi-page vers le haut |
| `zz` | Centrer le curseur à l'écran |

## Éditer

| Touche | Action |
| --- | --- |
| `x` | Supprimer le caractère sous le curseur |
| `X` | Supprimer le caractère avant le curseur |
| `dd` | Supprimer (couper) la ligne courante |
| `D` | Supprimer jusqu'à la fin de la ligne |
| `dw` | Supprimer jusqu'au mot suivant |
| `yy` | Copier (*yank*) la ligne courante |
| `yw` | Copier le mot |
| `p` | Coller **après** le curseur |
| `P` | Coller **avant** le curseur |
| `cc` | Changer la ligne entière |
| `cw` | Changer le mot |
| `C` | Changer jusqu'à la fin de la ligne |
| `r` | Remplacer un seul caractère |
| `R` | Entrer en mode Remplacement |
| `~` | Inverser la casse du caractère |
| `J` | Fusionner la ligne suivante avec la courante |

### Annuler & refaire

| Touche | Action |
| --- | --- |
| `u` | Annuler le dernier changement |
| `U` | Annuler tous les changements de la ligne |
| `Ctrl`+`r` | Refaire |
| `.` | Répéter le dernier changement |

> `.` est la touche la plus sous-estimée de Vim. Faites un changement une
> fois, puis rejouez-le n'importe où d'une seule frappe.

## Rechercher & remplacer

| Touche | Action |
| --- | --- |
| `/pat` | Rechercher le motif **vers l'avant** |
| `?pat` | Rechercher le motif **vers l'arrière** |
| `n` | Occurrence suivante |
| `N` | Occurrence précédente |
| `*` | Rechercher le mot sous le curseur → |
| `#` | Rechercher le mot sous le curseur ← |
| `:%s/old/new/g` | Tout remplacer dans le fichier |
| `:%s/old/new/gc` | Tout remplacer avec confirmation |
| `:s/old/new/g` | Remplacer dans la ligne courante |
| `:noh` | Effacer le surlignage de recherche |

## Fichiers, buffers, fenêtres & onglets

Vim édite volontiers plusieurs fichiers à la fois : les *buffers* sont les
fichiers ouverts, les *fenêtres* des vues sur ces buffers, les *onglets*
des ensembles de fenêtres.

![Une session Vim avec deux fenêtres verticales affichant du code C replié](/images/posts/vim-cheatsheet/vim-console.png)

### Opérations sur les fichiers

| Touche | Action |
| --- | --- |
| `:w` | Écrire (enregistrer) le fichier |
| `:w file` | Enregistrer sous **file** |
| `:q` | Quitter |
| `:q!` | Quitter sans enregistrer |
| `:wq` | Enregistrer et quitter |
| `ZZ` | Enregistrer et quitter (raccourci) |
| `ZQ` | Quitter sans enregistrer (raccourci) |
| `:e file` | Ouvrir / éditer **file** |
| `:r file` | Insérer le fichier dans le buffer |
| `:wa` | Enregistrer tous les buffers ouverts |
| `:qa!` | Tout fermer, abandonner les changements |

### Buffers & fenêtres

| Touche | Action |
| --- | --- |
| `:ls` | Lister les buffers ouverts |
| `:bn` | Buffer suivant |
| `:bp` | Buffer précédent |
| `:bd` | Supprimer (fermer) le buffer |
| `:sp` | Scinder la fenêtre **horizontalement** |
| `:vsp` | Scinder la fenêtre **verticalement** |
| `Ctrl`+`w` `w` | Passer d'une fenêtre à l'autre |
| `Ctrl`+`w` `h`/`j`/`k`/`l` | Naviguer entre fenêtres ← ↓ ↑ → |
| `Ctrl`+`w` `q` | Fermer la fenêtre courante |
| `Ctrl`+`w` `=` | Égaliser la taille des fenêtres |

### Onglets

| Touche | Action |
| --- | --- |
| `:tabnew` | Ouvrir un nouvel onglet |
| `:tabe file` | Ouvrir un fichier dans un nouvel onglet |
| `gt` | Onglet suivant |
| `gT` | Onglet précédent |
| `:tabclose` | Fermer l'onglet courant |
| `:tabonly` | Fermer tous les autres onglets |

## Mode visuel

| Touche | Action |
| --- | --- |
| `y` | Copier la sélection |
| `d` | Supprimer la sélection |
| `c` | Changer la sélection |
| `>` | Indenter la sélection vers la droite |
| `<` | Indenter la sélection vers la gauche |
| `~` | Inverser la casse de la sélection |
| `u` | Sélection en minuscules |
| `U` | Sélection en majuscules |
| `:` | Lancer une commande ex sur la plage |
| `gv` | Resélectionner la dernière sélection |

## Marques & sauts

| Touche | Action |
| --- | --- |
| `ma` | Poser la marque **a** au curseur |
| `` `a `` | Sauter à la marque **a** (position exacte) |
| `'a` | Sauter à la marque **a** (ligne) |
| ` `` ` | Revenir à la position précédente |
| `Ctrl`+`o` | Liste de sauts — plus ancien |
| `Ctrl`+`i` | Liste de sauts — plus récent |
| `:marks` | Lister toutes les marques |

## Macros & registres

| Touche | Action |
| --- | --- |
| `qa` | Enregistrer une macro dans le registre **a** |
| `q` | Arrêter l'enregistrement |
| `@a` | Exécuter la macro du registre **a** |
| `@@` | Répéter la dernière macro |
| `5@a` | Exécuter la macro **a** × 5 |
| `:reg` | Afficher tous les registres |
| `"ay` | Copier dans le registre **a** |
| `"ap` | Coller depuis le registre **a** |
| `"+y` | Copier vers le presse-papiers système |
| `"+p` | Coller depuis le presse-papiers système |

## Objets textuels

Les objets textuels sont la raison pour laquelle `ciw` semble magique : ils
décrivent *sur quoi* agir (mot entier, intérieur des guillemets…),
indépendamment de la position du curseur à l'intérieur.

| Touche | Action |
| --- | --- |
| `ciw` | Changer le mot entier (*inner word*) |
| `caw` | Changer le mot et son espace (*around word*) |
| `ci"` | Changer à l'intérieur des guillemets |
| `ci(` | Changer à l'intérieur des parenthèses |
| `ci{` | Changer à l'intérieur des accolades |
| `ci[` | Changer à l'intérieur des crochets |
| `dit` | Supprimer l'intérieur d'une balise HTML |
| `yip` | Copier le paragraphe |
| `vas` | Sélectionner la phrase entière |
| `vap` | Sélectionner le paragraphe entier |

## Indentation & repliage

| Touche | Action |
| --- | --- |
| `>>` | Indenter la ligne vers la droite |
| `<<` | Indenter la ligne vers la gauche |
| `=G` | Auto-indenter jusqu'à la fin du fichier |
| `gg=G` | Auto-indenter tout le fichier |
| `gq` | Formater / couper le texte sélectionné |
| `za` | Basculer le repli sous le curseur |
| `zo` / `zc` | Ouvrir / fermer le repli |
| `zR` / `zM` | Ouvrir / fermer tous les replis |

## Commandes Ex utiles

La ligne de commande (`:`) est un langage d'édition à part entière — et
`q:` ouvre même un historique consultable de tout ce qu'on y a tapé.

![La fenêtre de ligne de commande de Vim affichant l'historique des commandes Ex exécutées](/images/posts/vim-cheatsheet/vim-command-history.png)

| Touche | Action |
| --- | --- |
| `:set nu` | Afficher les numéros de ligne |
| `:set rnu` | Numéros de ligne relatifs |
| `:set ic` | Recherche insensible à la casse |
| `:set paste` | Mode collage (sans auto-indentation) |
| `:syntax on` | Activer la coloration syntaxique |
| `:! cmd` | Lancer une commande shell |
| `:r !cmd` | Insérer la sortie d'une commande shell |
| `:sort` | Trier les lignes sélectionnées |
| `:g/pat/d` | Supprimer les lignes contenant le motif |
| `:v/pat/d` | Supprimer les lignes NE contenant PAS le motif |

## Techniques avancées

Les tableaux ci-dessus sont le vocabulaire. Voici la grammaire — les
combinaisons qui justifient la courbe d'apprentissage.

### Commenter un bloc de lignes avec le bloc visuel

Pour les commentaires `#` (Python / Bash / YAML) — identique pour `//` ou
`--` :

1. Placez-vous sur la **première ligne** à commenter, en première colonne.
2. Entrez en mode Visuel Bloc : `Ctrl`+`v`.
3. Sélectionnez jusqu'à la **dernière ligne** avec `j` (ou un compteur
   comme `9j`).
4. Appuyez sur `I` (i majuscule — *insertion en début de bloc*).
5. Tapez `#`, puis `Esc` — le `#` apparaît sur toutes les lignes
   sélectionnées.

Pour décommenter : placez le curseur sur le `#` de la première ligne,
`Ctrl`+`v`, descendez avec `j`, puis `x` — toute la colonne de `#`
disparaît d'un coup.

### Commenter une plage avec `:norm`

1. Sélectionnez les lignes visuellement (avec `V`) **ou** utilisez une
   plage comme `:5,20`.
2. Lancez `:'<,'>norm I#` — insère `#` en début de chaque ligne.
3. Pour décommenter : `:'<,'>norm ^x` — va au premier caractère non blanc
   et le supprime.

> `:norm` rejoue n'importe quelle séquence de touches du mode Normal sur
> chaque ligne d'une plage. Combinez-la avec ce que vous voulez — c'est de
> l'édition en masse sans enregistrer de macro.

### Ajouter du texte en fin de plusieurs lignes

1. Visuel Bloc : `Ctrl`+`v`, sélectionnez les lignes avec `j`.
2. Appuyez sur `$` pour étendre la sélection jusqu'à la fin de chaque
   ligne.
3. Appuyez sur `A`, tapez votre texte, puis `Esc`.

Exemple : ajouter une virgule à 10 lignes pour corriger un CSV —
`Ctrl+v` → `9j` → `$` → `A` → `,` → `Esc`.

### Incrémenter des nombres en colonne

1. Visuel Bloc : `Ctrl`+`v`, sélectionnez la colonne de nombres.
2. `g` `Ctrl`+`a` — incrémente chaque nombre séquentiellement (1, 2, 3…) ;
   `Ctrl`+`a` seul incrémente tout de 1.
3. `g` `Ctrl`+`x` — décrémente séquentiellement.

### Recherche globale et exécution

- `:g/TODO/d` — supprime toutes les lignes contenant **TODO**.
- `:g/def /norm O# ---` — insère une bannière avant chaque fonction
  Python.
- `:v/import/d` — ne garde *que* les lignes contenant **import** (global
  inversé).

### Répéter un changement dans tout le fichier avec `.`

1. Faites le changement une fois (p. ex. `ciw` → tapez le remplacement →
   `Esc`).
2. Sautez à la cible suivante avec `n`.
3. Répétez avec `.` — enchaînez `n` `.` `n` `.` à travers le fichier.

> Plus chirurgical que `:%s///g` — vous vérifiez chaque occurrence avant
> d'appliquer.

### Trier et dédupliquer

- `:sort` — trie les lignes sélectionnées alphabétiquement ; `:sort!`
  inverse l'ordre.
- `:sort u` — trie et supprime les doublons.
- `:sort n` — trie numériquement.

### Lancer une macro sur chaque ligne correspondante

1. Enregistrez la macro dans le registre **q** : `qq` … `q`.
2. Lancez `:g/pattern/norm @q` — elle s'exécute sur chaque ligne
   correspondant au motif.

`:wq` — *écrire. quitter. livrer.*

---

*Images : [logo Vim](https://commons.wikimedia.org/wiki/File:Vimlogo.svg)
(GPL) et [diagramme des modes de Vim](https://commons.wikimedia.org/wiki/File:Vim_modes.svg)
par Harp (CC BY-SA 4.0) ; [capture d'écran des fenêtres scindées](https://commons.wikimedia.org/wiki/File:Vim-(logiciel)-console.png)
(GPL) et [capture de l'historique des commandes](https://commons.wikimedia.org/wiki/File:Vim-commands-history.png)
par Vitaly Zdanevich (CC0) — toutes via Wikimedia Commons.*
