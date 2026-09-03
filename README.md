# Label Check

Checks an alcohol beverage label against what was typed on its COLA
application: brand name, class/type, alcohol content, net contents, bottler
name and address, country of origin, and the government health warning.

A vision model reads the label. Plain TypeScript decides whether it matches.
That split is the main idea in the codebase and most of this document is
about why.

## Trying the deployed version

Live at: **https://label-scanner-ten.vercel.app**

It sits behind a shared password, which is in the submission form rather than
here. Once in, the quickest tour is the "Or try a sample" drop-down on the
first screen. It loads a label picture with its application details filled
in; press *Check label*. The batch page has a downloadable test kit (six
pictures and a CSV) that exercises every verdict the tool can give.

Nothing is stored. Each request is processed in memory and dropped.

## Running it locally

Node 20 or newer and an Anthropic API key.

```bash
npm install
cp .env.example .env.local   # put your ANTHROPIC_API_KEY in it
npm run dev
```

Then open http://localhost:3000. If `APP_PASSWORD` is blank the login screen
is skipped, which is what you want locally.

```bash
npm test             # 51 unit tests for the matching rules, no network
npm run typecheck
npm run lint
npm run build && npm start
```

Deploying: it is a stock Next.js app and Vercel builds it with no extra
config. Set `ANTHROPIC_API_KEY` and `APP_PASSWORD` in the project settings.
`LABEL_MODEL` optionally overrides the model id (default `claude-sonnet-5`).

## Using it

**One label.** Drop in a picture, type what the application says, press
*Check label*. Every field is optional. Fill in the ones you want compared, or
leave them all blank and it checks only the government warning. You get a
verdict and one table: a row per field with the application value next to
what was read off the label, and the warning statement last, with any wording
differences marked up.

**Batch.** Upload a CSV with a `filename` column and one row per application,
then select the label images. Rows are matched to images by filename and run
four at a time, filling the table as each finishes. One column per check, so
a batch can be read down a column as well as across a row. Results download
as CSV. *Details* on any row opens the same side-by-side view as the single
screen, picture alongside. Column names are matched loosely (`Brand Name`,
`brand_name` and `brand name` all work) and there is a blank template on the
page.

**Test kit.** The zip linked from the batch page has six pictures (three flat
artwork files, three photographs of bottles and a can) and a filled-in
`applications.csv`. Two rows match. Two have a small discrepancy: a class/type
written more briefly on the application, and a can that prints the beer name
under the brewery name. Two are plainly wrong (net contents, alcohol
content). The CSV has a `note` column saying what to expect from each; the
app ignores it.

## How it works

Two stages.

**The model reads.** The image goes to Claude Sonnet 5 with a prompt that
amounts to "transcribe each required field exactly as printed and tell me
which ones were hard to make out." The response is pinned to a JSON schema
with the API's structured output, so nothing downstream parses free text.
The model is told not to correct, normalise or judge. It is actually two
calls run in parallel, one for the fields and one for the warning statement,
because that roughly halves the wait (more on that under Speed).

**The code decides.** `lib/compare.ts` has one rule per field,
`lib/warning.ts` checks the government warning, `lib/verify.ts` rolls it up
into a verdict. None of it touches the network.

I could have asked the model "does this label match?" and shipped in an
afternoon. I didn't, for reasons that matter in a compliance setting:

- Every result carries the rule that produced it ("Same wording; only
  capitalisation differs", "Label shows 6.5% alcohol by volume; application
  says 5.5%"). An agent can check the reasoning instead of trusting it.
- The rules are unit tested without the model. "Government Warning" in title
  case failing the check is a test, not a hope.
- Same inputs, same verdict, every time. Models drift on borderline calls.
- If TTB ever swaps the model for something self-hosted, only
  `lib/extract.ts` changes.

### The field rules

| Field | Match | Check (minor) | Mismatch |
|---|---|---|---|
| Brand name | Same ignoring case, punctuation, spacing | One is a shorter form of the other, or off by a character or two | Otherwise |
| Class / type | Same after normalising | Label has all the application's words plus extras, or heavy overlap | Otherwise |
| Alcohol content | Same percentage; proof accepted and halved | No number readable, or proof disagrees with its own percentage | Different percentage |
| Net contents | Same volume after unit conversion, within 1% | No volume readable | Different volume |
| Bottler | Most words agree after dropping boilerplate ("distilled and bottled by") | Partial overlap | Little overlap |
| Country of origin | Same country after stripping "product of" and aliases | | Different country |

A field the model could not find comes back **not found**, or **unreadable**
if the model flagged it as hard to read. A value that was read but flagged
keeps its result and gets a "confirm against the image" note.

### The warning statement

Checked in order: is there one at all; does it begin with exactly
`GOVERNMENT WARNING:` (the model preserves capitalisation, so title case
fails here); and, ignoring case, punctuation and line breaks, is the wording
identical to 27 CFR 16.21. If not, a word-level diff shows what was dropped
or added.

Bold is different. Vision models are not reliable on font weight, so the
model's view on whether the heading is bold is shown as "confirm by eye"
rather than pass/fail. Same for legibility and relative type size. I would
rather say so than produce a confident wrong answer.

### Verdicts

The tool assists, the agent decides, and the wording is deliberately soft.

- **Likely approve**: all fields match, warning correct.
- **Needs review**: minor discrepancies, a field not found, or doubt about
  the bold heading.
- **Likely reject**: a real mismatch or a warning problem, reasons listed.
- **Cannot verify**: image too poor to read.

### Speed

The five-second figure from the stakeholder notes drove the shape of the
model call. Profiling one call showed about two seconds before the first
token and generation at roughly 130 tokens a second. A full label was ~370
tokens of JSON, so generation was the bigger half. Three changes:

- Split into two parallel calls (fields, warning). Each produces half the
  JSON, so each finishes in about half the time. Costs a second image upload
  per label; worth it.
- Slimmed the schema. Per-field confidence scores became a single list of
  hard-to-read field names, empty in the common case. Anything the code can
  work out itself (is the heading in capitals?) came out of the schema.
- Shrink photos in the browser to 1200px on the long edge before upload.
  Plenty to read the warning text, and about half a second faster than a
  full-size photo.

End to end on the eight samples: 3.2 to 4.2 seconds. The measured time shows
on screen after every check, and the button counts up in tenths while the
model works. People wait better when they can see the clock moving.

## Tools

- **Next.js 16 / TypeScript / React 19.** One codebase for the pages and the
  API route. Deploys to Vercel without configuration.
- **Anthropic SDK** with zod schemas for structured output. Claude Sonnet 5.
- **Tailwind** for styling.
- **vitest** for the rule tests.
- **sharp**, dev only, to render the two made-up labels from SVG and shrink
  the test-kit pictures.

## Assumptions

- The agent types the application values, so that side is trusted as
  entered. The tool checks the label against the application, not the other
  way round.
- Alcohol content is compared exactly. The tolerances in the regulations
  (0.3% for spirits, for example) are about the liquid versus its label, not
  the label versus its paperwork.
- Country of origin only matters for imports, so it is optional and skipped
  when blank. Same for bottler.
- Class/type rules genuinely differ by beverage category. The beverage type is
  collected but in this prototype only feeds the model's context; the
  matching rule is the same for all three.
- For wine, a varietal can stand in for the class designation (27 CFR 4.34),
  so "Reserve Pinot Noir" is the class/type and a separate "California Red
  Wine" line is treated as extra wording rather than a conflicting
  designation. The appellation that must accompany a varietal (27 CFR 4.23)
  is not checked; the application form has no field for it. That would be the
  next field to add.
- Batch input is a CSV plus loose image files, matched by filename. With COLA
  integration out of scope, a spreadsheet is the realistic shape of an
  importer's bundle.
- Images are capped at 4 MB after the browser-side shrink, and the API route
  is limited to 60 seconds. Both are generous for a single label.

## Trade-offs and limitations

- **Cloud API.** TTB's network reportedly blocks outbound calls to most ML
  endpoints, so this exact deployment would not run inside the agency. The
  design does not lean on the provider: `lib/extract.ts` is the only file
  that talks to a model, and a self-hosted vision model behind the same
  function signature would drop in. Stage two is unchanged.
- **Bold and prominence** are advisory, as above. A production version could
  add a classical stroke-weight check on the heading region.
- **The "Needs review" tier is a choice.** The test-kit can prints "Pine Coast
  Brewing Co. Harbor Haze" while the application says "Pine Coast Brewing
  Co.". The tool cannot know which line is the brand and which is the
  fanciful name, so it says so instead of guessing. An agent will clear that
  in two seconds; a false approve would be worse.
- **Rate limiting** is in memory per server instance. Fine for a prototype,
  not for real traffic.
- **Batch matching is by filename.** Supporting a zip upload and matching on
  application number would be the obvious next step.
- **Beverage-specific exceptions** are not encoded. Wine between 7% and 14%
  may say "table wine" instead of a percentage; malt beverages may omit
  alcohol content in some states. Those belong in per-category rules.
- **Bad photographs.** The model copes reasonably with angle and glare and
  reports what it saw; the rules downgrade to "unreadable" rather than guess.
  A genuinely bad image still needs a better photo, same as today.
- **Password gate.** One shared password, a hashed token in a cookie. Enough
  to keep the API bill away from strangers and no more than that.

The longer write-up, including the stakeholder notes that drove the
decisions, is in [docs/approach.md](docs/approach.md).

## Layout

```
app/
  page.tsx             single-label screen
  batch/page.tsx       batch screen
  login/page.tsx       password prompt
  api/verify/route.ts  accepts an image + application JSON, returns the result
  api/login/route.ts   sets the session cookie
lib/
  types.ts             shared data shapes (zod)
  extract.ts           the model call: image in, structured JSON out
  compare.ts           per-field matching rules
  warning.ts           government warning check and word-level diff
  verify.ts            rolls field results and the warning up into a verdict
  ratelimit.ts         in-memory request limiter
  csv.ts, text.ts      small helpers
  *.test.ts            unit tests
components/            form, image picker, result display
proxy.ts               redirects to /login when the password cookie is missing
public/samples/        pictures behind the sample drop-down (see lib/samples.ts)
public/test-kit/       the downloadable zip and CSV for batch mode
scripts/               regenerate the samples and the test kit from source art
```
