---
title: "Astuces Dockerfile : du build qui marche au build qu'on ne touche plus"
date: 2026-07-26T09:30:00+02:00
tags: [docker, astuces]
banner: /images/posts/astuces-dockerfile/banner.png
featured: false
draft: true
summary: "Ordre des couches, .dockerignore, multi-stage builds, cache mounts, utilisateur non-root : les techniques qui transforment un Dockerfile naïf en image légère, rapide à reconstruire et saine en production."
---

Tout Dockerfile commence pareil : `FROM`, `COPY . .`, `RUN` l'installation,
`CMD` — et ça marche. Puis un jour on remarque que chaque build retélécharge
toutes les dépendances, que l'image fait 1,2 Go, et qu'elle tourne en root.
Cet article passe en revue les astuces qui corrigent tout ça, de la plus
simple à la plus avancée.

## Le point de départ (à ne pas imiter)

```dockerfile {filename="Dockerfile"}
FROM eclipse-temurin:21
COPY . .
RUN ./mvnw package
CMD ["java", "-jar", "target/app.jar"]
```

Quatre lignes, cinq problèmes : cache inefficace, image obèse, outils de
build embarqués en production, exécution en root, et tout le répertoire —
`.git` compris — copié dans l'image. Corrigeons dans l'ordre.

## Astuce 1 — ordonner les couches du stable vers le volatile

Docker met en cache chaque instruction sous forme de couche, et **invalide
tout ce qui suit la première couche modifiée**. La conséquence pratique :
copiez d'abord ce qui change rarement (le descripteur de dépendances),
installez, puis copiez le code qui change tout le temps.

```dockerfile
# ✗ Mauvais : le moindre changement de code réinstalle tout
COPY . .
RUN pip install -r requirements.txt

# ✓ Bon : les dépendances ne se réinstallent que si requirements.txt change
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

Sur un projet réel, c'est la différence entre un rebuild de 4 minutes et
un rebuild de 8 secondes. La même logique vaut pour Maven (`pom.xml`
d'abord), npm (`package*.json` d'abord) ou Go (`go.mod` + `go.sum`
d'abord).

## Astuce 2 — .dockerignore, le fichier qu'on oublie toujours

`COPY . .` envoie tout le contexte au démon Docker : `.git`, les
`node_modules` locaux, les artefacts de build, vos fichiers `.env`. Un
`.dockerignore` réduit le contexte, accélère le build et évite de cuire un
secret dans une couche :

```text {filename=".dockerignore"}
.git
target/
node_modules/
__pycache__/
*.env
Dockerfile
docker-compose*.yml
```

Astuce dans l'astuce : sans `.dockerignore`, un simple `git commit`
(qui modifie `.git/`) invalide le cache de `COPY . .` alors qu'aucun
fichier source n'a changé.

## Astuce 3 — le multi-stage build

La technique qui change tout : **compiler dans une image outillée, ne
livrer que le résultat dans une image minimale**.

![Schéma du multi-stage build : une étape de compilation volumineuse et jetable, une image finale minimale qui ne reçoit que l'artefact](/images/posts/astuces-dockerfile/multistage.svg)

```dockerfile {filename="Dockerfile"}
# ── Étape 1 : build ──────────────────────────────
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline        # couche cachée tant que pom.xml ne change pas
COPY src ./src
RUN mvn package -DskipTests

# ── Étape 2 : image finale ───────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

L'image finale ne contient ni Maven, ni JDK, ni sources : on passe de
~750 Mo à ~180 Mo, et la surface d'attaque fond d'autant. Le même motif en
Python, où l'étape de build fabrique un *wheelhouse* :

```dockerfile {filename="Dockerfile"}
FROM python:3.12 AS build
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-deps --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-index --find-links=/wheels /wheels/* && rm -rf /wheels
COPY src ./src
CMD ["python", "-m", "src.main"]
```

Bonus : `docker build --target build .` permet de ne construire que la
première étape — pratique pour lancer les tests en CI dans l'image
outillée, tout en publiant l'image légère.

## Astuce 4 — les cache mounts de BuildKit

Le multi-stage protège l'image finale, mais chaque build repart de zéro
côté téléchargements dès que le descripteur de dépendances change. Les
*cache mounts* montent un répertoire de cache **persistant entre les
builds**, sans qu'il ne finisse jamais dans l'image :

```dockerfile
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests
```

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
```

Un `pom.xml` modifié ne retélécharge plus que les nouvelles dépendances.
Dans la même famille, `--mount=type=secret` donne accès à un secret
(jeton de registre privé, clé SSH) **pendant** le `RUN` sans le stocker
dans aucune couche :

```dockerfile
RUN --mount=type=secret,id=pip_token \
    PIP_INDEX_URL=https://user:$(cat /run/secrets/pip_token)@pypi.interne/simple \
    pip install -r requirements.txt
```

```bash
docker build --secret id=pip_token,src=.pip_token .
```

C'est LA bonne réponse au réflexe dangereux du `ARG TOKEN` — les `ARG`
restent visibles dans `docker history`.

## Astuce 5 — ne pas tourner en root

Par défaut, le processus du conteneur tourne en root. Une évasion de
conteneur ou une faille applicative devient nettement moins grave avec un
utilisateur dédié :

```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

Placez le `USER` après les `RUN` d'installation (qui ont besoin des
droits), avant le `ENTRYPOINT`. Si l'application écrit quelque part,
préparez le répertoire : `RUN mkdir /data && chown app:app /data`.

## Astuce 6 — ENTRYPOINT, CMD et le signal qui n'arrive jamais

Deux règles évitent 90 % des surprises :

- **Toujours la forme exec** (`["java", "-jar", "app.jar"]`), jamais la
  forme shell (`java -jar app.jar`). En forme shell, c'est `/bin/sh` qui
  a le PID 1 : votre application ne reçoit jamais le `SIGTERM` de
  `docker stop`, et se fait tuer brutalement après 10 secondes —
  adieu l'arrêt propre.
- **`ENTRYPOINT` pour l'exécutable, `CMD` pour les arguments par
  défaut** :

  ```dockerfile
  ENTRYPOINT ["python", "-m", "src.main"]
  CMD ["--port", "8000"]
  ```

  `docker run mon-image --port 9000` remplace alors juste les arguments.

## Astuce 7 — les détails qui trahissent le Dockerfile soigné

- **Épingler les versions de base** : `python:3.12-slim`, pas
  `python:latest` — un build reproductible commence là.
- **`COPY` plutôt que `ADD`**, sauf besoin explicite d'extraire une
  archive ; `ADD` avec une URL télécharge sans vérification ni cache.
- **Fusionner les `apt-get`** pour ne pas figer les index de paquets dans
  une couche :

  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends curl \
      && rm -rf /var/lib/apt/lists/*
  ```

- **`HEALTHCHECK`** pour que l'orchestrateur sache si l'application est
  vivante — pas seulement le processus :

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -sf http://localhost:8000/health || exit 1
  ```

- **Linter le tout** avec [hadolint](https://github.com/hadolint/hadolint) :
  `docker run --rm -i hadolint/hadolint < Dockerfile` attrape la plupart
  des points ci-dessus, en CI comme en local.

## Le résultat assemblé

```dockerfile {filename="Dockerfile"}
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
USER app
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
```

> Un bon Dockerfile se reconnaît à trois choses : il se reconstruit en
> secondes (couches ordonnées, cache mounts), il livre une image minimale
> (multi-stage, base slim épinglée), et il tourne sans droits superflus
> (USER dédié, forme exec, healthcheck). Tout le reste est du détail —
> que hadolint vérifiera pour vous.
