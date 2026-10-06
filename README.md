# Content Idea Matrix (CIM)

A "done-with-you" content idea generator, laid out like a lecturer's marking matrix.
Each column answers one question about a piece of content (what should it do, how will you
present it, how will you shoot it, what will you talk about). Pick one item from each column,
or hit **Randomise**, and CIM turns the combination into a ready-to-shoot content brief.

The four core columns (Content Type, Present Style, Shooting Style, Topic) make **17,640**
unique combinations, and every optional column you switch on multiplies that again. Any content
type works with any present style, e.g. Business Ads × Lakonan.

## What users can do

| Screen | What it's for |
| --- | --- |
| **Build** | The matrix. Pick one item per column, or press **Randomise** (or the <kbd>R</kbd> key). Lock the columns you like and roll the rest, or roll a single column with its dice button. The brief updates live: a hook starter, the goal, how to present, shoot and talk about it, the step-by-step structure and tips. Copy it as text, or copy a ready-made prompt that turns it into a full script in Claude or ChatGPT. |
| **Batch** | Generate 10, 30, 50, 100 (up to 500) unique ideas in one click, e.g. a 30-day plan. Locked columns stay fixed. Save them all, export to CSV or copy them. |
| **Saved** | Shortlisted ideas with notes and a status (Idea → Scripted → Filmed → Posted). Export to CSV. |
| **Library** | Every item in the matrix with its description and visual example: "what is a whip pan and what does it look like?" |
| **Customise** | Add or edit columns and items, set descriptions and plug in visual examples. Export/import the whole matrix as JSON. |

**Your business** (brand, what you sell, who you sell to, niche) is the "small input". It's
optional. When it's filled in, every hook and brief line is written for that business; when
it's empty, blanks like `[product]` are highlighted instead.

**This content** is per video: *what is this content about?* can be a subject ("cooking rendang
with Adabi rendang paste") or the kind of content ("Product USP", "new product", "Raya promo",
"customer reviews"). Recognised kinds of content (see `src/lib/angles.ts`) get hooks written for
them, using the key points, e.g. "Halal certified ✓ Ready in 15 minutes ✓ No MSG ✓ That's Adabi."
Anything else becomes the subject of the hook, e.g. "Top 3 things to know about cooking rendang with Adabi
rendang paste", and *key points or USPs* (one per line) show up as a "Must include" checklist in
the brief, the copied text and the AI script prompt.

Everything is saved in the browser (localStorage), so there's no login and no server.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (generator logic + data checks)
npm run build      # typecheck + production build into dist/
```

### Deploying

It's a static Vite app built with relative paths, so the same build works at a domain root
or in a sub-folder.

- **GitHub Pages** (https://projek-cca.github.io/content-system/):
  `.github/workflows/deploy-pages.yml` tests, builds and deploys on every push. One-time
  setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
  (With "Deploy from a branch" Pages serves the unbuilt source and the page stays blank.)
- **Vercel**: import the repo and keep the defaults (build command `npm run build`, output
  directory `dist`).

## Project layout

```
src/
  data/cim-matrix.json   ← the matrix: all columns, items, descriptions, hooks, media
  data/types.ts          ← the data model (read this before editing the JSON)
  lib/matrix.ts          ← combination counting, randomiser, locks, batch generator
  lib/brief.ts           ← turns a combination into a brief / text / AI prompt
  lib/overlay.ts         ← stores browser customisations as a diff on the built-in matrix
  lib/validate.ts        ← checks a matrix (used for imports and in tests)
  components/            ← the screens
public/media/            ← visual examples live here
```

## Editing the matrix

All content lives in [`src/data/cim-matrix.json`](src/data/cim-matrix.json). You can edit it
by hand, or edit in the **Customise** screen, click **Export JSON** and replace the file with
the export. `npm test` validates the file (unique ids, valid parents, known placeholders).

### Columns (categories)

```json
{
  "id": "shooting",
  "label": "Shooting Style",
  "question": "How will you shoot it?",
  "briefLabel": "Shoot it",
  "color": "#ea580c",
  "optional": false,
  "items": [ ... ]
}
```

- `optional: true` columns start switched off. Users add them from the **Columns** bar
  (Hook, On Camera, Tone, Call to Action and Length ship this way).
- `dependsOn: "<column id>"` (not used by the built-in matrix right now) makes a column depend
  on another. Each item then lists the parent items it belongs to in `parents`, the board
  groups the column under its parent, picking a child selects its parent, and changing the
  parent clears a child that no longer fits.
- `hooksOverride: true` (set on the Hook column) means a picked item's hooks decide the opening
  on their own instead of joining the pool.

### Items

```json
{
  "id": "top-list",
  "label": "Top 3/5",
  "parents": ["educate"],
  "description": "A countdown list of 3 or 5 points...",
  "brief": "Count down 3 or 5 quick points, saving the best one for last.",
  "structure": ["Hook: say the list title...", "Point #3 (good).", "..."],
  "howTo": ["Put the number in the hook...", "..."],
  "example": "A travel agent counts down the top 5 hidden spots in Langkawi.",
  "hooks": ["Top 3 things to know about {subject}"],
  "media": null
}
```

Only `id`, `label` and `description` are required. Don't change an `id` after launch; saved
ideas refer to it.

Placeholders you can use in `brief`, `structure`, `hooks` and `subjects`:
`{brand}` `{product}` `{audience}` `{niche}`. They're filled from "Your business".

**Hooks.** Hook templates are pooled from every pick that has `hooks` (Content Type, Present
Style and Topic each carry some), unless the Hook column is used. `{subject}` in a hook is the
user's "What is this content about?" when they typed one, otherwise the `subjects` of the picks,
usually the Topic, e.g. Topic "Product & Service" has `"choosing the right {product}"`. Write
subjects so they read naturally after "about". "Another hook" cycles through every
hook × subject pairing.

**Bahasa Melayu.** Every column and item has an `ms` object with the BM version of its text
(`question`, `briefLabel`, `description`, `brief`, `howTo`, `structure`, `example`, `hooks`,
`subjects`, and optionally `label`). The **Output language** setting picks what the brief,
library and info panel show:

- *English*: the English text.
- *Bahasa Melayu*: the `ms` text, falling back to English for anything not translated.
- *Mixed (BM + English)*: hooks in BM, instructions in English.

When you change an item's English text, update its `ms` text too. The Customise screen edits
the English text only.

## Adding visuals

Every item has a visual slot. Until one is set, a "Visual example coming soon" placeholder
shows in the info panel and the Library. To add one, set `media` on the item:

```json
"media": { "type": "video", "src": "/media/shooting/whip-pan.mp4", "poster": "/media/shooting/whip-pan.jpg", "caption": "Whip pan between two scenes" }
```

| `type` | `src` |
| --- | --- |
| `video` | An mp4/webm file. It autoplays muted and loops, which works well for short technique demos. |
| `image` | A jpg/png/webp/gif. |
| `youtube` | Any YouTube link (including Shorts) or the video id. |
| `embed` | Any iframe-able link (TikTok, Instagram or Vimeo embed URLs). |

Put files in `public/media/<column id>/<item id>.<ext>`, e.g.
`public/media/shooting/whip-pan.mp4` becomes `/media/shooting/whip-pan.mp4` (paths starting
with `/` are resolved relative to the app, so they work on GitHub Pages too). You can also set
media from the **Customise** screen (edit item → Visual example) and export the JSON.
Vertical 9:16 clips look best, since the slot is shaped like a phone screen.

## How customisations are stored

Edits made in **Customise** are saved as a diff against the built-in matrix, not a full copy.
When the built-in matrix is updated (new items, new visuals), users who customised something
still get the updates for everything they didn't touch. **Reset to default** drops the diff.
