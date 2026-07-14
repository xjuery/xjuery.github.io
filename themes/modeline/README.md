# Modeline

An editorial developer-blog theme for [Hugo](https://gohugo.io/). JetBrains
Mono display type over an Inter body, GitHub-flavored **dark and light
palettes** behind a header toggle, colored tag pills, terminal-style code
blocks, client-side search bound to <kbd>/</kbd>, and a vim-flavored 404
(`E486: Pattern not found`).

Requires Hugo **0.146.0+** (standard edition is fine).

## Features

- **Dark / light toggle** — respects `prefers-color-scheme`, remembers the
  choice in `localStorage`, no flash of the wrong theme, and degrades to the
  system preference without JavaScript.
- **Home page** — hero, featured post card with a color bar, and a card grid
  of recent posts. Feature a post with `featured: true` in front matter
  (falls back to the latest post).
- **Article layout** — sticky table of contents with scrollspy, reading
  time, tag pills, and `<<` / `>>` previous/next links.
- **Terminal code blocks** — every fenced block gets window chrome with a
  filename caption: <code>```go {filename="main.go"}</code>. Syntax colors
  stay dark in both themes.
- **Tag pills** — each tag gets a stable color derived from its name; pin
  specific tags in config (see below).
- **Search** — a tiny dependency-free client-side search over a generated
  JSON index. Press <kbd>/</kbd> anywhere to focus it; arrow keys navigate
  results.
- Accessible: skip link, focus-visible outlines, `aria-current` navigation,
  reduced-motion support, semantic landmarks.

## Installation

```bash
git submodule add <repo-url> themes/modeline
```

Then in `hugo.toml`:

```toml
theme = 'modeline'

[taxonomies]
  tag = 'tags'

[outputs]
  home = ['html', 'rss', 'json']   # json powers the search

[markup]
  [markup.highlight]
    noClasses = false              # theme ships its own chroma palette
  [markup.tableOfContents]
    startLevel = 2
    endLevel = 3

[menus]
  [[menus.main]]
    name = 'Posts'
    pageRef = '/posts'
    weight = 10
  [[menus.main]]
    name = 'Tags'
    pageRef = '/tags'
    weight = 20
  [[menus.main]]
    name = 'About'
    pageRef = '/about'
    weight = 30
```

## Configuration

```toml
[params]
  description = 'Site description for meta tags.'
  copyright = 'Your Name'          # footer, © {year} {copyright}
  footerNote = 'built with Hugo · :wq'

  logoText = 'max'                 # header logo: {logoText}{logoAccent}
  logoAccent = '.dev'              # accent-colored suffix

  heroEyebrow = 'Backend engineer · writing weekly'
  heroTitle = 'Editors, systems, and the craft of shipping.'
  heroText = 'Field notes from the terminal.'

  search = true                    # header search + "/" shortcut
  loadGoogleFonts = true           # false = system font stacks (self-host
                                   # JetBrains Mono/Inter for GDPR-friendly EU hosting)

  # Optional: pin tags to a pill color; unlisted tags hash to a stable color.
  # Colors: blue, green, yellow, purple, red.
  [params.tagColors]
    vim = 'blue'
    go = 'green'
```

## Content

Posts live in `content/posts/`:

```yaml
---
title: Editing at the speed of thought
date: 2026-06-28
tags: [vim]
featured: true      # promote to the home featured card
summary: One-line summary used on cards, lists, and search.
toc: true           # default; set false to hide the sidebar TOC
---
```

An about page gets the profile layout when it has `role`, `avatar`, or
`links` in front matter:

```yaml
---
title: Max Renard
role: backend engineer · terminal enthusiast
avatar: /images/me.jpg      # optional, falls back to a placeholder
links:
  - name: GitHub
    url: https://github.com/example
  - name: RSS
    url: /index.xml
---
```

## License

[MIT](LICENSE)
