# Style Genome

The house style a repository writes in, captured as a profile so new code (and
AI-written code in particular) is indistinguishable from what is already there.
The profile lives at `CODEDNA.md` in the project root. This file is the contract
for producing it, keeping it honest, and checking work against it.

Lineage: the discipline comes from codedna (github.com/hannsxpeter/codedna), the
standalone skill that fingerprints a codebase's style. Godpowers reimplements the
measurement in `lib/style-stats.js` rather than depending on it. Neither project
references the other at runtime; fixes travel between them as edits, not imports.

## Why this exists as an artifact

Two agents already consume `CODEDNA.md` when it happens to be there:
`god-executor` matches it while editing, `god-quality-reviewer` reviews against
it. Neither is allowed to create one, and until now nothing else was either. So
the profile existed only if the user installed a separate tool and ran it, which
made a documented input to two agents an accident of the user's toolbox.

`god-repo-scaffolder` owns it now, at the repo tier, next to the other dev
standards it already writes.

## What a profile may claim

Formatters and linters already settle indentation, quotes, semicolons, line
width, and import order. A profile that restates them is a second source of truth
that loses to the tool the moment they disagree. The genome spends its lines on
what no tool enforces:

| Layer | Who settles it | Goes in the profile as |
|---|---|---|
| Formatter and linter rules | the tool | a config map: file, tool, and the conventions it owns. Then "run X" |
| Measured frequencies | `lib/style-stats.js` | numbers, quoted from the run |
| Voice and judgement | close reading | rules, each paired with a real 2-4 line snippet from this repo |

**Enforced or observed, never both.** Every rule is tagged. `enforced` means a
named config rewrites it; `observed` means the code does it consistently and
nothing checks it. A rule tagged neither is a preference somebody typed.

## Evidence order, cheapest and most authoritative first

1. **Read the configs.** Whatever `.editorconfig`, the formatter, and the linter
   already settle is enforced ground truth and is mapped, not re-derived.
2. **Measure.** Run `lib/style-stats.js` over the tree. It reports comment
   density, naming-casing histograms per identifier kind, function-length median
   and p90, identifier-length median and p90, quote and indentation habits, and
   documentation coverage, per language.
3. **Close-read.** Sample 5 to 10 representative files for the things no counter
   sees: comment voice, error posture, extraction threshold, idiom vocabulary.

Numbers are evidence to interpret, not rules to paste. When the histogram and the
code disagree, the code wins and the exception is recorded.

## The specificity gate

Every rule passes the substitution test: swap in another project and the sentence
must become false. "Uses descriptive names" survives any substitution and is
therefore not a rule about this repository. Sharpen it with a measured value or
cut it.

## Known inconsistencies, and local dialect

A real codebase is not uniform, and flattening it into one rule is itself a tell
(see number 6 below). The profile carries a known-inconsistencies section
recording real exceptions, and one standing rule: **the dialect of the file being
edited beats the global profile.** A file that consistently does something else
is a local convention, not a defect to normalize.

## Freshness

The profile is stamped with a version and a date. It is re-derived after a
formatter or linter change, a framework migration, or a deliberate
convention-changing refactor. A profile whose date predates a style shift
silently mismatches every new file, which is worse than having none, because
`god-executor` trusts it.

## AI tells

AI-written code defaults to maximally explicit, maximally defensive, uniformly
consistent, and eager to explain. Real authors are selectively terse, selectively
defensive, characteristically inconsistent, and sparing with explanation. Have-not
U-01 names the failure; this is the enumeration behind it, so "AI-slop" is a
checklist rather than a judgement call.

The profile's own anti-tells section lists only the entries this repository
actually deviates on, each with the project-specific value that makes it
checkable. A tell that does not describe this repository produces false positives,
and a false tell costs as much trust as a missed one.

1. **Over-commenting**: a comment above nearly every block.
2. **Narrating the obvious**: a comment that restates the line below it.
3. **Names longer than the house norm**: `responseData` and
   `handleButtonClickEvent` where the author writes `res` and `onClick`.
4. **Defensive boilerplate**: try/catch, null checks, and re-validation the
   author would not write.
5. **Over-abstraction, or under**: a one-line helper, or a factory the project
   does not warrant, against an author who inlines; the reverse for an author who
   extracts early.
6. **Uniform consistency**: every rule applied perfectly, flattening the
   characteristic local dialect of individual files.
7. **Docstrings on everything**: parameter and return blocks that restate the
   signature.
8. **Explainer voice**: "Now we iterate", first-person plural, full sentences in
   a terse codebase.
9. **Section banners and dividers** in a repository that has none.
10. **Emoji and decorative Unicode** in a repository that has none.
11. **Restating the prompt or the plan** in comments.
12. **Leftover scaffolding**: demo main blocks, debug logging, completed TODO
    markers.
13. **Parallel utilities and vocabulary drift**: a second date formatter, or two
    verbs used interchangeably for one operation.
14. **Belt-and-suspenders typing**: explicit return types everywhere in an
    inferring codebase, redundant casts.
15. **Verbose logging and error messages** in a codebase that logs sparingly.

Numbers 9 and 10 are already mechanical in this repository as have-nots U-08 and
U-09. The rest are review-time checks against the profile.

## Profile shape

`CODEDNA.md` opens with a TL;DR of about ten rules, then sections for the config
map, naming, comments and documentation, structure and decomposition, control
flow and error handling, types, imports and modules, tests, idioms and
vocabulary, known inconsistencies, and anti-tells. Every rule carries its
`enforced` or `observed` tag. Every observed rule carries a snippet.

## Have-Nots

A style genome FAILS if:

- It restates a convention the config map assigns to a formatter or linter.
- A rule survives the substitution test.
- A numeric norm appears with no measurement behind it.
- An observed rule ships with no snippet from this repository.
- The anti-tells section lists tells this project does not actually deviate on.
- The known-inconsistencies section is absent on a codebase that has any.
- The stamp is missing, or predates a formatter, framework, or convention change.
