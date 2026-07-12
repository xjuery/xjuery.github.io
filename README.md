# juery.fr

Personal blog about software architecture, patterns, and tools — built with
[Hugo](https://gohugo.io/) and the custom `modeline` theme, deployed to
GitHub Pages.

The site is bilingual: **English** (default, at the site root) and
**French** (under `/fr/`). The visitor's browser language is detected on
first visit, and the EN/FR switcher in the header lets them override it
(the choice is persisted in `localStorage`).

## Quick start

```bash
make serve        # live-reload dev server (drafts + future posts shown)
make check        # production build that fails on warnings (CI gate)
make build        # production build into ./public
make new SLUG=my-post-title   # scaffold a new draft post
```

Requires the **extended** edition of Hugo (`brew install hugo`). The pinned
version is in the `Makefile` (`HUGO_VERSION`) and must stay in sync with
`.github/workflows/deploy.yml`.

## Writing content

See **[docs/writing-a-post.md](docs/writing-a-post.md)** for the full guide:
scaffolding a post, front matter reference, theme extras, adding the French
translation, previewing, and publishing.

Using [Claude Code](https://claude.com/claude-code)? Run
`/new-post <title or topic>` to scaffold a draft post in both English and
French in one go.

## Layout

```
content/            Markdown content (posts/, about.md, + *.fr.md translations)
themes/modeline/    Custom theme (layouts, CSS/JS assets, i18n string tables)
hugo.toml           Site config, incl. per-language params and menus
docs/               Contributor documentation
.github/workflows/  Deploy to GitHub Pages on push to master
```

## Deployment

Every push to `master` triggers the GitHub Actions workflow, which builds the
site with Hugo and publishes `./public` to GitHub Pages.
