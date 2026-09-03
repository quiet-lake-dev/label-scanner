# Label Check

A small web app that checks an alcohol beverage label image against the
details entered on its COLA application: brand name, class/type, alcohol
content, net contents, bottler name and address, country of origin, and the
government health warning statement.

The label is read by a vision model. Whether it *matches* is decided by plain
code, so every result comes with the rule that produced it.

See [docs/approach.md](docs/approach.md) for the reasoning behind the design,
the assumptions made, and known limitations.

## Running it locally

You need Node.js 20 or newer and an Anthropic API key.

```bash
npm install
cp .env.example .env.local   # then put your ANTHROPIC_API_KEY in .env.local
npm run dev
```

Open http://localhost:3000. Leave `APP_PASSWORD` blank in `.env.local` and the
login screen is skipped.

Other commands:

```bash
npm test            # unit tests for the matching rules (no API calls)
npm run typecheck
npm run lint
npm run build && npm start
node scripts/make-samples.mjs   # re-render the sample labels in public/samples
```

## Using it

**One label.** Drop in a picture of the label, type what the application says,
and press *Check label*. Every field is optional: fill in the ones you want
compared, or leave them all blank to check just the government warning. You
get an overall verdict and one table with a row per field showing what the
application says next to what was read off the label, ending with the
government warning and any wording differences highlighted. The "Or try a
sample" drop-down loads ready-made labels with their application details
filled in: one realistic label and four flat ones that each show a different
outcome.

**Batch.** Upload a CSV with one row per application and a `filename` column,
then select the label images. Rows are matched to images by filename, checked
four at a time, and the results can be downloaded as a CSV. A blank template
is available from the page. Column names are matched loosely (`Brand Name`,
`brand_name` and `brand name` all work).

## Deploying

The app is a standard Next.js project and deploys to Vercel with no extra
configuration. Set two environment variables in the project settings:

| Variable            | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| `ANTHROPIC_API_KEY` | Key for the vision model.                                      |
| `APP_PASSWORD`      | Shared password visitors must enter. Leave unset to disable.   |

`LABEL_MODEL` optionally overrides the model id (default `claude-sonnet-5`).

## Layout

```
app/
  page.tsx            single-label screen
  batch/page.tsx      batch screen
  login/page.tsx      password prompt
  api/verify/route.ts accepts an image + application JSON, returns the result
  api/login/route.ts  sets the session cookie
lib/
  types.ts            data shapes shared by client and server (zod schemas)
  extract.ts          the one model call: image in, structured JSON out
  compare.ts          per-field matching rules
  warning.ts          government warning check and word-level diff
  verify.ts           rolls field results and the warning up into a verdict
  csv.ts, text.ts     small helpers
  *.test.ts           unit tests
components/           form, image picker, result display
proxy.ts              redirects to /login when the password cookie is missing
scripts/make-samples.mjs  renders the demo labels from SVG
```
