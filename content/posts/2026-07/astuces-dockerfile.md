---
title: "Dockerfile tips: from a build that works to a build nobody touches again"
date: 2026-07-26T09:30:00+02:00
tags: [docker, tips]
banner: /images/posts/astuces-dockerfile/banner.png
featured: false
draft: false
summary: "Layer ordering, .dockerignore, multi-stage builds, cache mounts, non-root users: the techniques that turn a naive Dockerfile into a lightweight image, fast to rebuild and sound in production."
---

Every Dockerfile starts the same way: `FROM`, `COPY . .`, `RUN` the install,
`CMD` — and it works. Then one day, you notice that every build re-downloads
every dependency, that the image weighs in at 1.2 GB, that it runs as root,
and worse, that secrets have ended up baked into a layer.
This article walks through the tips & tricks that fix all of that, from the
simplest to the most advanced.

## The starting point (do not imitate)

```dockerfile {filename="Dockerfile"}
FROM eclipse-temurin:21
COPY . .
RUN ./mvnw package
CMD ["java", "-jar", "target/app.jar"]
```

Four lines, five problems: an inefficient cache, a bloated image, build
tools shipped into production, running as root, and the entire
directory — `.git` included — copied into the image. Let's fix them in
order.

## Tip 1 — order layers from stable to volatile

Docker caches every instruction as a layer, and **invalidates everything
that follows the first modified layer**. The practical consequence:
copy what changes rarely first (the dependency descriptor), install,
then copy the code that changes all the time.

```dockerfile
# ✗ Bad: the slightest code change reinstalls everything
COPY . .
RUN pip install -r requirements.txt

# ✓ Good: dependencies are only reinstalled if requirements.txt changes
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

On a real project, that's the difference between a 4-minute rebuild and
an 8-second rebuild. The same logic applies to Maven (with its
`pom.xml`), npm (with `package*.json`), or Go (with `go.mod` and
`go.sum`).

## Tip 2 — .dockerignore, the file everyone forgets

`COPY . .` sends the entire build context to the Docker daemon: `.git`,
local `node_modules`, build artifacts, your `.env` files. A
`.dockerignore` shrinks the context, speeds up the build, and above all
avoids shipping unwanted files into a layer (secrets, for instance):

```text {filename=".dockerignore"}
.git
target/
node_modules/
__pycache__/
*.env
Dockerfile
docker-compose*.yml
```

A tip within the tip (to show just how much it matters to control
what ends up in your layers): without a `.dockerignore`, a simple
`git commit` (which changes `.git/`) invalidates the `COPY . .` cache
even though no source file has changed.

## Tip 3 — the multi-stage build

The technique that changes everything: **compile in a fully-tooled
image, ship only the result in a minimal image**.

![Diagram of a multi-stage build: a large, disposable build stage, and a minimal final image that only receives the artifact](/images/posts/astuces-dockerfile/multistage.svg)

```dockerfile {filename="Dockerfile for a Java application"}
# ── Stage 1: build ───────────────────────────────
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline        # cached layer as long as pom.xml doesn't change
COPY src ./src
RUN mvn package -DskipTests

# ── Stage 2: final image ─────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

The final image contains neither Maven, nor the JDK, nor the sources:
you go from ~750 MB down to ~180 MB, and the attack surface shrinks by
just as much. The same pattern in Python, where the build stage produces
a *wheel*:

```dockerfile {filename="Dockerfile for a Python application"}
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

Bonus: `docker build --target build .` lets you build only the first
stage — handy for running tests in CI against the fully-tooled image,
while still publishing the lightweight one.

## Tip 4 — BuildKit cache mounts

Multi-stage protects the final image, but every build still starts from
scratch on downloads as soon as the dependency descriptor changes.
*Cache mounts* mount a cache directory that **persists between
builds**, without it ever ending up in the image:

```dockerfile {filename="Dockerfile / Java"}
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests
```

```dockerfile {filename="Dockerfile / Python"}
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
```

A modified `pom.xml` (or `requirements.txt`) now only re-downloads the
new dependencies. In the same family, `--mount=type=secret` gives access
to a secret (a token for repository access, an SSH key, etc.) **during**
the `RUN`, without ever storing it in any layer:

```dockerfile
RUN --mount=type=secret,id=pip_token \
    PIP_INDEX_URL=https://user:$(cat /run/secrets/pip_token)@pypi.internal/simple \
    pip install -r requirements.txt
```

```bash
docker build --secret id=pip_token,src=.pip_token .
```

This is THE right answer to the dangerous reflex of `ARG TOKEN` —
`ARG` values remain visible in `docker history`, so a secret set
through an `ARG` is a secret you've just handed to every future user of
your image.

## Tip 5 — don't run as root

By default, the container process runs as root. A container escape or
an application flaw becomes noticeably less severe with a dedicated
user:

```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

Place `USER` after the install `RUN` instructions (which need the
privileges), and before `ENTRYPOINT`. If the application writes
somewhere, prepare the directory ahead of time:
`RUN mkdir /data && chown app:app /data`.

## Tip 6 — ENTRYPOINT, CMD, and the signal that never arrives

Two rules avoid 90% of the surprises:

- **Always use the exec form** (`["java", "-jar", "app.jar"]`), never the
  shell form (`java -jar app.jar`). In shell form, `/bin/sh` holds PID 1:
  your application never receives the `SIGTERM` from `docker stop`, and
  gets killed outright after 10 seconds — no graceful shutdown.
- **`ENTRYPOINT` for the executable, `CMD` for the default
  arguments**:

  ```dockerfile
  ENTRYPOINT ["python", "-m", "src.main"]
  CMD ["--port", "8000"]
  ```

  `docker run my-image --port 9000` then simply overrides the arguments.

## Tip 7 — the details of a Dockerfile crafted with care

- **Pin the base image versions**: `python:3.12-slim`, never
  `python:latest` — if you want a reproducible build (and I guarantee
  you do), this is the key.
- **`COPY` rather than `ADD`**, unless you explicitly need to extract an
  archive; `ADD` with a URL downloads without verification or caching.
- **Merge your `apt-get` calls** so you don't freeze package indexes
  into a layer:

  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends curl \
      && rm -rf /var/lib/apt/lists/*
  ```

- **`HEALTHCHECK`** so the orchestrator knows whether the application is
  alive — not just the process:

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -sf http://localhost:8000/health || exit 1
  ```

- **Lint everything** with [hadolint](https://github.com/hadolint/hadolint):
  `docker run --rm -i hadolint/hadolint < Dockerfile` catches most of the
  points above, in CI as well as locally.

## Putting it all together

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

> A good Dockerfile is recognized by three things: it rebuilds in
> seconds (ordered layers, cache mounts), it ships a minimal image
> (multi-stage, pinned slim base), and it runs without excess
> privileges (dedicated USER, exec form, healthcheck). Everything else
> is a detail — one that hadolint will happily check for you.
