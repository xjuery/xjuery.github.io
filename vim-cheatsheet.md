# Vim Cheatsheet

> Essential commands & shortcuts for daily use — for sysadmins and developers.

**Modes:** `NORMAL` · `INSERT` · `VISUAL` · `COMMAND` · `EX`

---

## ⌨️ Modes

| Key | Action |
| --- | --- |
| `i` | Insert before cursor |
| `I` | Insert at line start |
| `a` | Append after cursor |
| `A` | Append at line end |
| `o` | Open new line **below** |
| `O` | Open new line **above** |
| `v` | Visual **character** mode |
| `V` | Visual **line** mode |
| `Ctrl`+`v` | Visual **block** mode |
| `Esc` | Return to **Normal** mode |
| `:` | Enter **Command-line** mode |

## 🧭 Motion `NORMAL`

| Key | Action |
| --- | --- |
| `h` `j` `k` `l` | ← ↓ ↑ → (character) |
| `w` / `W` | Next word / WORD start |
| `b` / `B` | Prev word / WORD start |
| `e` / `E` | Word / WORD end |
| `0` | Start of line |
| `^` | First non-blank char |
| `$` | End of line |
| `gg` | First line of file |
| `G` | Last line of file |
| `:N` | Go to line **N** |
| `%` | Jump to matching bracket |
| `{` / `}` | Prev / next blank line |
| `Ctrl`+`d` | Scroll half-page down |
| `Ctrl`+`u` | Scroll half-page up |
| `zz` | Center cursor on screen |

## ✏️ Editing `NORMAL`

| Key | Action |
| --- | --- |
| `x` | Delete char under cursor |
| `X` | Delete char before cursor |
| `dd` | Delete (cut) current line |
| `D` | Delete to end of line |
| `dw` | Delete to next word |
| `yy` | Yank (copy) current line |
| `yw` | Yank word |
| `p` | Paste **after** cursor |
| `P` | Paste **before** cursor |
| `cc` | Change entire line |
| `cw` | Change word |
| `C` | Change to end of line |
| `r` | Replace single char |
| `R` | Enter Replace mode |
| `~` | Toggle case of char |
| `J` | Join line below to current |

## ↩️ Undo & Redo `NORMAL`

| Key | Action |
| --- | --- |
| `u` | Undo last change |
| `U` | Undo all changes on line |
| `Ctrl`+`r` | Redo |
| `.` | Repeat last change |

## 🔍 Search & Replace `COMMAND`

| Key | Action |
| --- | --- |
| `/pat` | Search **forward** for pattern |
| `?pat` | Search **backward** for pattern |
| `n` | Next match |
| `N` | Previous match |
| `*` | Search word under cursor → |
| `#` | Search word under cursor ← |
| `:%s/old/new/g` | Replace all in file |
| `:%s/old/new/gc` | Replace all with confirm |
| `:s/old/new/g` | Replace in current line |
| `:noh` | Clear search highlight |

## 💾 File Operations `EX`

| Key | Action |
| --- | --- |
| `:w` | Write (save) file |
| `:w file` | Save as **file** |
| `:q` | Quit |
| `:q!` | Quit without saving |
| `:wq` | Save and quit |
| `ZZ` | Save and quit (shortcut) |
| `ZQ` | Quit without saving (shortcut) |
| `:e file` | Open / edit **file** |
| `:r file` | Read file into buffer |
| `:wa` | Save all open buffers |
| `:qa!` | Close all, discard changes |

## 🔷 Visual Mode Actions `VISUAL`

| Key | Action |
| --- | --- |
| `y` | Yank selected |
| `d` | Delete selected |
| `c` | Change selected |
| `>` | Indent selected right |
| `<` | Indent selected left |
| `~` | Toggle case of selected |
| `u` | Lowercase selected |
| `U` | Uppercase selected |
| `:` | Run ex command on range |
| `gv` | Re-select last visual |

## 🪟 Buffers & Windows `COMMAND`

| Key | Action |
| --- | --- |
| `:ls` | List open buffers |
| `:bn` | Next buffer |
| `:bp` | Previous buffer |
| `:bd` | Delete (close) buffer |
| `:sp` | Split window **horizontally** |
| `:vsp` | Split window **vertically** |
| `Ctrl`+`w` `w` | Cycle between windows |
| `Ctrl`+`w` `h`/`j`/`k`/`l` | Navigate windows ← ↓ ↑ → |
| `Ctrl`+`w` `q` | Close current window |
| `Ctrl`+`w` `=` | Equalise window sizes |

## 🗂️ Tabs `COMMAND`

| Key | Action |
| --- | --- |
| `:tabnew` | Open new tab |
| `:tabe file` | Open file in new tab |
| `gt` | Next tab |
| `gT` | Previous tab |
| `:tabclose` | Close current tab |
| `:tabonly` | Close all other tabs |

## 📍 Marks & Jumps `NORMAL`

| Key | Action |
| --- | --- |
| `ma` | Set mark **a** at cursor |
| `` `a `` | Jump to mark **a** (exact) |
| `'a` | Jump to mark **a** (line) |
| ` `` ` | Jump to previous position |
| `Ctrl`+`o` | Jump list — older |
| `Ctrl`+`i` | Jump list — newer |
| `:marks` | List all marks |

## ⚙️ Macros & Registers `NORMAL`

| Key | Action |
| --- | --- |
| `qa` | Record macro into register **a** |
| `q` | Stop recording macro |
| `@a` | Run macro in register **a** |
| `@@` | Repeat last macro |
| `5@a` | Run macro **a** × 5 |
| `:reg` | Show all registers |
| `"ay` | Yank into register **a** |
| `"ap` | Paste from register **a** |
| `"+y` | Yank to system clipboard |
| `"+p` | Paste from system clipboard |

## 🔠 Text Objects `NORMAL` / `VISUAL`

| Key | Action |
| --- | --- |
| `ciw` | Change **i**nner **w**ord |
| `caw` | Change **a**round word |
| `ci"` | Change inside quotes |
| `ci(` | Change inside parens |
| `ci{` | Change inside braces |
| `ci[` | Change inside brackets |
| `dit` | Delete inner HTML tag |
| `yip` | Yank inner paragraph |
| `vas` | Visual select around sentence |
| `vap` | Visual select around paragraph |

## ↦ Indentation & Formatting `NORMAL`

| Key | Action |
| --- | --- |
| `>>` | Indent current line right |
| `<<` | Indent current line left |
| `=G` | Auto-indent to end of file |
| `gg=G` | Auto-indent entire file |
| `gq` | Format/wrap selected text |

## 🛠️ Useful Ex Commands `EX`

| Key | Action |
| --- | --- |
| `:set nu` | Show line numbers |
| `:set rnu` | Relative line numbers |
| `:set ic` | Case-insensitive search |
| `:set paste` | Paste mode (no autoindent) |
| `:syntax on` | Enable syntax highlighting |
| `:! cmd` | Run shell command |
| `:r !cmd` | Insert shell output |
| `:sort` | Sort selected lines |
| `:g/pat/d` | Delete lines matching pattern |
| `:v/pat/d` | Delete lines NOT matching |

## 📁 Folding `NORMAL`

| Key | Action |
| --- | --- |
| `za` | Toggle fold at cursor |
| `zo` | Open fold |
| `zc` | Close fold |
| `zR` | Open all folds |
| `zM` | Close all folds |

---

# ⚡ Power Techniques

## 💬 Block Commenting

### Add `#` to a block of lines (Python / Bash / YAML) — recommended

1. Move cursor to the **first line** to comment, in the first column.
2. Enter Visual Block mode: `Ctrl`+`v`
3. Select down to the **last line** with `j` (or `↓`, or a count like `9j`).
4. Press `I` (capital i — *Insert at block start*).
5. Type `#` (or `# ` with a space for style).
6. Press `Esc` — the `#` appears on every selected line.

> **Tip:** Works identically for `//` (C/Java/JS), `--` (SQL/Lua), or any prefix you need to insert column-aligned across lines.

### Remove `#` from a block (uncomment)

1. Place cursor on the `#` character of the first commented line.
2. Enter Visual Block: `Ctrl`+`v`
3. Select down through all commented lines with `j`.
4. Press `x` (or `d`) — deletes the selected column (the `#`) from every line at once.

> If comments have a trailing space (`# `), extend the Visual Block one column right with `l` before deleting.

### Comment a range using `:norm` (Ex command approach)

1. Visually select lines (with `V`) **or** use a line range like `:5,20`
2. Run: `:'<,'>norm I#` — inserts `#` at the start of each line in the selection.
3. To uncomment: `:'<,'>norm ^x` — jumps to first non-blank char and deletes it.

> **Tip:** `:norm` runs a Normal-mode command on every line in the range. Pair it with any keystroke sequence for powerful bulk edits — not just comments.

### Block comments with delimiters — C / CSS style (`/* … */`)

1. Go to first line, press `O` to open a line above and type `/*`, then `Esc`.
2. Go to last line, press `o` to open a line below and type `*/`, then `Esc`.
3. Optionally use `:'<,'>norm I * ` to prefix each inner line for style.

## 🚀 Advanced Techniques

### Add text to the end of multiple lines at once

1. Visual Block: `Ctrl`+`v`, select lines with `j`.
2. Press `$` to extend selection to each line's end.
3. Press `A` (append), type your text, press `Esc`.

> **Example:** Append a comma to 10 lines for a quick CSV fix — `Ctrl+v` → `9j` → `$` → `A` → `,` → `Esc`

### Increment / decrement numbers in a column

1. Visual Block: `Ctrl`+`v`, select the number column.
2. `g Ctrl+a` — sequentially increments each number (1, 2, 3…). `Ctrl+a` alone increments all by 1.
3. `g Ctrl+x` — sequentially decrements.

### Global search and execute — delete / transform matching lines

1. `:g/TODO/d` — delete every line containing **TODO**.
2. `:g/def /norm O# ---` — insert a comment banner before every Python function.
3. `:v/import/d` — keep *only* lines matching **import** (inverse global).

### Dot-repeat a complex change across the file

1. Make your change once (e.g. `ciw` → type replacement → `Esc`).
2. Search for next target: `n`
3. Repeat the change: `.` — iterate `n .` `n .` through the file selectively.

> **Why:** More surgical than `:%s///g` — you confirm each occurrence before applying.

### Sort and deduplicate lines

1. Select lines in Visual mode, then `:sort` — sorts alphabetically.
2. `:sort!` — reverse sort.
3. `:sort u` — sort and remove duplicate lines (**u**nique).
4. `:sort n` — sort numerically.

### Run a macro on every line matching a pattern

1. Record your macro into register **q**: `qq` … `q`
2. Run: `:g/pattern/norm @q` — executes macro **q** on every matching line.

> **Example:** `:g/def /norm @q` — apply your macro to every function definition.

---

`:wq` — *write. quit. ship it.*
