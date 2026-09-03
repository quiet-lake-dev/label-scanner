# Approach

## What the stakeholders asked for

Reading the interview notes, four things stood out and shaped most of the
decisions below.

1. **Five seconds or nobody uses it.** The previous vendor's 30 to 40 second
   turnaround killed adoption. Everything here is built around one model
   call per label and nothing else on the critical path.
2. **It has to be obvious.** Half the team is over 50 and the benchmark user is
   a 73-year-old. One screen, big controls, plain-language results.
3. **Judgment, not string equality.** "STONE'S THROW" and "Stone's Throw" are
   the same brand. The tool needs a middle tier between pass and fail.
4. **The warning statement is exact.** Word for word, with "GOVERNMENT
   WARNING:" in capitals and bold. Title case is a rejection.

Plus two things to explicitly leave out: COLA integration and storing anything.
The app keeps nothing; each request is processed and forgotten.

## Two stages: the model reads, the code decides

The main design decision is to split the work in two.

**Stage one is perception.** The label image goes to a vision model (Claude
Sonnet 5 through the Anthropic API) with a prompt that says, in effect,
"transcribe every required field exactly as printed, and tell me how
confident you are." The response is constrained to a fixed JSON schema using
the API's structured output feature, so the shape is guaranteed and the rest
of the pipeline never has to parse free text. The model is told not to
correct, normalise, or judge anything.

**Stage two is matching, and it is ordinary TypeScript.** `lib/compare.ts`
holds one rule per field. `lib/warning.ts` checks the government warning.
`lib/verify.ts` rolls the results up into a verdict. None of this touches the
network.

Why not just ask the model "does this label match the application?"

- **The agent can see why.** Every field result carries a note naming the rule
  that fired ("Same wording; only capitalisation differs", "Label shows 6.5%
  alcohol by volume; application says 5.5%"). A skeptical reviewer can check
  the reasoning instead of trusting a black box.
- **It is testable without the model.** There are 45 unit tests covering the
  matching rules and the warning check. They run in a quarter of a second
  and cost nothing. The behaviour for "Government Warning" in title case is a
  test, not a hope.
- **It is consistent.** The same inputs always give the same verdict. Models
  are less predictable on borderline calls, and consistency matters in a
  compliance setting.
- **Each part does what it is good at.** A vision model is very good at
  reading messy images. Code is very good at applying a rule the same way
  every time.

### Field rules in brief

| Field | Match | Minor discrepancy ("Check") | Mismatch |
|---|---|---|---|
| Brand name | Same after ignoring case, punctuation and spacing | One is a shorter form of the other, or nearly identical (likely typo or misread) | Otherwise |
| Class / type | Same after normalising | Label contains all the application's words plus extras, or heavy overlap | Otherwise |
| Alcohol content | Same percentage. Proof is accepted and halved. | Could not read a number, or proof on the label disagrees with its own percentage | Different percentage |
| Net contents | Same volume after converting units (mL, cL, L, fl oz, and so on), within 1% for rounding | Could not read a volume | Different volume |
| Bottler | Most words agree after dropping boilerplate like "distilled and bottled by" | Partial overlap | Little overlap |
| Country of origin | Same country after stripping "product of" and resolving common aliases | | Different country |

A field the model could not find is reported as **not found**, or as
**unreadable** when the image itself is poor. Optional fields left blank on
the application are skipped rather than counted against the label.

### The government warning

The check runs in order:

1. Is there a warning at all?
2. Does it begin with exactly `GOVERNMENT WARNING:`? The model is asked to
   preserve capitalisation, so `Government Warning:` comes back as printed
   and fails here.
3. Ignoring case, punctuation and line breaks, is the wording identical to
   27 CFR 16.21? If not, a word-level diff shows what was dropped or added.

Bold type is different. Vision models are not reliable at judging font
weight, so the model's opinion on whether the heading is bold is shown as an
advisory ("confirm by eye") rather than a pass/fail. The same goes for
legibility and relative type size. I would rather be honest about that limit
than produce a confident wrong answer.

### Verdicts

The tool assists; the agent decides. Language is deliberately soft.

- **Likely approve**: everything matches and the warning is correct.
- **Needs review**: minor discrepancies, a field not found, or the model
  doubts the heading is bold.
- **Likely reject**: a real mismatch, or a warning problem. Reasons listed.
- **Cannot verify**: the image is too poor to read. Ask for a better photo.

## Speed

- One model call per label, with the model's effort setting at its lowest.
  Typical end-to-end time on the samples is a few seconds; the exact number
  shows on screen after every check.
- Images are shrunk in the browser before upload. A 4000 pixel phone photo
  becomes a 1568 pixel JPEG, which is what the model would downsample to
  anyway. This makes the upload several times smaller.
- The wait is visible. The button counts up in tenths of a second while the
  model works. People tolerate a wait far better when they can see it moving.
- Batch mode runs four labels at a time and fills the table as each finishes,
  so a 200-label batch produces results from the first few seconds onward.

## Interface

One screen, two steps, one button. Picture on the left, application details on
the right, a large "Check label" button underneath, results below that. Type
is set larger than usual. Colours are used the conventional way (green,
amber, red) but never alone: every status also has a word.

Sample labels are built in so a reviewer can see each outcome without hunting
for test images.

## Tools

- **Next.js 16 with TypeScript.** One codebase for the page and the API,
  deploys to Vercel with no configuration.
- **Anthropic SDK** for the model call, with zod-defined structured output.
- **Tailwind** for styling.
- **vitest** for the unit tests.
- **sharp** (dev only) to render the sample labels from SVG.

## Assumptions

- The agent is the one entering application values, so the application side is
  trusted as typed. The tool checks the label against it, not the reverse.
- Alcohol content on the application is compared exactly to the label. The
  tolerances in the regulations (for example 0.3% for spirits) apply to the
  liquid versus its label, not to the label versus its paperwork.
- Country of origin only needs checking for imports, so it is optional and
  skipped when blank.
- Class/type rules differ by beverage category. The beverage type is
  collected but, in this prototype, only feeds the model's context; the
  matching rule is the same for all three.
- Uploaded images are processed in memory and never written anywhere.

## Limitations and what I would do next

- **Cloud API.** TTB's network blocks outbound calls to most ML endpoints, so
  this exact deployment would not work inside the agency. The design does not
  depend on any one provider: `lib/extract.ts` is the only file that talks to
  a model, and a self-hosted vision model behind the same function signature
  would slot in. Everything from stage two onward is unchanged.
- **Bold and prominence.** Advisory only, as described above. A production
  version could add a classical image-processing check of stroke weight in
  the heading region.
- **Rate limiting** is in memory per server instance, which is fine for a
  prototype and not for real traffic.
- **Batch matching is by filename.** That is how the importer's bundle
  usually arrives, but it would be worth supporting a zip upload and
  matching on an application number.
- **Beverage-specific rules.** Wine between 7% and 14% may say "table wine"
  instead of a percentage; malt beverages may omit alcohol content in some
  states. A next step would be to encode those exceptions per beverage type.
- **Poor photographs.** The model copes reasonably with angle and glare and
  reports what it saw; the rules downgrade to "unreadable" rather than
  guessing. Genuinely bad images still need a better photo, as today.
