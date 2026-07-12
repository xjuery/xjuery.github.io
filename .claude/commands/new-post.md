---
description: Create a new blog post in English and French (draft in both languages)
argument-hint: <title or topic> [extra context about what the post should cover]
allowed-tools: Bash(make new:*), Bash(hugo new:*), Bash(ls:*), Read, Write, Edit
---

Create a new bilingual blog post from: $ARGUMENTS

Follow the conventions in @docs/writing-a-post.md. Steps:

1. **Derive the slug** from the arguments: lowercase, kebab-case, English,
   short (drop stop words). Example: "Why your YAML is 400 lines" →
   `why-your-yaml-is-400-lines`. If a file with that slug already exists in
   `content/posts/`, stop and ask for a different one.

2. **Scaffold the English post**:

   ```bash
   make new SLUG=<slug>
   ```

   This creates `content/posts/<slug>.md` from the theme archetype.

3. **Fill in the English front matter** in `content/posts/<slug>.md`:
   - `title`: proper English title (title case not required, match the
     existing posts' style).
   - `tags`: pick 1–2 fitting tags; prefer existing ones (check
     `[params.tagColors]` in `hugo.toml` and the tags used by posts in
     `content/posts/`).
   - `summary`: one or two sentences, same tone as existing posts.
   - Keep `draft: true` and the generated `date`.

4. **Write the body** only if the arguments describe the topic well enough;
   otherwise leave a short outline of `##` section headings as a starting
   point. Match the style of existing posts: short paragraphs, `##`/`###`
   headings, fenced code blocks (use `{filename="..."}` where a filename
   helps), an occasional blockquote for the key takeaway.

5. **Create the French translation** at `content/posts/<slug>.fr.md`
   (same filename base — that is what links the two pages as translations):
   - Translate `title`, `summary`, and the body/outline into natural French
     (not word-for-word). Use French typography: « guillemets », spaces
     before `?` `!` `:` `;`.
   - Keep `date`, `tags`, `featured`, and `draft` identical to the English
     file. Do NOT translate the slug, tag names, code, or file names in code
     blocks (translate only comments inside code samples).

6. **Report**: show both file paths and remind that the post can be previewed
   with `make serve` at `http://localhost:1313/posts/<slug>/` (EN) and
   `http://localhost:1313/fr/posts/<slug>/` (FR), and that `draft: false`
   must be set in **both** files before publishing.
