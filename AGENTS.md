# AGENTS.md

## Status and purpose
We are building an AI-based prototype in the Hackathon repository for the ITSG Futury Hackathon. The prototype is a static frontend that illustrates a possible AI review assistant for payroll-software system review of income replacement benefits (Entgeltersatzleistungen). It is not a complete implementation, and many decisions remain open.
This file guides AI coding agents on the ITSG Futury Hackathon project: an AI review assistant for payroll-software system review of income replacement benefits (Entgeltersatzleistungen).

Status: product scope and domain rules are still unconfirmed, but this repository already contains a static frontend prototype. Treat its sample requirements, rules, test cases, and validation results as illustrative. There is no backend, rule engine, database, or payroll integration. Since 2026-10-26 an AI test-case generator calls the hessian.ai gateway through the Vite dev/preview proxy. Also since 2026-10-26: the UI is German, uses an ITSG-style colour scheme, and examiners can upload documents (PDF/DOCX/TXT/MD) from which requirements with verified quotes and then test cases are produced. Requirements, generated cases, feedback and the change log persist in browser localStorage; uploaded documents in browser IndexedDB. Owner decisions are partly confirmed; see "Confirmed owner answers" below.

Read the source material before implementing a domain rule. Ask the owner when a decision affects scope, architecture, expected results, or an external integration. Continue independent work that does not depend on the answer. Record confirmed answers here.

## Source material and its role

Core sources:

| Source | Role | Relevant location |
| --- | --- | --- |
| `Futury-Hackathon-2026-Englisch.pdf` | Organizer's challenge, objectives, illustrative workflow, and optional extensions | Slides 9-12; system-review context on slides 6-8 |
| `Hackathon.pdf` | Owner's handwritten brainstorm; ideas and questions are not all finalized implementation requirements | Repo root, pages 1-2 |
| `DTA-EEL-Beispiel_Vorerkrankung.docx` | DBVO reference scenario, prerequisites, four supplementary criteria, and expected business outcome | Sections `Szenario DBVO`, `Anforderung`, `Voraussetzung`, `Ergänzende Kriterien`, `Ergebnis` |

`Hackathon.pdf`, `DTA-EEL-Beispiel_Vorerkrankung.docx`, `Hinweise_DTA-EEL-Bespiel_Vorerkrankung_Testkonstellation.docx`, `2025_12_10_NS_FLB_TOP_01_…_Anl2.pdf` (Gemeinsames Rundschreiben, non-technical) and `2026_03_10_Endfassung_Verfahrensbeschreibung_DTA_EEL_Version_13.4_ab_01.01.2027.pdf` (technical) are in the repository root and serve as upload test documents. The organizer PDF is not in the repository. On the owner's machine, local copies of the other documents and supporting references are in `~/Downloads/hackathon_itsg/ITSG/`; they are outside git:

- `2026_03_10_Endfassung_Verfahrensbeschreibung_DTA_EEL_Version_13.4_ab_01.01.2027.pdf` — §3.12 DBVO and §3.1.18 Abgabegrund.
- `2026_03_10_Endfassung_Beispielpapier_DTA_EEL_Version_13.3_gueltig_ab_01.01.2027.pdf`.
- `GG_EEL_V13.1_06.05.2025.pdf`.
- `Hinweise_DTA-EEL-Bespiel_Vorerkrankung_Testkonstellation.docx` (filename spelling as supplied).
- `TEEL0-Test1-DBVO` — ISO-8859-1 fixed-width serialized DBVO example.
- The 2024/2025 Grundsätze (GR) PDFs in the same folder.

The DOCX cites the DTA EEL procedure description §3.12 and §3.1.18 and the `Hinweise zur Testkonstellation EEL-Anwendungsprogramme`; local copies of those references exist. Confirm versions before use. The handwritten note appears to read `GG_EEL_V1.3`, while the local file is `GG_EEL_V13.1_06.05.2025.pdf`; confirm which version is intended. Do not invent missing contents or silently substitute a different version.

Keep organizer requirements, owner decisions, brainstorm proposals, and source ambiguities distinguishable. Do not treat a brainstorm idea as mandatory, or the DBVO example as the complete EEL specification. Conflicting domain statements require clarification; this file does not establish a legal precedence rule.

## Organizer requirements

The challenge concerns system review of payroll programs. Its stated focus is payroll processing for income replacement benefits, with maternity benefit and sickness benefit as examples (slide 9). The choice of a narrower first demonstration remains open.

Six objectives must be preserved for the challenge:

| ID | Required capability |
| --- | --- |
| H1 | Identify relevant requirements in the specifications. |
| H2 | Translate the requirements into testable criteria. |
| H3 | Generate test cases with expected results. |
| H4 | Create a traceable test record. |
| H5 | Test payroll software with the test cases and compare observed results with expected results. |
| H6 | Deliver comprehensible test reports. |

Preserve all six as challenge objectives. Ask which must operate in the first implementation and how the remaining objectives will be demonstrated; do not silently drop them.

Slide 10 gives an illustrative workflow: AI generates technical test cases, humans execute them in payroll software, and AI checks the resulting datasets. It does not require an automated SAP or DATEV connector. Running the assistant locally at a software vendor is optional. Building a prototype is also optional in the brief (slide 12); a prototype now exists here, but confirm whether it is the intended deliverable.

The brief asks the concept to offer different technical approaches. Do not interpret this as a requirement to build several complete implementations without confirmation.

## Owner brainstorm to preserve

Keep the following ideas available for confirmation and prioritization:

- Combine a knowledge graph, an ontology, use rule-based model to verify the outputs of another model.
- Link general policy to test cases and to a possible PDF output; make the reasoning or explanation adjustable.
- Preserve the handwritten `PDF?` note as a possible output-format question; PDF export has not been selected.
- Each generated test case will have `Impact/Priority` flags for human to focus on.
- Keep a timestamped change log (display somehow easy to see, user friendly); link test cases to government policy and identify relevant cases. The new test cases should be linked to the original source and the relevant policy. The user should be able to see the source of the requirement and the relevant policy.
- The generated test cases can be verified by the user and the user can provide feedback to the AI. The AI should be able to learn from the feedback and improve its test case generation.
- Use an ITSG color scheme if a UI is built. Here is the website: https://www.itsg.de/ 
- Show AI reasoning/thinking in an understandable way and make it adjustable; clarify what is adjustable on the test cases.
- Preserve the note's bonus idea of distinguishing government specifications from technical documents. Do not promote it to mandatory scope without confirmation. Think as a way to make the reasoning more understandable and traceable, but not as a requirement to implement it now.
- Implement UI in German
- Implement the feature so that user can upload document (e.g., government policies, specifications) and the model can extract relevant information from the document and generate test cases based on that information. Example documents: `DTA-EEL-Beispiel_Vorerkrankung.docx` includes example input specification and the output test case (from the old pipeline). `2025_12_10_NS_FLB_TOP_01_24c24i45SGBV45SGBVII47SGBXIV_Aktualisierung_der_GR_zu_EEL_Anl2.pdf` is an example full non technical government specs and `2026_03_10_Endfassung_Verfahrensbeschreibung_DTA_EEL_Version_13.4_ab_01.01.2027.pdf`is an example full technical specs. The model should be able to extract relevant information from the document and generate test cases based on that information.
- `Hinweise_DTA-EEL-Bespiel_Vorerkrankung_Testkonstellation.docx` is an examople of a document that includes example communication that we are testing for between the payroll software and the government system. the model should be able to extract relevant information from the government specifications and generate test cases to test this communication flow. 
- Check the `SAMPLE-API.md` for the example of how to call the model using the API key and the model name.The model should be able to generate test cases and expected results based on the requirements and the relevant policy. The model should also be able to learn from the feedback provided by the user and improve its test case generation.

Explain outputs using source evidence, explicit rule conditions, relevant input values, and evaluation results. Any graph or explanation must distinguish source-backed statements from generated proposals. A visual dependency graph does not by itself prove that a payroll result is correct.

## Traceability and verification instructions

These instructions make H1-H6 reviewable without choosing a storage technology or field schema:

1. Retain the source filename, available version information, and exact page, section, or criterion identifier for each extracted requirement. Do not invent a missing version or effective date.
2. Keep the original requirement text accessible alongside its interpretation. Record ambiguities instead of removing them during normalization.
3. Maintain the links from source requirement to testable criterion, test case, expected result, observed result, and report finding. If the graph approach is approved, it must preserve those links.
4. Ground expected results in the approved rules and inputs. Do not use an unverified model response as the sole oracle for payroll correctness.
5. Distinguish a generated case, an executed case, an imported payroll result, and a simulated result. Missing execution evidence must remain visible.
6. Compare results only using the selected data format and agreed comparison rules. Report missing data and unresolved rules explicitly.
7. When change tracking is approved, retain the prior source/rule/test version and timestamp, identify affected links and cases, and make the consequences reviewable. Do not silently overwrite the baseline or invent a prioritization formula.
8. Keep reports understandable: show the checked criterion, relevant evidence, expected and observed results, and a concise explanation of the finding. Do not claim complete EEL coverage from the DBVO example alone.
9. Keep the code clean and readable. Use TypeScript's type system to make the data structures and their relationships explicit. Avoid hardcoding values; use constants or configuration files where appropriate. Document functions and components with clear comments explaining their purpose and usage.

Once the owner approves an implementation scope, validate the corresponding behavior with meaningful cases. For DBVO, cover certification, the 30-day threshold, eligibility versus transmitted periods, the six- and twelve-month windows, open-ended AU, illness chains, and uncertified short AU as applicable. Include boundary cases only with verified expected results; keep ambiguous boundaries visibly unresolved.

Do not claim real SAP/DATEV execution, an insurer transmission, a database update, or passing tests unless it actually occurred and the evidence is available. Confirm the intended integration and target before connecting to or writing to an external system.

## Decisions required from the project owner

Ask these questions before implementing dependent features. The owner may explicitly choose to leave a decision open; preserve that instruction rather than supplying a default.

| ID | Decision to confirm |
| --- | --- |
| D1 | Intended deliverable and first scope: concept, runnable prototype, or both; DBVO only or broader EEL; which H1-H6 capabilities must work in the first demonstration. |
| D2 | Existing repository and implementation constraints: the repo is React 19 + Vite + TypeScript; confirm whether to extend it or change stack. Still open: backend, storage/graph technology, AI provider/model, deployment environment, and allowed source access. |
| D3 | Brainstorm priorities: which ideas are mandatory now and which are later or bonus; what users can adjust; whether `Impact/Prior` means impact analysis, test prioritization, or both. |
| D4 | Input/output and execution contract: the desired test-case format, whether the DOCX's scenario structure must be reproduced, how actual payroll results enter the assistant, and whether SAP/DATEV execution is manual, simulated, or integrated. |
| D5 | Authoritative domain references and version: confirm that 13.4/13.3/GG 13.1 are authoritative, how the DOCX-vs-13.4 conflicts will be resolved, and whether uncertain rules should stay blocked in the demonstration. |
| D6 | Language: the language of this instruction file, the interface, explanations, and test reports. German domain terms and source identifiers must remain traceable regardless of presentation language. |

## Confirmed owner answers

Recorded 2026-10-26. Anything not listed here is still open.

- D3/D6 (2026-10-26, second update): Owner asked for (1) the ITSG colour scheme, (2) a German-only UI, (3) document upload with requirement extraction and test-case generation. All three are implemented. The ITSG colours are an approximation because itsg.de was not reachable from the build environment; the four brand hex values in `src/theme.css` must be verified against the ITSG style guide. Domain terms and source identifiers stay verbatim.
- D2 (partial): Extend the existing React + Vite + TypeScript repository. AI provider is the hessian.ai inference gateway (OpenAI-compatible `/v1/chat/completions`). The single active model is configured in untracked `.env.local` as `HAI_MODEL`; it is not selectable in the UI. The API key must never be committed or bundled: it lives there as `HAI_API_KEY` and is injected by the Vite proxy (`/api/llm` → gateway `/v1`). There is no server backend or external graph database; persistence is browser localStorage/IndexedDB.
- D3 (partial): Implement now: AI test-case generation with adjustable reasoning and `Impact/Priority` flags (interpreted as test prioritization: `Hoch`/`Mittel`/`Niedrig` with a reason); examiner feedback that is fed back into later prompts (in-context, no model training); a timestamped change log; an interactive traceability graph. (German UI and ITSG colours: see the 2026-10-26 second update above.)
- D1/D5 (deferred): The DBVO DOCX, organizer PDF and DTA EEL references were not available on the working machine. Domain content stays illustrative sample data; DBVO rules remain unresolved and must not be invented.
- D6: UI, prompts, generated content and exports are German. The language of this instruction file stays English.
- D4: still open (test-case format, how payroll results enter the assistant, execution mode). The generated case format (GEGEBEN/WENN/DANN, Testdaten, Ablauf/Nachrichtenfolge with Abgabegrund, Erwartet, Kriterium-IDs) is a proposal modelled on the DBVO example and the Hinweise-Testkonstellation; confirm it.
- D2/D3 (2026-10-26, third update): The document workflow analyses every section automatically and displays generated test cases rather than a section picker or a separate requirements-extraction step. Each case exposes detailed model justification and local deterministic backend details: a lightweight ontology, a provenance knowledge graph and a readable rule trace in `src/reasoning/`. These aid traceability but are not an OWL reasoner, external graph store, executable payroll rule engine or proof of correctness.
- D3/D4 (2026-10-26, fourth update): The document card offers no Dokumentart selector. The examiner sets only the role, with exactly two options, `Spezifikation` and `Technische Informationen`; both are sources for test-case generation. The former role `Formatbeispiel` (structure-only example, no test cases) was removed together with its prompt and validation plumbing (`FormatExample`/`GenerationContext` in `prompt.ts`, the `context` parameters of `buildMessages`, `generateTestCases` and `runChecks`, and `generationContext` in the document store). The document kind stays a purely automatic keyword classification, kept as evidence and no longer overridable; documents loaded from IndexedDB get the retired role mapped to `Spezifikation`.
- D3/D4 (2026-10-26, fifth update): Expected results stay visible but unconfirmed. The Tests page shows every expected field in the test-plan table (`Erwartet` column), and each case card shows the expected result or an explicit "kein erwartetes Ergebnis" placeholder. The owner asked for this display only: no deterministic rule oracle and no examiner-confirmation step for expected values, so the expected-result block is labelled by a status computed per case in `src/reasoning/expectedStatus.ts` (from the case origin – KI-Vorschlag, regelbasiert, offline demo – and from the requirement's source evidence: verified quote, unverified quote, or sample data without source text), and `[offen – Regel nicht bestätigt]` stays visible.
- D3 (2026-10-26, sixth update): Newly generated test cases receive a random priority (`Hoch`, `Mittel` or `Niedrig`) for prototype demonstration purposes, replacing the priority proposed by the model or local derivation. In `Dokumente & Testfälle`, a writable section filter displays only the first matching source section, with at most five test cases per page. Generated case titles and status metadata remain hidden in that workspace; the complete case remains available elsewhere.
- D3 (2026-10-27, seventh update): Existing persisted cases are redistributed once across `Hoch`, `Mittel` and `Niedrig`; the migration is versioned so priorities stay stable after the reset. When at least three cases exist, all three priorities are guaranteed to appear. Priority badges use red for `Hoch`, orange/yellow for `Mittel`, and blue for `Niedrig`.
- D3 (2026-10-27, eighth update): The test-case workspace in `Dokumente & Testfälle` has combinable filters for priority and review status (`Offen`, `Akzeptiert`, `Abgelehnt`) and can sort either by priority or with open cases first. These controls operate alongside the writable source-section filter.
- D3/H4 (2026-10-27, ninth update): The dedicated `Testfälle` page uses collapsible case cards rather than a table, supports text, priority and review-status filters, and shows at most ten cases per page. Opening one case closes the previous case and displays its full details together with generation/review history from the persisted change log.
- D3/H4 (2026-10-27, tenth update): Test-case cards on both `Dokumente & Testfälle` and `Testfälle` let the examiner submit written feedback and immediately request one AI-generated replacement case for the same requirement. The submitted feedback is persisted before the model call and supplied in-context as rejected feedback for regeneration; both the feedback and the replacement generation are linked to the original case in the change log. If generation fails, the feedback remains saved and the error stays visible.

- H5/H6 (2026-10-27, eleventh update): Owner asked for payroll-result validation on `Validierung & Bericht`. Implemented: examiners upload result files (PDF/DOCX/TXT/MD, stored in IndexedDB store `results`), pick a test case (preselected by a scenario-only heuristic that never looks at whether the result passes), and the model (`HAI_MODEL`, shown as "KI") and a deterministic line matcher ("Regelbasiert") assess each expected field independently; both are shown side by side. (Owner decision 2026-10-27: the earlier second comparison model `HAI_MODEL_2` was removed – only one AI model is compared with the rule-based matcher; comparisons saved with two models are migrated by `normalizeComparison`.) Every model claim is checked locally: the quoted evidence must occur in the result text, every expected field must be assessed, and the overall verdict must follow from the field verdicts. Field-level agreement of KI and rule-based matcher is shown. The examiner saves a binding verdict (overall, per field, which model was right, comment); saved decisions are persisted with the comparison in the review store, logged as change kind `Validierung`, and fed into later comparison prompts as in-context examples (no training). The report shows examiner verdicts, or the model consensus marked as provisional, plus hit rates of KI and rule-based matcher against examiner decisions, and exports CSV. The traceability graph's `Beobachtet`/`Befund` nodes now come from the latest comparison of a case. The fictitious demo results `demo-ergebnisse/demo1.pdf` (correct), `demo2.pdf` (29 days but query 41 sent – deviation) and `demo3.pdf` (no AU certificate, query correctly blocked, log page incomplete) are generated by `demo-ergebnisse/generate_demo_results.py`; they are labelled demo data and describe no real person or payroll run. No real payroll execution or rule engine is connected.

- D3/H4 (2026-10-27, twelfth update): Owner asked for a "Feedback" section under NACHWEIS: one database-like table of all examiner/maintainer feedback that the models use to improve. Implemented at `/feedback` (`src/pages/FeedbackPage.tsx`). Entries are derived from existing data (test-case reviews and comments, comparison decisions, requirement comments – `src/feedback/collect.ts`); only maintainer notes (`feedbackNotes`) and the on/off switches (`feedbackExcluded`) are stored additionally in the review store. Active entries reach the prompts: generation takes up to `FEEDBACK_EXAMPLES_MAX` reviewed cases ranked by relevance (same requirement, then same document, then newest) plus notes for "Generierung"/"Alle"; comparisons take the latest active decisions plus notes for "Abgleich"/"Alle"; extraction skips switched-off requirement comments. This is in-context learning only; no model is trained. Switching, adding and deleting are logged as change kind `Feedback`; the table exports CSV and JSON.

- H4/instruction 7 (2026-10-27, thirteenth update): Owner redefined the `Änderungsprotokoll` as change history with two switchable views (`/changelog?ansicht=regeln|testfaelle`). **Regeln & Spezifikationen**: each document has an optional `predecessorId` (detected on upload from the file name without version/date via `documentStem`, editable on the document card). When a document's rules are extracted, `src/changes/ruleDiff.ts` compares them with the predecessor's rules: pairing by criterion id, else section number + token similarity, else similarity alone; paired rules with different wording are `Geändert` with concrete differences (thresholds, Abgabegrund, number of conditions, section) and a word diff; unpaired rules are `Neu`/`Entfallen` only after a verbatim check against the other version's full text. Each change lists the test cases built on the earlier rule (`affectedCaseIds`). Results are stored as `ruleChanges`/`ruleChangeRuns` in the review store and logged as change kind `Regeländerung`. **Testfälle**: `src/changes/caseHistory.ts` derives one row per case event (created, regenerated from feedback, reviewed, feedback submitted/switched, compared, affected by a rule change, reset) from the persisted change log; the complete raw log stays exportable as CSV. Demo versions `demo-spezifikationen/DEMO_Spezifikation_DBVO_Version_1.0.pdf` and `_1.1.pdf` (fictitious; 1.1 changes 30→42 Tage and 6→3 Monate, drops one criterion, adds one) are generated by `generate_demo_specs.py`.

- H4 (2026-10-27, fourteenth update): Owner asked to fix the requirement search on `Nachverfolgbarkeit` (same style as `Testfälle`) and to show the models' reasoning as a knowledge graph so examiners can spot hallucinations. Implemented: a search field (requirement, test case, document, quote text) with origin filter, "only with grounding warnings" and a paginated requirement list; below it a top-down reasoning graph (`src/reasoning/reasoningGraph.ts`, `src/components/ReasoningGraphView.tsx`): Quelle → Anforderung → Bedingungen & Kriterien → Begründungsschritte des Modells → Testfall → Erwartet & offene Fragen → Ergebnis & Befund. Only the test case in focus is expanded; clicking a node highlights the path it rests on and what follows from it. Local grounding checks (no model call) flag "Quelle" reasoning steps whose terms are mostly absent from the cited section, numbers in reasoning steps or expected values found neither in the source nor in the case's own test data, unverified quotes, failed structural checks and unconfirmed assumptions; a warning is a hint at a possible hallucination, not proof, and a passed check does not prove correctness. `src/utils/traceGraph.ts` was replaced.

## Repository and commands

Verified against the current repository:

- Stack: React 19, TypeScript, Vite, React Router, `lucide-react`, `pdfjs-dist`, `fflate`, and `oxlint`. npm with `package-lock.json`.
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server.
- `npm run build` — `tsc -b && vite build`; this is also the build's typecheck.
- `npx tsc -b` — typecheck only, using the project references in `tsconfig.json`.
- `npm run lint` — run oxlint. There is no ESLint, Prettier, or test runner.
- `npm run preview` — serve the production build.
- No tests exist. Verify changes with `npm run build`, `npm run lint`, and a manual check of the affected screen.

### Structure and current prototype scope

- Entry: `src/main.tsx` → `src/App.tsx` (`ReviewProvider` → `DocumentProvider` → `BrowserRouter`) → `src/pages/*`.
- Routes live in `src/App.tsx`; sidebar links live in `src/components/Sidebar.tsx`. Add or rename pages in both. Unknown routes render `Overview`; `/library` is an alias of `/documents`.
- Pages: `/` Übersicht, `/documents` Dokumente & Testfälle (all sections, internal requirement extraction), `/requirements` redirects to `/documents`, `/generate` advanced Testfall-Generator, `/tests` generated cases + CSV, `/validation` result upload + two-model comparison + examiner decision + report, `/graph` Nachverfolgbarkeit, `/changelog` Änderungsprotokoll.
- Components: `Header`, `Panel`, `Sidebar`, `Status`, `GeneratedCaseCard`, `CaseBackendDetails`, `SourceEvidence`.
- Document pipeline (`src/documents/`, all local in the browser, pure functions where possible): `ingest.ts` (file → sections → classification; PDF via lazily loaded pdf.js in `extractPdf.ts`/`pdfLines.ts`, DOCX via fflate in `extractDocx.ts`) → `segment.ts` (numbered headings, longest increasing heading chain to skip TOC, running headers removed, long sections split into parts with page ranges, version/Stand detection that never guesses) → `classify.ts` (keyword heuristic Fachlich/Technisch/Testkonstellation with evidence; purely automatic, shown as a kind tag) → `rank.ts` (BM25 with German prefix matching) → `ruleExtract.ts` (normative sentences) and `conditions.ts` ("nur …, wenn" split into action + conditions, thresholds like "mindestens 30 Tage", Abgabegrund, criterion UUID) → `storage.ts` (IndexedDB). `text.ts` holds normalization, sentence splitting and quote matching.
- AI flow: `src/ai/extract.ts` (requirement extraction: model with verbatim-quote contract, every quote is re-found in the section text → `quoteVerified`; or rule-based without model) → `prompt.ts` (generation prompt grounded in quote, section text, conditions, ambiguities) → `client.ts` (fetch via proxy) → `parse.ts` → `validate.ts` (deterministic checks: structure, cited sources, Abgabegründe and criterion IDs must occur in the requirement's source text, dates valid) → `generate.ts` (origin `model`, `regelbasiert` or `offline-demo`). `ruleCases.ts` derives cases without a model: regular case, one negative test per condition, boundary pairs per threshold; counting rules stay open questions. `offlineDemo.ts` is a canned reply for the sample requirements only. Constants: `src/config/ai.ts`, `src/config/documents.ts`.
- State: `useReviewStore()` (`src/state/reviewContext.ts`, provider `ReviewProvider.tsx`; localStorage key in `config/ai.ts`) holds requirements (samples + extracted), generated cases, settings and the change log. `useDocuments()` (`documentContext.ts`, `DocumentProvider.tsx`) holds uploaded documents. `useGeneration()` runs one generation and stores it. Every upload, reclassification, extraction, requirement decision, generation, case review and settings change appends a change-log entry with before/after values.
- Styling: `src/theme.css` defines every colour as a token (ITSG brand values at the top); `src/style.css` (base layout, formerly minified) and `src/features.css` use only those tokens.
- Validation flow: `src/results/ingestResult.ts` (file → text) → `src/ai/compare.ts` (`compareResult`: prompt, the model via `COMPARE_MODEL` in `config/ai.ts`, `parseAssessment` with evidence checks, `ruleAssessment`, agreement/consensus; `suggestCases`; `buildCompareFeedbackBlock`) → `ComparisonView` → store actions `addComparison` / `reviewComparison`. Types in `src/types/validation.ts`, constants in `src/config/validation.ts`, result files via `src/state/useResults.ts`.
- Remaining illustrative parts: sample requirements `REQ-EEL-*` and `src/data/testCases.ts`, and the "Regelentwurf" shown for sample requirements. Approving a requirement records the examiner decision only; no executable rule is compiled.
- Network: the only calls are model requests to `/api/llm`, which work only under `npm run dev` / `npm run preview`. Starting document analysis sends all sections sequentially in prompt-sized batches constrained by `EXTRACTION_CHAR_BUDGET`.
- Local setup: copy `.env.example` to `.env.local`, set `HAI_API_KEY` and `HAI_MODEL`, then restart the dev server.
- `BrowserRouter` means a deployed `dist/` needs an SPA fallback to `index.html` for deep links. No deploy config is checked in.
- Verified 2026-10-26 with Playwright against the four sample documents: upload and segmentation (Verfahrensbeschreibung: Version 13.4 · Stand 10.03.2026, 96 sections; Rundschreiben: "in der Fassung vom 10.12.2025"), rule-based extraction of the §3.12 DBVO rule and of all four DBVO criteria with their UUIDs, rule-based derivation (30-day and 6-month boundary pairs), quote verification flagging an invented quote, and persistence after reload. The AI path was verified only against a mocked gateway reply; a real gateway run is still outstanding.

### Code conventions and gotchas

- TypeScript enforces `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums, namespaces, or constructor parameter properties), `noUnusedLocals`, and `noUnusedParameters`.
- Components use named exports, not default exports. No formatter is configured; match the existing double quotes, semicolons, and 2-space indentation.
- `Status` badge colors come from the `STATUS_CLASS` map in `src/components/Status.tsx` (German values: `Offen`, `Genehmigt`, `Abgelehnt`, `Akzeptiert`, `Bestanden`, `Fehlgeschlagen`, `Erledigt`, `Prüfung nötig`, …). New status strings render neutral unless that map is extended.
- `src/data/testCases.ts` is a readonly tuple array read by position (Tests page, `utils/traceGraph.ts`); changing a row shape requires updating every consumer.
- CSV exports use `toCsv` from `src/utils/format.ts` (RFC 4180 quoting).
- Never add a colour literal outside `src/theme.css`; add a token instead.
- Requirement extraction must stay verbatim-first: keep the quote, re-check it with `quoteOccursIn`, and show unverified quotes as such. A document's role is never evidence for an expected value; only the requirement's own quote and section text are.
- UI labels with German legal/domain terms (`Krankengeld`, `Bemessungszeitraum`, etc.). Keep German field names intact, especially in validation/export data.
- `README.md` is stock Vite template text, not project documentation. Trust `package.json` and the code.
- Stack additions: `pdfjs-dist` (PDF text layer, loaded on demand; v6 API: destroy the loading task, not the document) and `fflate` (DOCX unzip).
