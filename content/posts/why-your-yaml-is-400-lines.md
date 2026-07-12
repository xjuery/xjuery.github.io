---
title: Why your YAML is 400 lines
date: 2026-05-30
tags: [ops]
summary: Config sprawl is a smell. A short field guide to taming it before it tames you.
---

Nobody writes 400 lines of YAML on purpose. It accretes — one override, one
environment, one “temporary” flag at a time — until the config is harder to
review than the code it configures.

## How it happens

Config grows when it's cheaper to add a key than to ask why the key is
needed. Every knob you expose becomes a promise you have to keep.

```yaml {filename="values.yaml"}
replicas: 3
resources:
  requests:
    cpu: 100m       # nobody remembers why
    memory: 128Mi
featureFlags:
  newCheckout: true # "temporary", 14 months old
```

## Three questions before adding a key

1. Does this change *per environment*, or is it just fear of hardcoding?
2. Who flips this, and would they know the safe values?
3. Could the code pick a sane default and log it instead?

> A config value nobody has ever changed is not configuration. It's source
> code with worse tooling.

## Digging out

Delete defaults that match the built-in defaults. Fold per-env files into a
tiny diff over one base. And when a flag ships to 100%, its next release is
its funeral.
