---
title: "Astuces Docker Compose : services, healthchecks et démarrages qui tiennent"
date: 2026-08-02T09:40:00+02:00
tags: [docker, astuces]
banner: /images/posts/astuces-docker-compose/banner.png
featured: false
draft: false
summary: "depends_on ne suffit pas, les healthchecks changent tout : le tour des astuces Compose qui rendent une stack de dev fiable - ordre de démarrage, profils, overrides et tags !override, include, ancres YAML, watch mode, lifecycle hooks, stacks parallèles et bases de test en tmpfs."
---

Docker Compose a l'air simple - quelques services dans un YAML, `up`, et
la stack démarre. Puis viennent les vrais problèmes : l'API qui crashe
parce que PostgreSQL n'était « pas encore prêt », le fichier qui gonfle à
300 lignes de copier-coller, la config de dev qui contamine la prod. Tour
d'horizon des astuces qui règlent chacun de ces maux.

## Penser « services », pas « conteneurs »

Un service Compose n'est pas un conteneur : c'est la **déclaration** d'un
composant de la stack - image, réseau, volumes, dépendances. Cette nuance
guide tout le reste : chaque service doit avoir une responsabilité claire,
son propre cycle de vie, et communiquer avec les autres **par leur nom** afin de garantir un certain découplage.
Compose fournit le DNS interne : dans l'exemple ci-dessous, depuis `api`, la base est joignable à
l'adresse `db:5432`, jamais `localhost` (comme ce serait le cas pour des services lancés sans Docker).

```yaml {filename="compose.yml"}
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app:app@db:5432/app   # "db" = nom du service
  db:
    image: postgres:16-alpine
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

Autre astuce : n'exposez avec `ports:` que ce que vous *devez* joindre
depuis l'hôte. Entre services, le réseau interne suffit - la base de
données n'a aucune raison d'être publiée sur `5432` de votre machine.

## Le duo depends_on + healthcheck

Le piège classique : `depends_on` seul garantit l'ordre de **démarrage**
des conteneurs, pas leur **disponibilité**. Par exemple, PostgreSQL met deux secondes à
accepter des connexions après le lancement du conteneur ; l'API démarre
avant, tente de se connecter, et, sans contrôle, elle crashe.

La solution tient en deux blocs : le service critique déclare un
`healthcheck`, et le dépendant attend `service_healthy` :

```yaml {filename="compose.yml"}
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

  rabbitmq:
    image: rabbitmq:3-management
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      retries: 5

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
```

Petites explications :

- `interval` : fréquence du test **après** le premier succès ;
- `start_period` : période de grâce au démarrage - les échecs pendant
  cette fenêtre ne comptent pas dans `retries` ;
- `retries` : nombre d'échecs consécutifs avant de marquer le service
  `unhealthy`.

Avec ça, `docker compose up` bloque le démarrage de `api` jusqu'à ce que
`pg_isready` réponde. Plus de script `wait-for-it.sh`, plus de boucle de
retry artisanale dans le code de démarrage.

Deux compléments utiles :

- `condition: service_completed_successfully` attend la **fin** d'un
  service - parfait pour un conteneur de migration qui doit tourner entre
  la base et l'API :

  ```yaml
  migrations:
    build: .
    command: alembic upgrade head
    depends_on:
      db:
        condition: service_healthy
  api:
    depends_on:
      migrations:
        condition: service_completed_successfully
  ```

- En cas de doute `docker compose ps` affiche l'état de santé (`healthy`, `starting`...) -
  premier réflexe quand « ça ne démarre pas ».

## Les profils : une stack, plusieurs configurations

Tous les services ne servent pas tout le temps. Les *profiles* permettent
de garder les outils dans le fichier sans les démarrer par défaut :

```yaml
services:
  pgadmin:
    image: dpage/pgadmin4
    profiles: [debug]

  maildev:
    image: maildev/maildev
    profiles: [debug]
```

```bash
docker compose up -d                  # stack de base
docker compose --profile debug up -d  # stack + outils
```

Les services sans `profiles` démarrent toujours ; ceux qui en ont un
attendent d'être invités.

## Les fichiers d'override : séparer le socle des environnements

Compose fusionne automatiquement `compose.yml` avec
`compose.override.yml` s'il existe. Le socle décrit ce qui est
vrai partout ; l'override (non versionné ou versionné, au choix de
l'équipe) ajoute le confort de dev :

```yaml {filename="compose.override.yml"}
services:
  api:
    volumes:
      - ./src:/app/src        # code monté : rechargement à chaud
    environment:
      DEBUG: "1"
    ports:
      - "5678:5678"           # debugger
```

Pour un autre environnement, on passe explicitement les fichiers :

```bash
docker compose -f compose.yml -f compose.staging.yml up -d
```

Petit réflexe à avoir : le fichier de base doit fonctionner seul. Les overrides
ajoutent, ils ne réparent pas.

Un piège de la fusion : par défaut elle **ajoute**. Les listes (`ports`,
`volumes`...) sont concaténées, jamais remplacées. Les versions récentes de
Compose (2.24+) fournissent deux tags YAML pour en reprendre le contrôle :

```yaml {filename="compose.override.yml"}
services:
  api:
    ports: !override      # REMPLACE la liste au lieu de l'étendre
      - "9000:8000"
    command: !reset []    # annule le command du fichier de base
```

Sans `!override`, le `8000:8000` du fichier de base resterait publié *en
plus* du 9000 - source classique de « pourquoi ce port est encore
ouvert ? ».

## include : composer des stacks entières

Depuis Compose 2.20, `include:` importe un fichier Compose complet comme
une brique - la stack d'une autre équipe, un socle de monitoring partagé, très utile si vous voulez factoriser vos services :

```yaml {filename="compose.yml"}
include:
  - ../platform/compose.yml   # la stack de l'équipe infra

services:
  api:
    build: .
    depends_on:
      db:                            # défini dans le fichier inclus
        condition: service_healthy
```

La différence avec `-f fichier1 -f fichier2` (qui fusionne tout dans
votre contexte) : chaque fichier inclus reste autonome - ses chemins
relatifs et son `.env` (par exemple) sont résolus par rapport à *lui*, pas à vous.
C'est le mécanisme propre pour dépendre de la stack d'un autre projet
sans la copier-coller.

## Ancres YAML et extensions : arrêter le copier-coller

Quand cinq services partagent le même logging et les mêmes variables, les
*ancres* YAML et les clés d'extension `x-*` factorisent :

```yaml {filename="compose.yml"}
x-defaults: &defaults
  restart: unless-stopped
  logging:
    driver: json-file
    options: { max-size: "10m", max-file: "3" }

services:
  api:
    <<: *defaults
    build: .
  worker:
    <<: *defaults
    build: .
    command: celery -A app worker
```

Les clés préfixées `x-` sont ignorées par Compose : c'est l'endroit
officiel pour ranger les blocs réutilisables.

## Variables d'environnement : la chaîne de priorité

Trois mécanismes cohabitent, et les confondre coûte des heures :

- Le fichier **`.env`** à côté du `compose.yml` alimente les
  **substitutions dans le YAML lui-même** : `image: postgres:${PG_VERSION:-16}` ;
- **`env_file:`** injecte un fichier de variables **dans le conteneur** ;
- **`environment:`** fixe des variables au cas par cas, et gagne sur
  `env_file`.

La syntaxe `${VAR:?message}` transforme une variable oubliée en une erreur
explicite au lieu d'une chaîne vide silencieuse :

```yaml
environment:
  API_KEY: ${API_KEY:?API_KEY manquante - voir .env.example}
```

Et pour vérifier ce que Compose a réellement résolu après fusion des
fichiers et substitution des variables : `docker compose config`.

## develop/watch : le rechargement sans volume

Depuis Compose 2.22, le mode *watch* remplace avantageusement les volumes
de code pour le développement - il synchronise les fichiers, voire
reconstruit l'image quand les dépendances changent :

```yaml
services:
  api:
    build: .
    develop:
      watch:
        - action: sync            # copie les fichiers modifiés
          path: ./src
          target: /app/src
        - action: rebuild         # reconstruit si les deps changent
          path: requirements.txt
```

```bash
docker compose watch
```

L'avantage sur le volume monté : le comportement est identique à l'image
de prod (pas de `node_modules` de l'hôte qui écrase celui du conteneur),
et la reconstruction sur changement de dépendances est automatique.

## post_start / pre_stop : la fin des entrypoints bricolés

Depuis Compose 2.30, les [*lifecycle hooks*](https://docs.docker.com/compose/how-tos/lifecycle/) exécutent des commandes autour
du cycle de vie du conteneur - y compris en `root` alors que le service
tourne, lui, sans privilèges :

```yaml
services:
  db:
    image: postgres:16-alpine
    user: postgres
    post_start:
      - command: chown -R postgres:postgres /var/lib/postgresql/data
        user: root

  api:
    build: .
    pre_stop:
      - command: ./flush-queues.sh
```

Avant, ce genre de besoin finissait dans un `entrypoint.sh` de plus en
plus long, copié d'un projet à l'autre. Le hook garde l'image intacte et
documente l'opération là où on la cherche : dans le YAML.

## docker compose run : les services comme outils

`run` démarre un conteneur **ponctuel** à partir d'un service, avec ses
volumes, son réseau et ses dépendances - parfait pour les tâches à la
demande :

```bash
docker compose run --rm api alembic upgrade head    # migration one-shot
docker compose run --rm --no-deps api bash          # shell, sans réveiller la stack
```

`--rm` supprime le conteneur en sortant, `--no-deps` saute le démarrage
des dépendances quand elles sont inutiles. À savoir : `run` ne publie
pas les `ports:` du service (pour éviter les conflits avec la stack qui
tourne) - `--service-ports` les restaure si besoin.

## Deux stacks en parallèle avec -p

Compose isole tout - conteneurs, réseaux, volumes - par **nom de
projet**, qui est par défaut le nom du dossier. En le changeant, la même
stack tourne en plusieurs exemplaires côte à côte : tester la branche
d'un collègue sans arrêter la vôtre.

```bash
docker compose -p feature-auth up -d
docker compose -p main up -d
```

Seule contrainte : les ports publiés entrent en collision. L'astuce est
de ne fixer que le port conteneur et laisser l'hôte choisir :

```yaml
ports:
  - "8000"          # port hôte attribué automatiquement
```

`docker compose -p feature-auth port api 8000` révèle ensuite le port
attribué.

## tmpfs : des bases de test jetables et rapides

Dans un pipeline de CI, comme pour les tests locaux, persister les données d'une base de
test n'a aucun intérêt - autant les mettre en RAM. Sur une suite de
tests intensive en écriture, le gain est massif :

```yaml {filename="compose.test.yml"}
services:
  db:
    tmpfs:
      - /var/lib/postgresql/data
```

La base démarre plus vite, écrit plus vite, et disparaît avec le
conteneur - plus de volume orphelin ni d'état résiduel entre deux runs. Je vous garantis que le mainteneur de 
votre infrastructure CI vous en remerciera.

## La panoplie du quotidien

Un petit florilège de commandes utiles :

| Commande | Description |
|:-------- |:--------|
| `docker compose up -d --wait` | rend la main quand tout est *healthy* |
| `docker compose logs -f api` | suivre un seul service
| `docker compose exec db psql -U app` | Ouvrir une session interactive `psql` en tant qu'utilisateur `app` dans le conteneur `db`. |
| `docker compose down -v` | tout arrêter ET purger les volumes|
| `docker compose config` | le YAML final, fusionné et résolu |
| `docker compose up -d --scale worker=4` | 4 workers sans toucher au YAML |

Le `--wait` mérite d'être connu : combiné aux healthchecks, il fait de
`docker compose up -d --wait && pytest` un pipeline d'intégration complet
en une ligne.

Dernière petite astuce : un service bavard qui noie les logs de `up` peut
être mis en sourdine avec `attach: false` dans sa définition - il tourne,
mais ses logs ne s'affichent qu'à la demande via `logs`.

> Une stack Compose fiable repose sur trois piliers : des healthchecks
> partout où un service met du temps à être prêt (avec `depends_on:
> condition: service_healthy`), une séparation socle/override pour que le
> même fichier de base serve à tous les environnements, et les profils
> pour embarquer l'outillage sans l'imposer. Le reste - ancres, `include`,
> `watch`, `run --rm`, stacks parallèles, tmpfs, `--wait` - est du confort
> à ne pas sous-estimer car, si vous les adoptez, pourront simplifier un peu votre vie de developpeur.
