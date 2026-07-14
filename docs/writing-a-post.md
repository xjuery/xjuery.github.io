# Writing a new post

This site is bilingual (English + French). English is the default language and
lives at the site root (`https://juery.fr/`); French lives under `/fr/`.
This guide walks through creating a post in English and adding its French
translation.

> **Shortcut**: in Claude Code, `/new-post <title or topic>` runs all the
> steps below — it scaffolds the post and creates both the English and French
> drafts (see `.claude/commands/new-post.md`).

## 1. Scaffold the post

Posts are organized in **monthly folders** named after their publication
date: a post dated `2026-07-12T14:49:35+02:00` lives in
`content/posts/2026-07/`. URLs are not affected — the `[permalinks]` config
in `hugo.toml` keeps every post at `/posts/<slug>/` regardless of the
folder, so moving a post between months never breaks a link.

```bash
make new SLUG=my-post-title              # current month
make new SLUG=my-post-title MONTH=2026-09   # explicit month
```

This runs `hugo new content posts/<YYYY-MM>/my-post-title.md` and creates a
draft from the archetype in `themes/modeline/archetypes/posts.md`:

```yaml
---
title: "My Post Title"
date: 2026-07-12T10:00:00+02:00
tags: []
featured: false
draft: true
summary: ""
---
```

## 2. Fill in the front matter

| Field      | Purpose                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `title`    | Post title, shown in lists, cards, and the `<title>` tag.                                |
| `date`     | Publication date. Future-dated posts are hidden until the date passes. Must match the monthly folder: if you re-date a post to another month, move the file (and its `.fr.md` sibling) to the matching `content/posts/YYYY-MM/` folder. |
| `tags`     | List of tags, e.g. `[ops, go]`. Pinned colors are configured in `hugo.toml` (`[params.tagColors]`); unlisted tags get a stable color derived from their name. |
| `featured` | Set `true` to pin the post to the big "Featured" card on the home page (the newest post is featured otherwise). |
| `draft`    | Keep `true` while writing; drafts only show up with `make serve`. Set `false` to publish. |
| `summary`  | One or two sentences shown in lists, cards, search results, and meta descriptions.       |
| `toc`      | Optional, defaults to `true`. Set `false` to hide the table of contents.                 |
| `banner`   | Optional. Path to a banner image (e.g. `/images/posts/<slug>/banner.jpg`) displayed full-width at the top of the page, above the title. See [Banner image](#banner-image). |
| `bannerAlt`| Optional. Alt text for the banner image. Defaults to empty (decorative image). Translate it in the French file. |

## 3. Write the body

Standard Markdown, with a few theme extras:

- **Headings**: use `##` and `###` — they feed the table of contents
  (configured for levels 2–3).
- **Code blocks**: fenced blocks get syntax highlighting. An optional
  `filename` attribute renders a filename header:

  ````markdown
  ```yaml {filename="values.yaml"}
  replicas: 3
  ```
  ````

- **Multi-language code tabs**: to show the same snippet in several
  languages, wrap one fenced block per language in `tab` shortcodes inside
  a `codetabs` shortcode. Each tab's language (and its label) is taken from
  the fence info string:

  ````markdown
  {{</* codetabs */>}}
  {{</* tab */>}}
  ```go
  fmt.Println("hello")
  ```
  {{</* /tab */>}}
  {{</* tab */>}}
  ```python
  print("hello")
  ```
  {{</* /tab */>}}
  {{</* /codetabs */>}}
  ````

  Common languages get a pretty label automatically (`js` → JavaScript,
  `py` → Python…); override it with `{{</* tab lang="js" label="Node.js" */>}}`.
  The first tab is shown by default. Remember to translate nothing here —
  code tabs work the same in the French file.
- **Emoji**: shortcodes like `:wq:` work (`enableEmoji = true`).
- **Raw HTML**: allowed (`unsafe = true` in the Goldmark config), e.g.
  `<kbd>` for key caps.

### Adding images

Image files go in `static/`, under one folder per post to keep things tidy:

```
static/images/posts/<slug>/diagram.png
```

Everything in `static/` is copied verbatim to the site root at build time, so
that file is served at `/images/posts/<slug>/diagram.png`. Reference it from
the post with standard Markdown, using an **absolute path** (starting with
`/`) and meaningful alt text:

```markdown
![Hexagonal architecture diagram](/images/posts/my-post-title/diagram.png)
```

#### Specifying the display size

By default an image is displayed at its original size (capped at the content
width). To display it smaller, add an attribute list on the line
**immediately after** the image:

```markdown
![Hexagonal architecture diagram](/images/posts/my-post-title/diagram.png)
{width="400"}
```

- `width` is the display width in pixels; the height follows automatically,
  so the aspect ratio is preserved. This is usually the only attribute you
  need.
- You can also pass `height="300"` (with `width`, it reserves the exact
  layout box while the image loads) and `class="..."` for custom styling.
- This works only for **standalone** images (an image alone on its line, the
  usual case). Images inline in a sentence are always rendered at their
  natural size.
- Remember to add the same attribute line in the French translation.

This is handled by the theme's image render hook
(`themes/modeline/layouts/_markup/render-image.html`), which also adds lazy
loading to every post image.

Notes:

- **Translations share the images.** Because the path is absolute, the same
  reference works from both `<slug>.md` and `<slug>.fr.md` — no need to
  duplicate files. Do translate the alt text in the French version, though.
- **Site-wide images** (logos, the about-page avatar) live one level up in
  `static/images/`, e.g. `static/images/face.jpg` → `/images/face.jpg`.
- **Keep files light**: prefer compressed JPEG for photos and PNG/SVG for
  diagrams; roughly < 200 KB per image keeps pages fast. The theme caps
  image width via the prose styles, but resize very large originals before
  committing them.

#### Banner image

Any page can display a banner image across the top of its content column,
above the title. Store the image like any other post image and point the
`banner` front-matter field at it:

```yaml
---
title: "My Post Title"
banner: /images/posts/my-post-title/banner.jpg
bannerAlt: "A skyline of terminal windows at dusk"
---
```

- The banner is rendered full-width (cropped to at most 320 px tall via
  `object-fit: cover`), so favor wide, landscape images — roughly 1400×400
  works well. The same size guidance as other images applies (< 200 KB).
- `bannerAlt` is optional; without it the image is treated as decorative
  (empty `alt`). Set it whenever the image carries meaning.
- It works on **every page kind**: posts, plain pages, the about page, and
  section list pages (set `banner` in `content/posts/_index.md` to decorate
  the post list).
- Translations: like other images, the file is shared — repeat the same
  `banner` path in `<slug>.fr.md` (front matter is per-file) and translate
  `bannerAlt`.

For an image-heavy post you can alternatively use a Hugo *page bundle*:
create `content/posts/<YYYY-MM>/<slug>/` containing `index.md`,
`index.fr.md`, and the images side by side, then reference them with
relative paths
(`![Alt](diagram.png)`). Both approaches work; the `static/` convention is
the default here because `make new` and `/new-post` scaffold single-file
posts.

## 4. Add the French translation

Translations are separate files with a language suffix, side by side with the
original:

```
content/posts/2026-07/my-post-title.md      # English (default language)
content/posts/2026-07/my-post-title.fr.md   # French
```

Copy the English file to `<slug>.fr.md` and translate the `title`, `summary`,
and body. **Keep the same filename base** — that is how Hugo links the two
pages as translations of each other, which powers:

- the EN/FR switcher in the header linking directly to the translated post,
- the `hreflang` alternate links in `<head>`,
- the automatic browser-language redirect.

Keep `date` and `tags` identical to the English version so both listings stay
consistent.

A post without a translation is fine: it simply only appears on the site of
its own language, and the language switcher falls back to the other
language's home page.

### Translating other content

The same suffix convention applies everywhere in `content/`:
`about.md` / `about.fr.md`, `_index.md` / `_index.fr.md`, etc.

### UI strings and site chrome

- Theme UI strings (labels, dates, aria-labels) live in
  `themes/modeline/i18n/en.toml` and `themes/modeline/i18n/fr.toml`.
- Per-language site params (hero text, description) and menus live in
  `hugo.toml` under `[languages.en]` / `[languages.fr]`.

## 5. Preview

```bash
make serve        # live-reload server with drafts + future posts
```

Open `http://localhost:1313/` (English) and `http://localhost:1313/fr/`
(French). Check both languages, and use the EN/FR switcher in the header to
verify the two versions are linked.

Note: the site auto-redirects based on your browser language on first visit.
Your explicit choice via the EN/FR switcher is stored in `localStorage`
(key `lang`) and always wins; clear it from the browser console with
`localStorage.removeItem("lang")` to test detection again.

## 6. Publish

1. Set `draft: false` (in **both** language files).
2. Run `make check` — it fails on broken refs and template errors.
3. Commit and merge to `master`; the GitHub Actions workflow
   (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages
   automatically.
