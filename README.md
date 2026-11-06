# TCAS Sequence Trainer

A browser-based sequence and function trainer for entrance-exam practice. The app is a dependency-free vanilla HTML/CSS/JavaScript project and stores progress locally in the browser.

## Run locally

Open [index.html](./index.html) in a modern browser.

No build step, package installation, or server is required.

## Practice settings

- **Questions** — choose 5, 10, 20, 30, 50, or a custom run length.
- **Answer mode**
  - Multiple choice with keyboard shortcuts `1`–`5`.
  - Type-answer mode with `Enter` to submit.
- **Difficulty**
  - **Mixed logic** — combines core sequence families.
  - **Hard · entangled functions** — uses compositions such as `F1(F2(n)) + F3(n)`.
  - **Expert · nested functions** — adds another composition layer.
- **Mixed logic composition**
  - **Light** — core rules only.
  - **Balanced** — occasional composed rules.
  - **Composed** — includes entangled functions in mixed runs.

  Difficulty presets:

  - **Normal** — standard arithmetic, geometric, recurrence, interleaved, and polynomial functions.
  - **Mixed logic** — varies the standard families according to the composition setting.
  - **Hard** — focuses on entangled functions.
  - **Expert** — focuses on the most deeply nested function combinations.
- **Anki-style weakness training** — prioritizes weak and due topics.
- **Practice tag** — limits generated questions to saved function tags.
- **Topics** — enable or disable topic families with the topic checkboxes.

## End-of-run review

After each run, the review uses a split layout:

1. Select an answer card on the left.
2. Inspect the larger solution panel on the right.
3. Review the full sequence and missing position.
4. Compare your answer with the correct answer.
5. Read the formatted function rule and calculation steps.
6. Save the function under a custom tag for future practice.

Use **Export practice PDF** from the trainer panel to create a printable worksheet using the current question count, difficulty, composition, tags, and enabled topics. Enable **Use current seed** to export the active/seeded run again; leave it off to create a fresh set. Each sheet includes a numeric seed and QR code at the top. Enter that seed in **Seeded set** (or upload the QR image) to run the same question set in the trainer and see the interactive end-of-run solutions. **Skip to solutions** opens that exact set directly without recording a scored run. The PDF controls can independently include full solutions and per-question hints. Questions appear first and the full positional solutions begin on a new page when included.

Use the prominent **🇹🇭 ไทย** toggle in the header to switch the trainer interface, review screen, topic labels, and PDF configuration text to Thai. Mathematical formulas and sequence values remain unchanged.

Incorrect answer cards are highlighted in red. The solution panel includes animated sequence values, styled mathematical expressions, intermediate values, and the complete derivation for composed functions.

## Function tags

From any solution panel, choose **＋ Save function tag** and enter a tag such as:

- `quadratics`
- `nested functions`
- `needs review`
- `arithmetic`

Tags are stored locally and become available in the **Practice tag** selector. Selecting a tag makes future runs draw only from the tagged function families when those families are enabled.

## Weakness training

When Anki-style training is enabled:

- Incorrect topics receive a short revisit interval.
- Correct topics receive a longer interval.
- Stronger performance increases the ease interval.
- Weak or overdue topics receive higher selection weight.

The dashboard also shows:

- Per-topic accuracy, average response time, and question count.
- Filters for all, weak, or strong topics.
- Recent run accuracy chart.
- Improvement guidance.
- Training frequency and due-state information.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Start a run or begin the ready screen |
| `1`–`5` | Select an answer in multiple-choice mode |
| `Esc` | Quit the active run or close settings |
| `T` | Toggle settings |

## Data and privacy

All settings, statistics, schedules, tags, and session records are stored locally in the browser. No data is sent to a server.

Use **Erase all local data** in Settings to clear the saved trainer data.

## Project files

- [index.html](./index.html) — application layout and controls
- [app.js](./app.js) — question generation, scoring, storage, training scheduling, and review UI
- [style.css](./style.css) — visual design, animations, responsive layout, and solution inspector styling
- [dev.html](./dev.html) — developer lab with generator controls, examples, and storage tools
- [dev.js](./dev.js) — developer catalog and preview tooling
- [favicon.svg](./favicon.svg) — blue triangle application icon (`#145498`)

## Developer lab

Open [dev.html](./dev.html) to use the internal developer tools:

- Browse all 20 sequence/function families.
- View a formula and example sequence for each family.
- Select a family and difficulty preset for a live preview.
- Generate a print-ready PDF for the selected family, difficulty, and sequence length.
- Animate the complete function catalog into view.
- Inspect local session, topic, and tag counts.
- Export the current `localStorage` data as JSON.
- Clear local trainer data while testing a clean state.
