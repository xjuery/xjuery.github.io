---
title: "Clonezilla : sauvegarder et restaurer son système, le tutoriel complet"
date: 2026-09-27T10:00:00+02:00
tags: [backup]
featured: false
draft: true
summary: "Une image complète de votre disque système, restaurable en vingt minutes après un crash : préparation de la clé USB, sauvegarde savedisk, restauration restoredisk — chaque écran de Clonezilla expliqué, pièges compris."
---

Un disque qui meurt, une mise à jour qui ne redémarre plus, un chiffrement
malveillant : le jour où ça arrive, la différence entre « vingt minutes de
restauration » et « un week-end de réinstallation » tient à une chose —
avoir une **image disque** récente. Clonezilla est l'outil libre de
référence pour ça : il photographie l'intégralité de votre disque
(partitions, secteur d'amorçage, système, fichiers) dans une image
compressée, et sait la remettre en place à l'identique.

Ce tutoriel déroule les deux moments de la vie d'une image : la créer, et
la restaurer.

![Vue d'ensemble : la sauvegarde va du boot sur clé USB à l'image sur disque externe via savedisk ; la restauration refait le chemin inverse via restoredisk](/images/posts/clonezilla-sauvegarde-restauration/workflow.svg)

## Ce qu'il vous faut

- **Une clé USB** d'au moins 1 Go pour Clonezilla lui-même ;
- **Un disque externe** avec assez de place pour l'image — comptez
  environ 60 % de l'espace **utilisé** (pas de la taille du disque),
  grâce à la compression et au fait que Clonezilla ne copie que les blocs
  occupés ;
- 20 minutes à 1 heure selon la taille des données.

Clonezilla ne s'installe pas : c'est un système autonome sur lequel on
démarre, précisément parce qu'on ne peut pas photographier proprement un
système en train de tourner.

## Étape 1 — préparer la clé USB

Téléchargez l'image ISO « stable » sur
[clonezilla.org](https://clonezilla.org/downloads.php) (choisissez
l'architecture `amd64` pour un PC classique), puis écrivez-la sur la clé.
Le plus simple, sur tous les systèmes, est
[balenaEtcher](https://etcher.balena.io/) ou [Ventoy](https://www.ventoy.net/) ;
en ligne de commande Linux :

```bash
# ATTENTION : vérifiez le nom du périphérique avec lsblk — dd écrase sans prévenir
lsblk
sudo dd if=clonezilla-live-3.2.0-5-amd64.iso of=/dev/sdX bs=4M status=progress
sync
```

## Étape 2 — démarrer sur la clé

Redémarrez la machine et ouvrez le menu de démarrage du firmware — la
touche dépend du constructeur : <kbd>F12</kbd> (Dell, Lenovo),
<kbd>F9</kbd> (HP), <kbd>F8</kbd> (Asus), <kbd>Échap</kbd> (beaucoup de
portables). Sélectionnez la clé USB.

Le premier menu Clonezilla apparaît — un écran texte bleu et blanc,
c'est normal, tout l'outil est ainsi :

```text
        ┌─── Clonezilla live (VGA 800x600) ───────────────┐
        │ Clonezilla live (Default settings)               │
        │ Clonezilla live (To RAM)                         │
        │ Other modes of Clonezilla live                   │
        │ Local operating system (if available)            │
        └──────────────────────────────────────────────────┘
```

Validez le premier choix, puis la langue (**fr_FR.UTF-8 French**), la
disposition clavier, et enfin **Start Clonezilla**.

> Astuce : dans tous ces menus, <kbd>↑</kbd>/<kbd>↓</kbd> pour naviguer,
> <kbd>Espace</kbd> pour cocher une case, <kbd>Tab</kbd> pour atteindre
> `<Ok>`, <kbd>Entrée</kbd> pour valider.

## Étape 3 — choisir le mode : device-image

Clonezilla propose deux grands modes :

```text
        ┌─── Choisir le mode ─────────────────────────────┐
        │ device-image   disque/partition vers/depuis image│
        │ device-device  disque vers disque directement    │
        └──────────────────────────────────────────────────┘
```

- **device-image** : le disque devient un dossier d'image compressée —
  c'est le mode sauvegarde, celui de ce tutoriel ;
- **device-device** : clonage direct disque à disque, utile pour migrer
  vers un disque neuf, mais sans historique de sauvegarde.

Choisissez **device-image**, puis **local_dev** comme emplacement de
stockage (les options `ssh_server`, `samba_server` et `nfs_server`
permettent de stocker l'image sur le réseau — pour plus tard).

Clonezilla vous invite alors à **brancher le disque externe**, attend
quelques secondes, l'affiche dans la liste des périphériques détectés.
Sélectionnez-le, puis le répertoire qui accueillera les images (la racine
`/` du disque convient très bien). L'écran suivant confirme l'espace
disponible — vérifiez-le avant de continuer.

## Étape 4 — la sauvegarde : savedisk

Choisissez le mode **Beginner** (les valeurs par défaut sont bonnes),
puis :

```text
        ┌─── Mode Beginner ───────────────────────────────┐
        │ savedisk    Sauvegarder le disque entier         │
        │ saveparts   Sauvegarder des partitions           │
        │ restoredisk Restaurer une image vers le disque   │
        │ restoreparts ...                                 │
        └──────────────────────────────────────────────────┘
```

**savedisk** sauvegarde tout le disque : table de partitions, secteur
d'amorçage, toutes les partitions. C'est ce qu'il faut pour pouvoir
restaurer un système bootable sur un disque vierge. (`saveparts` ne
prend que des partitions choisies — insuffisant seul pour refaire un
disque qui démarre.)

Ensuite :

1. **Nommez l'image** — la valeur proposée `2026-07-14-10-img` est datée,
   gardez ce format et ajoutez un suffixe parlant :
   `2026-07-14-10-img-portable-xavier` ;
2. **Choisissez le disque source** — repérez-le par sa taille et son
   modèle :

   ```text
   ┌─── Disque à sauvegarder ─────────────────────────────┐
   │ [*] nvme0n1  512G_Samsung_SSD_980  (disque système)  │
   │ [ ] sda      4T_WD_Elements        (disque externe !)│
   └───────────────────────────────────────────────────────┘
   ```

   Ne cochez évidemment **pas** le disque externe de destination ;
3. **Vérification du système de fichiers** : « Skip checking » (le check
   ne fonctionne que sur ext4 et rallonge beaucoup) ;
4. **Vérifier l'image après création** : **oui** — quelques minutes de
   plus pour la certitude que l'image est restaurable ;
5. **Chiffrement** : `-senc` si le disque contient des données sensibles,
   sinon « not to encrypt » ;
6. Action en fin de tâche : `choose` (vous déciderez : éteindre,
   redémarrer…).

Clonezilla affiche la commande complète qu'il va exécuter, demande une
dernière confirmation (`y`), puis Partclone déroule sa barre de
progression partition par partition :

```text
Partclone v0.3.27
Starting to back up device (/dev/nvme0n1p2) to image (-)
Elapsed: 00:07:12   Remaining: 00:05:48   Rate: 6.2GB/min
Completed:  55.4%
```

À la fin, le disque externe contient un répertoire au nom de l'image,
rempli de fichiers compressés. **La sauvegarde est faite.** Rangez le
disque ailleurs que sur le même bureau que la machine — une image et son
original dans le même sac volé ne servent à rien.

## Étape 5 — la restauration : restoredisk

Le disque a rendu l'âme, ou le système est irrécupérable. La procédure
est symétrique :

1. Démarrez sur la même clé USB Clonezilla, mêmes choix de langue ;
2. **device-image** → **local_dev** → sélectionnez le disque externe et
   le répertoire des images ;
3. Mode **Beginner**, puis **restoredisk** ;
4. Sélectionnez **l'image** à restaurer (elles sont listées par nom —
   d'où l'intérêt du nommage daté), puis **le disque de destination** ;
5. Clonezilla demande **deux confirmations** successives, car
   l'opération **efface intégralement le disque cible** :

   ```text
   Attention ! Toutes les données sur le disque seront perdues !
   Voulez-vous vraiment continuer ? (y/n) y
   Encore une fois, êtes-vous sûr ? (y/n) y
   ```

Vingt minutes plus tard, redémarrez sans la clé : le système est
exactement dans l'état du jour de la sauvegarde — comptes, logiciels,
fichiers, fond d'écran compris.

Deux précisions importantes :

- **Le disque cible doit être au moins aussi grand** que le disque
  d'origine. Restaurer vers plus grand fonctionne (l'espace excédentaire
  reste non partitionné, agrandissez ensuite avec GParted) ; vers plus
  petit, non — c'est la principale limite de Clonezilla ;
- La restauration remet le disque **à la date de l'image** : tout ce qui
  a été créé depuis est perdu. L'image disque protège le *système* ;
  pour les *documents*, gardez en plus une synchronisation continue
  (la règle 3-2-1 : trois copies, deux supports, une hors site).

## À quelle fréquence ?

Une image disque n'est pas une sauvegarde quotidienne, c'est un **point
de restauration** : refaites-en une après chaque changement structurant —
mise à niveau majeure de l'OS, installation logicielle lourde, nouveau
poste fraîchement configuré. Entre deux images, les sauvegardes de
fichiers prennent le relais.

Dernier conseil, qui ne coûte qu'une heure : **testez une restauration**
au moins une fois, par exemple vers un vieux disque ou une machine
virtuelle. Une sauvegarde jamais restaurée est une hypothèse, pas une
assurance.

> Clonezilla tient en deux mots à retenir : **savedisk** photographie le
> disque entier vers une image compressée sur un support externe,
> **restoredisk** la remet en place à l'identique, secteur d'amorçage
> compris. Nommez vos images avec la date, vérifiez-les à la création,
> testez une restauration une fois — et le pire jour de votre machine ne
> coûtera que vingt minutes.
