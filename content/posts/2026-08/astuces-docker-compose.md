---
title: "Docker Compose Tips: Services, Healthchecks, and Reliable Startups"
date: 2026-08-02T09:40:00+02:00
tags: [docker, tips]
banner: /images/posts/astuces-docker-compose/banner.png
featured: true
draft: false
summary: "depends_on alone is not enough — healthchecks change everything: a tour of the Compose tricks that make a dev stack reliable — startup order, profiles, overrides and the !override tag, include, YAML anchors, watch mode, lifecycle hooks, parallel stacks, and tmpfs test databases."
---

Docker Compose looks simple — a few services in a YAML file, `up`, and the
stack starts. Then the real problems arrive: the API that crashes because
PostgreSQL wasn't "ready yet", the file that bloats to 300 lines of
copy-paste, the dev config that leaks into prod. Here's a tour of the tips & tricks that
fix each of these issues.

## Think "services", not "containers"

A Compose service is not a container: it is the **declaration** of a stack
component — image, network, volumes, dependencies. This distinction guides
everything else: each service should have a clear responsibility, its own
lifecycle, and communicate with others **by their name** to ensure a degree
of decoupling.
Compose provides internal DNS: in the example below, from `api`, the database
is reachable at `db:5432`, never `localhost` (as would be the case for
services started without Docker).

```yaml {filename="compose.yml"}
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://app:app@db:5432/app   # "db" = service name
  db:
    image: postgres:16-alpine
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

Another tip: only expose with `ports:` what you *actually need* to reach from
the host. Between services, the internal network is enough — there is no
reason to publish the database on port `5432` on your machine.

## The depends_on + healthcheck duo

The classic trap: `depends_on` alone only guarantees the **startup order** of
containers, not their **readiness**. For example, PostgreSQL takes a couple of
seconds to accept connections after the container starts; the API starts first,
tries to connect, and without a check, it crashes.

The solution fits in two blocks: the critical service declares a `healthcheck`,
and the dependent waits for `service_healthy`:

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

A few notes:

- `interval`: frequency of the test **after** the first success;
- `start_period`: grace period at startup — failures during this window do not
  count toward `retries`;
- `retries`: number of consecutive failures before marking the service
  `unhealthy`.

With this in place, `docker compose up` blocks the start of `api` until
`pg_isready` responds. No more `wait-for-it.sh` script, no more hand-rolled
retry loop in the startup code.

Two useful additions:

- `condition: service_completed_successfully` waits for a service to **finish**
  — perfect for a migration container that must run between the database and
  the API:

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

- When in doubt, `docker compose ps` shows the health status (`healthy`,
  `starting`…) — the first reflex when "it won't start".

## Profiles: one stack, multiple configurations

Not every service is needed all the time. *Profiles* let you keep tools in the
file without starting them by default:

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
docker compose up -d                  # base stack
docker compose --profile debug up -d  # stack + tools
```

Services without `profiles` always start; those with a profile wait to be
invited.

## Override files: separating the base from environments

Compose automatically merges `compose.yml` with `compose.override.yml` if it
exists. The base file describes what is true everywhere; the override
(versioned or not, the team's choice) adds dev conveniences:

```yaml {filename="compose.override.yml"}
services:
  api:
    volumes:
      - ./src:/app/src        # mounted code: hot reload
    environment:
      DEBUG: "1"
    ports:
      - "5678:5678"           # debugger
```

For another environment, explicitly pass the files:

```bash
docker compose -f compose.yml -f compose.staging.yml up -d
```

Good habit: the base file should work on its own. Overrides add, they don't
fix.

A merging pitfall: by default it **appends**. Lists (`ports`, `volumes`…) are
concatenated, never replaced. Recent versions of Compose (2.24+) provide two
YAML tags to take back control:

```yaml {filename="compose.override.yml"}
services:
  api:
    ports: !override      # REPLACES the list instead of extending it
      - "9000:8000"
    command: !reset []    # cancels the command from the base file
```

Without `!override`, the `8000:8000` from the base file would remain published
*in addition to* 9000 — the classic source of "why is that port still open?".

## include: composing entire stacks

Since Compose 2.20, `include:` imports a complete Compose file as a building
block — another team's stack, a shared monitoring base, very useful for
factoring out shared services:

```yaml {filename="compose.yml"}
include:
  - ../platform/compose.yml   # the infra team's stack

services:
  api:
    build: .
    depends_on:
      db:                            # defined in the included file
        condition: service_healthy
```

The difference from `-f file1 -f file2` (which merges everything into your
context): each included file remains autonomous — its relative paths and its
`.env` (for example) are resolved relative to *it*, not to you.
This is the clean mechanism for depending on another project's stack without
copy-pasting it.

## YAML anchors and extensions: stop copy-pasting

When five services share the same logging and variables, YAML *anchors* and
`x-*` extension keys factor them out:

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

Keys prefixed with `x-` are ignored by Compose: it's the official place to
store reusable blocks.

## Environment variables: the priority chain

Three mechanisms coexist, and mixing them up costs hours:

- The **`.env`** file next to `compose.yml` feeds **substitutions in the YAML
  itself**: `image: postgres:${PG_VERSION:-16}`;
- **`env_file:`** injects a variable file **into the container**;
- **`environment:`** sets variables case by case, and takes precedence over
  `env_file`.

The `${VAR:?message}` syntax turns a forgotten variable into an explicit error
instead of a silent empty string:

```yaml
environment:
  API_KEY: ${API_KEY:?API_KEY missing — see .env.example}
```

And to check what Compose actually resolved after merging files and
substituting variables: `docker compose config`.

## develop/watch: hot reload without volumes

Since Compose 2.22, *watch* mode advantageously replaces code volumes for
development — it syncs files, and even rebuilds the image when dependencies
change:

```yaml
services:
  api:
    build: .
    develop:
      watch:
        - action: sync            # copies modified files
          path: ./src
          target: /app/src
        - action: rebuild         # rebuilds if deps change
          path: requirements.txt
```

```bash
docker compose watch
```

The advantage over mounted volumes: the behavior is identical to the prod image
(no host `node_modules` overwriting the container's), and rebuilds on
dependency changes are automatic.

## post_start / pre_stop: the end of hacked entrypoints

Since Compose 2.30, [*lifecycle hooks*](https://docs.docker.com/compose/how-tos/lifecycle/) execute commands around the
container lifecycle — including as `root` while the service itself runs without
privileges:

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

Before, this kind of need ended up in an ever-growing `entrypoint.sh`, copied
from one project to the next. The hook keeps the image intact and documents the
operation where you'd look for it: in the YAML.

## docker compose run: services as tools

`run` starts a **one-off** container from a service, with its volumes, network,
and dependencies — perfect for on-demand tasks:

```bash
docker compose run --rm api alembic upgrade head    # one-shot migration
docker compose run --rm --no-deps api bash          # shell, without waking up the stack
```

`--rm` removes the container on exit, `--no-deps` skips starting dependencies
when they're not needed. Note: `run` does not publish the service's `ports:`
(to avoid conflicts with the running stack) — `--service-ports` restores them
if needed.

## Two stacks in parallel with -p

Compose isolates everything — containers, networks, volumes — by **project
name**, which defaults to the folder name. By changing it, the same stack runs
in multiple instances side by side: test a colleague's branch without stopping
yours.

```bash
docker compose -p feature-auth up -d
docker compose -p main up -d
```

The only constraint: published ports collide. The trick is to only fix the
container port and let the host choose:

```yaml
ports:
  - "8000"          # automatically assigned host port
```

`docker compose -p feature-auth port api 8000` then reveals the assigned port.

## tmpfs: fast, disposable test databases

In a CI pipeline, as with local tests, persisting test database data serves no
purpose — you might as well put it in RAM. On a write-intensive test suite, the
gain is massive:

```yaml {filename="compose.test.yml"}
services:
  db:
    tmpfs:
      - /var/lib/postgresql/data
```

The database starts faster, writes faster, and disappears with the container —
no more orphaned volumes or residual state between runs. Your CI infrastructure
maintainer will thank you.

## The everyday toolkit

A selection of useful commands:

| Command | Description |
|:-------- |:--------|
| `docker compose up -d --wait` | returns when everything is *healthy* |
| `docker compose logs -f api` | follow a single service |
| `docker compose exec db psql -U app` | open an interactive `psql` session as user `app` in the `db` container |
| `docker compose down -v` | stop everything AND purge volumes |
| `docker compose config` | the final, merged and resolved YAML |
| `docker compose up -d --scale worker=4` | 4 workers without touching the YAML |

`--wait` is worth knowing: combined with healthchecks, it makes
`docker compose up -d --wait && pytest` a complete integration pipeline in one
line.

One last tip: a chatty service flooding the `up` logs can be silenced with
`attach: false` in its definition — it runs, but its logs only appear on demand
via `logs`.

> A reliable Compose stack rests on three pillars: healthchecks wherever a
> service takes time to be ready (with `depends_on: condition: service_healthy`),
> a base/override separation so the same base file serves all environments, and
> profiles to bundle tooling without imposing it. The rest — anchors, `include`,
> `watch`, `run --rm`, parallel stacks, tmpfs, `--wait` — is comfort not to be
> underestimated: if you adopt them, they can simplify your developer life a
> little.
