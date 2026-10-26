# AGENTS.md

## Status and purpose
We are building an AI-based prototype in the Hackathon repository for the ITSG Futury Hackathon. The prototype is a static frontend that illustrates a possible AI review assistant for payroll-software system review of income replacement benefits (Entgeltersatzleistungen). It is not a complete implementation, and many decisions remain open.
This file guides AI coding agents on the ITSG Futury Hackathon project: an AI review assistant for payroll-software system review of income replacement benefits (Entgeltersatzleistungen).

Status: product scope and domain rules are still unconfirmed, but this repository already contains a static frontend prototype. Treat its UI copy, sample requirements, rules, test cases, and validation results as illustrative. There is no backend, rule engine, database, or payroll integration. Since 2026-10-26 an AI test-case generator calls the hessian.ai gateway through the Vite dev/preview proxy, and generated cases, feedback and the change log persist in browser localStorage only. Owner decisions are partly confirmed; see "Confirmed owner answers" below.

Read the source material before implementing a domain rule. Ask the owner when a decision affects scope, architecture, expected results, or an external integration. Continue independent work that does not depend on the answer. Record confirmed answers here.

## Source material and its role

Core sources:

| Source | Role | Relevant location |
| --- | --- | --- |
| `Futury-Hackathon-2026-Englisch.pdf` | Organizer's challenge, objectives, illustrative workflow, and optional extensions | Slides 9-12; system-review context on slides 6-8 |
| `Hackathon.pdf` | Owner's handwritten brainstorm; ideas and questions are not all finalized implementation requirements | Repo root, pages 1-2 |
| `DTA-EEL-Beispiel_Vorerkrankung.docx` | DBVO reference scenario, prerequisites, four supplementary criteria, and expected business outcome | Sections `Szenario DBVO`, `Anforderung`, `Voraussetzung`, `Ergänzende Kriterien`, `Ergebnis` |

Only `Hackathon.pdf` is in the repository (root). On the current machine, local copies of the other documents and supporting references are in `~/Downloads/hackathon_itsg/ITSG/`; they are outside git:

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
- Implement AI feature using a model, the API keys provided in the a1.jpg and a2.jpg files. The model should be able to generate test cases and expected results based on the requirements and the relevant policy. The model should also be able to learn from the feedback provided by the user and improve its test case generation.

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

- D2 (partial): Extend the existing React + Vite + TypeScript repository. AI provider is the hessian.ai inference gateway (OpenAI-compatible `/v1/chat/completions`), models `vllm/Kolibri-1` and `vllm/GLM-Flash:Latest` from the Team 7 handout. The API key must never be committed or bundled: it lives in the untracked `.env.local` as `HAI_API_KEY` and is injected by the Vite proxy (`/api/llm` → gateway `/v1`). No backend, storage or graph technology has been chosen; persistence is browser localStorage.
- D3 (partial): Implement now: AI test-case generation with adjustable reasoning and `Impact/Priority` flags (interpreted as test prioritization: `Hoch`/`Mittel`/`Niedrig` with a reason); examiner feedback that is fed back into later prompts (in-context, no model training); a timestamped change log; an interactive traceability graph. German UI and ITSG colours were not selected for this iteration; they stay planned.
- D1/D5 (deferred): The DBVO DOCX, organizer PDF and DTA EEL references were not available on the working machine. Domain content stays illustrative sample data; DBVO rules remain unresolved and must not be invented.
- D4, D6: still open. The current UI copy is English; prompts and generated content are German.

## Repository and commands

Verified against the current repository:

- Stack: React 19, TypeScript, Vite, React Router, `lucide-react`, and `oxlint`. npm with `package-lock.json`.
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server.
- `npm run build` — `tsc -b && vite build`; this is also the build's typecheck.
- `npx tsc -b` — typecheck only, using the project references in `tsconfig.json`.
- `npm run lint` — run oxlint. There is no ESLint, Prettier, or test runner.
- `npm run preview` — serve the production build.
- No tests exist. Verify changes with `npm run build`, `npm run lint`, and a manual check of the affected screen.

### Structure and current prototype scope

- Entry: `src/main.tsx` → `src/App.tsx` (`BrowserRouter`) → `src/pages/*`.
- Routes live in `src/App.tsx`; sidebar links live in `src/components/Sidebar.tsx`. Add or rename pages in both. Unknown routes render `Overview`.
- `src/components/` holds `Header`, `Panel`, `Sidebar`, `Status` and `GeneratedCaseCard`; `src/data/` holds demo rows; `src/types/` holds shared types (`review.ts` for generated cases, feedback and change log); `src/utils/` holds `download.ts`, `format.ts` (dates, quoted CSV) and `traceGraph.ts` (graph model).
- AI flow: `src/ai/prompt.ts` (prompt + JSON contract + feedback block) → `client.ts` (fetch via proxy) → `parse.ts` (defensive JSON normalization) → `validate.ts` (deterministic structure/traceability checks, not payroll correctness) → `generate.ts` (wraps results with origin, run id, review state). `offlineDemo.ts` is a canned reply labelled as simulated. Constants are in `src/config/ai.ts`.
- State: `src/state/ReviewProvider.tsx` wraps the app; use `useReviewStore()` from `src/state/reviewContext.ts`. Every generation, review and settings change appends a change-log entry with before/after values.
- Pages added: `/generate` (AI test generator), `/changelog` (change log); `/graph` is now an interactive traceability graph. New styles live in `src/features.css`.
- The original pages remain illustrative: requirement approval/rejection only changes local state and fires an `alert`; the test-plan button downloads a CSV; the validation file input only stores the filename; "Export PDF" calls `window.print()`; the library page is static. The only network call is the AI generator's request to `/api/llm`, which works only under `npm run dev` / `npm run preview` (a static `dist/` deployment has no proxy).
- Local setup: copy `.env.example` to `.env.local` and set `HAI_API_KEY`, then restart the dev server.
- All styling is in the one-line minified `src/style.css`, imported by `src/main.tsx`. `src/App.css` and `src/index.css` are unused Vite scaffold leftovers; edits there have no effect.
- `BrowserRouter` means a deployed `dist/` needs an SPA fallback to `index.html` for deep links. No deploy config is checked in.

### Code conventions and gotchas

- TypeScript enforces `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums, namespaces, or constructor parameter properties), `noUnusedLocals`, and `noUnusedParameters`.
- Components use named exports, not default exports. No formatter is configured; match the existing double quotes, semicolons, and 2-space indentation.
- `Status` badge colors come from the `STATUS_CLASS` map in `src/components/Status.tsx` (English sample values plus `Offen`, `Akzeptiert`, `Genehmigt`, `Abgelehnt`, `In Bearbeitung`, `In Überprüfung`). New status strings render neutral unless that map is extended.
- `src/data/pipeline.ts` and `src/data/testCases.ts` are untyped tuple arrays read by position; changing a row shape requires updating every consumer, including the CSV export.
- The CSV export joins fields with commas without quoting; avoid commas in tuple fields or update `src/utils/download.ts` / the export call.
- UI labels with German legal/domain terms (`Krankengeld`, `Bemessungszeitraum`, etc.). Keep German field names intact, especially in validation/export data.
- `README.md` is stock Vite template text, not project documentation. Trust `package.json` and the code.
