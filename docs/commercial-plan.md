# Hunch Insights: a game that produces price perception research

Working business proposal, 5 October 2026. Commercial prices below are hypotheses to test with buyers, not established market rates.

## What companies would buy

A study answering a specific commercial question: “Do our target shoppers understand the value of this product, and which offer or message should we test next?”

Sell a research project and its aggregate findings. A player guessing S$50 does not mean they would buy at S$50. The game records expected retail price; an optional question separately records stated maximum willingness to pay. Neither is observed purchasing behaviour.

Initial buyer hypotheses:

| Buyer | Useful question | Deliverable |
| --- | --- | --- |
| Independent café or food brand | Does the new menu item look worth its proposed price? | Perception distribution, separately stated budgets, messaging test brief |
| Beauty or lifestyle brand | Does packaging communicate the intended premium? | Randomised packaging comparison and perception gap |
| Consumer brand or retailer | Which bundle communicates the best value? | Bundle comparison with category-buyer recruitment |
| Research or marketing agency | Can a game collect usable responses for a client study? | White-label study with aggregate results and methodology |

These are proposed targets, not customer commitments. Start with one category where we can recruit actual category buyers and get access to a partner's genuine product materials.

## A concrete first offer

**Product Perception Pilot:** one decision, one target audience, 3–5 company products, about 100 eligible participants, aggregate findings and one proposed follow-up experiment. Aim for at least 100 first-exposure responses per product if all participants see all products. This is an operational pilot target, not a universal sample-size requirement or representative-population claim. Comparisons between variants need a separately planned sample per arm.

Proposed initial price to validate: S$1,500–3,000 for study setup, analysis and readout, with recruitment/incentives quoted separately. Track labour and recruitment cost before committing to this fee. Do not promise an optimal price or a guaranteed sales increase.

Buyer deliverables:

1. One-page decision brief: question, audience, findings and what should be tested next.
2. Per-product report: median perceived price, interquartile range, distribution, stated maximum-pay summary, eligible sample count and benchmark provenance.
3. Aggregate export with definitions, study dates and response exclusions; no player names, credentials, room codes or raw participant records.
4. A readout and a proposed actual offer/conversion experiment, designed with the company.

The first deliverable should be a paid study, before building a subscription portal. Consider recurring category tracking only when several buyers ask for repeated measurement.

## How the study should work

Company brief → verified product/specification and audience → approved stimuli and consent → screened recruitment → first-exposure game session → aggregate analysis → client report → real-world offer test.

Separate entertainment sessions from dedicated client studies. A casual student/friend sample can demonstrate the experience but cannot support claims about all Singapore shoppers. In a dedicated study, hold product specifications constant, randomise order, distinguish branded and unbranded conditions, and collect budget answers before any price reveal. Use exact, licensed product imagery; category illustrations in the game catalog are insufficient for SKU-level research.

For packaging or messaging comparisons, randomly assign each participant one version. Do not show both versions and then treat their answers as independent. Repeated play and prior price reveals contaminate first-exposure measurements. Define exclusions up front, deduplicate respondents within a study, and report completion and missing-answer rates. A maximum-pay answer of zero is valid, not missing.

For price acceptance, add a separate study module using a suitable established method. Qualtrics describes Gabor–Granger purchase questions at specific prices, Van Westendorp price thresholds, and monadic studies in which each group sees one price. The current game does not implement those studies. [Qualtrics pricing research guide](https://www.qualtrics.com/articles/strategy-research/how-to-run-pricing-study/).

## Catalog and benchmark governance

The playable catalog now contains 48 items across eight categories. Every new room selects ten unique items, covers all categories and shuffles the order. Different games can independently draw the same items. Existing saved rooms retain their prior selections.

`server/catalog.json` is a reusable snapshot of the dataset; `server/products.js` and `server/catalogExpansion.js` are its source. Run `node scripts/export-catalog.js` after catalog edits.

All present prices are demo SGD benchmarks, not verified current retail prices. Descriptions define quantities/specifications and new non-branded entries are illustrative product concepts. Images are labelled illustrations. The dataset contains no invented consumer response records; old synthetic cohort insight fields are omitted from the exported catalog.

Before a client study, record exact SKU, seller, URL or client-supplied evidence, date checked, currency, pack quantity, taxes, delivery inclusion and whether the benchmark is regular or promotional. Verify against a dated source and preserve that study version. Do not retroactively change the benchmark of a completed study. Use verified benchmark metadata in both reports and exports; never silently promote a demo price to a verified one.

## What already works and what remains

Already implemented: multiplayer rooms; pre-reveal guesses; separate optional maximum-pay answers; voluntary research opt-in; future-report exclusion after withdrawal; host-only aggregate insights; minimum-five suppression for each metric; CSV export; benchmark provenance fields; a company portal with per-buyer access keys, pooled cross-room reports, category-level perception gaps, category filtering and a buyer access log. Five responses are a display safeguard, not statistical validation or guaranteed anonymity.

Still required for a sellable hosted research service:

- Company accounts with key rotation and tenant isolation per client study (today every buyer key sees the same pooled report).
- Study IDs, assigned product sets, immutable stimuli/benchmark versions and recruitment definitions.
- Respondent deduplication, first-exposure tracking and recruitment-quality checks.
- Production database, backups, access logs, retention/deletion rules and internet hosting.
- A documented methodology, client statement of work, permitted-use terms and source/image permissions.
- Review of consent, disclosure, withdrawal and cross-border processing arrangements for the actual operation.

For Singapore, PDPC outlines notification, consent, purpose limitation, protection, retention and transfer obligations. Consent text must describe the real commercial use; selling aggregate outputs is not automatically a guarantee of anonymisation. [PDPC data protection obligations](https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act/data-protection-obligations), [PDPC anonymisation guidance](https://www.pdpc.gov.sg/help-and-resources/2018/01/basic-anonymisation).

## Four-week validation sequence

Week 1: Interview five prospective buyers in one category. Ask about a recent pricing or value-communication decision, the evidence they lacked, who approves research spend and what would make a report actionable. Obtain one concrete study brief.

Week 2: Prepare the scoped pilot proposal, product materials and recruitment plan. Agree on audience, exclusions, deliverables, fee and intended decisions before collecting research. Confirm willingness to pay with a signed pilot, rather than general enthusiasm.

Week 3: Run the consented study, check quality and produce the aggregate decision brief. Do not imply that illustrative game prices or casual player data are validated market research.

Week 4: Review findings with the buyer, define an actual commercial experiment and ask whether they would purchase a repeat study. Measure study completion, cost per eligible completed response, time to deliver, gross margin and paid repeat interest. Build a client portal only once the work and repeated demand justify it.
