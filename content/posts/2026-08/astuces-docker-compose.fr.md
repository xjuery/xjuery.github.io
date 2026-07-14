---
title: "Astuces Docker Compose : services, healthchecks et démarrages qui tiennent"
date: 2026-08-02T09:40:00+02:00
tags: [docker, astuces]
featured: false
draft: true
summary: "depends_on ne suffit pas, les healthchecks changent tout : le tour des astuces Compose qui rendent une stack de dev fiable — ordre de démarrage, profils, fichiers d'override, ancres YAML et watch mode."
---

Docker Compose a l'air simple — quelques services dans un YAML, `up`, et
la stack démarre. Puis viennent les vrais problèmes : l'API qui crashe
parce que PostgreSQL n'était « pas encore prêt », le fichier qui gonfle à
300 lignes de copier-coller, la config de dev qui contamine la prod. Tour
d'horizon des astuces qui règlent chacun de ces maux.

## Penser « services », pas « conteneurs »

Un service Compose n'est pas un conteneur : c'est la **déclaration** d'un
composant de la stack — image, réseau, volumes, dépendances. Cette nuance
guide tout le reste : chaque service doit avoir une responsabilité claire,
son propre cycle de vie, et communiquer avec les autres **par leur nom**.
Compose fournit le DNS interne : depuis `api`, la base est joignable à
l'adresse `db:5432`, jamais `localhost`.

```yaml {filename="docker-compose.yml"}
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

Autre réflexe : n'exposez avec `ports:` que ce que *vous* devez joindre
depuis l'hôte. Entre services, le réseau interne suffit — la base de
données n'a aucune raison d'être publiée sur `5432` de votre machine.

## Le duo depends_on + healthcheck

Le piège classique : `depends_on` seul garantit l'ordre de **démarrage**
des conteneurs, pas leur **disponibilité**. PostgreSQL met deux secondes à
accepter des connexions après le lancement du conteneur ; l'API démarre
avant, tente de se connecter, et crashe.

La solution tient en deux blocs : le service critique déclare un
`healthcheck`, et le dépendant attend `service_healthy` :

```yaml {filename="docker-compose.yml"}
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

Décodage des paramètres :

- `interval` : fréquence du test **après** le premier succès ;
- `start_period` : période de grâce au démarrage — les échecs pendant
  cette fenêtre ne comptent pas dans `retries` ;
- `retries` : nombre d'échecs consécutifs avant de marquer le service
  `unhealthy`.

Avec ça, `docker compose up` bloque le démarrage de `api` jusqu'à ce que
`pg_isready` réponde. Plus de script `wait-for-it.sh`, plus de boucle de
retry artisanale dans le code de démarrage.

Deux compléments utiles :

- `condition: service_completed_successfully` attend la **fin** d'un
  service — parfait pour un conteneur de migration qui doit tourner entre
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

- `docker compose ps` affiche l'état de santé (`healthy`, `starting`…) —
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

Compose fusionne automatiquement `docker-compose.yml` avec
`docker-compose.override.yml` s'il existe. Le socle décrit ce qui est
vrai partout ; l'override (non versionné ou versionné, au choix de
l'équipe) ajoute le confort de dev :

```yaml {filename="docker-compose.override.yml"}
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
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

Règle d'hygiène : le fichier de base doit fonctionner seul. Les overrides
ajoutent, ils ne réparent pas.

## Ancres YAML et extensions : arrêter le copier-coller

Quand cinq services partagent le même logging et les mêmes variables, les
*ancres* YAML et les clés d'extension `x-*` factorisent :

```yaml {filename="docker-compose.yml"}
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

- Le fichier **`.env`** à côté du `docker-compose.yml` alimente les
  **substitutions dans le YAML lui-même** : `image: postgres:${PG_VERSION:-16}` ;
- **`env_file:`** injecte un fichier de variables **dans le conteneur** ;
- **`environment:`** fixe des variables au cas par cas, et gagne sur
  `env_file`.

La syntaxe `${VAR:?message}` transforme une variable oubliée en erreur
explicite au lieu d'une chaîne vide silencieuse :

```yaml
environment:
  API_KEY: ${API_KEY:?API_KEY manquante — voir .env.example}
```

Et pour vérifier ce que Compose a réellement résolu après fusion des
fichiers et substitution des variables : `docker compose config`.

## develop/watch : le rechargement sans volume

Depuis Compose 2.22, le mode *watch* remplace avantageusement les volumes
de code pour le développement — il synchronise les fichiers, voire
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

## La panoplie du quotidien

```bash
docker compose up -d --wait      # rend la main quand tout est *healthy*
docker compose logs -f api       # suivre un seul service
docker compose exec db psql -U app
docker compose down -v           # tout arrêter ET purger les volumes
docker compose config            # le YAML final, fusionné et résolu
```

Le `--wait` mérite d'être connu : combiné aux healthchecks, il fait de
`docker compose up -d --wait && pytest` un pipeline d'intégration complet
en une ligne.

> Une stack Compose fiable repose sur trois piliers : des healthchecks
> partout où un service met du temps à être prêt (avec `depends_on:
> condition: service_healthy`), une séparation socle/override pour que le
> même fichier de base serve à tous les environnements, et les profils
> pour embarquer l'outillage sans l'imposer. Le reste — ancres, watch,
> `--wait` — est du confort qui s'additionne vite.
