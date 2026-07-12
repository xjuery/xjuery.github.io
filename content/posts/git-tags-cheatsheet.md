---
title: "Git tags, the five-minute cheatsheet"
date: 2026-07-12T14:49:35+02:00
tags: [tools, git]
featured: false
draft: true
summary: "Everything you need to tag releases with confidence: annotated vs lightweight tags, the commands that matter, and why git push quietly ignores your tags."
---

Tags mark a specific commit as important — usually a release. Unlike a
branch, a tag never moves: once created, it permanently points to one
commit. That one property is why every release process in the world is
built on them, and why the handful of commands below is worth knowing cold.

## A tag is a bookmark, a branch is a pointer

A branch advances with every commit you make on it. A tag stays exactly
where you planted it, forever. In the classic revision graph below, the
trunk and branches keep growing — but the tag `T1` is frozen on the commit
it was created from.

![Revision graph showing a trunk, branches, merges, and a tag T1 permanently attached to one commit](/images/posts/git-tags-cheatsheet/revision-graph.svg)
{width="260"}

> A tag is a permanent bookmark; a branch is a moving pointer. If you need
> the code at a tag to *change*, you don't move the tag — you branch off
> it.

## Two types of tags

| Type | What it stores | Use it for |
|------|----------------|------------|
| **Annotated** | Full object: author, date, message, optional GPG signature | Releases (recommended) |
| **Lightweight** | Just a name pointing to a commit | Temporary / private markers |

Annotated tags are real Git objects with their own metadata — that's what
you want for anything another human (or a CI pipeline) will rely on.
Lightweight tags are just labels; keep them for local, throwaway markers.

## Create

```bash
# Annotated tag on the current commit (recommended)
git tag -a v1.0.0 -m "Release version 1.0.0"

# Lightweight tag
git tag v1.0.0-light

# Tag a specific past commit by its hash
git tag -a v0.9.0 9fceb02 -m "Beta release"
```

Forgot to tag before more commits landed? No problem — the third form tags
any commit retroactively.

## List & inspect

```bash
git tag                  # List all tags
git tag -l "v1.*"        # List tags matching a pattern
git show v1.0.0          # Show tag details + the commit it points to
```

## Push — tags are NOT pushed by default

This is the classic gotcha: `git push` sends your commits and moves the
remote branch, but says nothing about tags. They live in a separate
namespace and travel only when you push them explicitly.

![Diagram of Git operations between the remote repository, the local clone, branches and working files](/images/posts/git-tags-cheatsheet/git-operations.svg)
{width="560"}

```bash
git push origin v1.0.0   # Push a single tag
git push origin --tags   # Push all tags at once
```

> If your release "disappeared", check the remote: nine times out of ten
> the tag was never pushed.

## Check out

```bash
git checkout v1.0.0              # Inspect code at a tag (detached HEAD)
git checkout -b hotfix v1.0.0    # Branch off a tag to make changes
```

Checking out a tag puts you in *detached HEAD* state — fine for looking
around or building, but any commit you make there belongs to no branch. To
actually fix something in an old release, use the second form: branch off
the tag first.

## Delete

```bash
git tag -d v1.0.0                  # Delete locally
git push origin --delete v1.0.0    # Delete on the remote
```

## Name them well: Semantic Versioning

The de-facto convention for release tags is `vMAJOR.MINOR.PATCH`
(e.g. `v2.4.1`):

![The version number 1.2.3 split into its MAJOR, MINOR and PATCH components](/images/posts/git-tags-cheatsheet/semver.png)
{width="480"}

- **MAJOR** — breaking changes
- **MINOR** — new features (backward compatible)
- **PATCH** — bug fixes

Bump the leftmost number that applies and reset the ones to its right.
Your users can then read the risk of an upgrade straight off the tag name.

## Remember

- A tag is a permanent bookmark; a branch is a moving pointer.
- Prefer **annotated** tags for anything you release.
- `git push` ignores tags — push them explicitly.
- To edit code at a tag, branch off it first.

---

*Images: [Git logo](https://commons.wikimedia.org/wiki/File:Git-logo.svg)
by Jason Long (CC BY 3.0), [revision graph](https://commons.wikimedia.org/wiki/File:Revision_controlled_project_visualization-2010-24-02.svg)
(CC BY-SA 3.0), [Git operations diagram](https://commons.wikimedia.org/wiki/File:Git_operations.svg)
by Daniel Kinzler (CC BY 3.0), and [Semantic Versioning](https://commons.wikimedia.org/wiki/File:SemanticVersioning.png)
by Leetrout (CC BY-SA 4.0) — all via Wikimedia Commons.*
