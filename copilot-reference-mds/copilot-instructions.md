# copilot-instructions.md

## Absolute rules

- **Non-destructive behaviour**
  - Stay read-only: no DML and no deploys.
  - Do not change org configuration or data.

- **Allowed filesystem locations**
  - Files may be created or modified only under:
    - `scripts/` (SOQL and Apex scripts you generate)
    - `agent_workspace/` (logs, findings, plans, web, metadata retrieves)
    - `Reports/` (final human-readable outputs)

- **Allowed Salesforce CLI commands**
  - `sf data query --file <path> --json`
  - `sf apex run --file <path>` (describe or other read-only Apex; abort if DML is present)
  - `sf project retrieve start ...` read-only retrieves to `agent_workspace/md/...`

- **Org alias protection**
  - Never run any deploy command.
  - Never target the org alias `HQ2Prod` with anything other than safe, read-only operations.

## High-level flow for each investigation

- **Step 1 – Confirm context**
  - Confirm org alias, high-level symptom, example records, and impacted users or profiles.
  - When the user prompt mentions compiling Salesforce-side integration inventory, mapping CRM–ERP interfaces, or “Include record links to the biggest Buyer Account in the org and all its related records”, treat this as a dedicated CRM–ERP integration inventory investigation and default to `HQ2Prod` as the source org for read-only queries and record links.

- **Step 2 – Propose a plan**
  - Propose a short investigation plan:
    - Which SOQL queries will be run.
    - Which metadata will be retrieved.
    - Which records and users will be examined.
  - Ask for user confirmation before running queries.

- **Step 3 – Run SOQL / Apex describe**
  - Generate SOQL and Apex describe scripts in `scripts/`.
  - Run them via the allowed CLI commands.
  - Save raw outputs to `agent_workspace/logs/` and cleaned findings to `agent_workspace/findings/`.

- **Step 4 – Retrieve metadata (read-only)**
  - Retrieve the latest relevant metadata from the target org into `agent_workspace/md/...` before drawing conclusions.
  - Limit the scope to components that are actually involved in the issue.

- **Step 5 – Emulate automation**
  - Use metadata and data to emulate how automation behaves for sample records.
  - Infer the rule or logic that is causing the observed issue.
  - Determine whether:
    - The primary root cause is incorrect or incomplete user-entered data, or
    - The automation or configuration is failing for valid data.
  - Infer the appropriate field values required for correct behaviour.
  - Consider code or configuration changes only when the queried data shows that valid or unavoidable data patterns are breaking the automation.

- **Step 6 – Generate the report bundle**
  - Generate three markdown files under `Reports/<YYYY-MM-DD>-<two-words>/`:
    - `BU.md`
    - `Tech Document.md`
    - `Client.md`

## Read-only metadata retrieve

- **Usage**
  - Use `sf project retrieve start` only with `--manifest` or `--metadata` flags.
  - Always send output to a subfolder of `agent_workspace/md/`, for example:
    - `agent_workspace/md/2025-11-13-login-issue/`

- **Scope control**
  - Limit retrieves to impacted components where possible:
    - Objects and fields.
    - Record types and page layouts.
    - Flows, validation rules, assignment rules, escalation rules, etc.
  - Do not overwrite main project metadata; retrieves are for analysis and emulation only.

## Data queries and emulation

- **SOQL placement**
  - Place all SOQL scripts under `scripts/soql/<date>-<purpose>/`.

- **Result handling**
  - Run `sf data query --file ... --json` and store raw JSON under `agent_workspace/logs/`.
  - Store cleaned, human-readable findings under `agent_workspace/findings/`.

- **Automation interpretation**
  - After retrieving metadata, interpret automation (rules, criteria, formulas) against sample records to infer:
    - Why a record was blocked, updated, or not processed.
    - Whether incorrect or incomplete user-entered data is the immediate cause.
    - Whether valid data is breaking the automation.
    - What the appropriate field value(s) should be for correct behaviour.
  - These inferred field values must be written into the report bundle as bullet points under clear headings.

## Web search usage

- **When to search**
  - Use the Copilot web search extension when:
    - You see unfamiliar error codes or platform messages.
    - You are unsure of recommended Salesforce configuration for a feature.
    - You have attempted at least two targeted approaches without a clear diagnosis.

- **How to search**
  - Prefer official Salesforce sources (Help, Developer Guides, Known Issues, Trailhead).
  - Save a concise summary of relevant findings and URLs to `agent_workspace/web/<date>-<topic>.md`.
  - Reuse these summaries on repeated occurrences of similar issues.

## Three-document bundle — required structure

For every investigation, create (or overwrite) this folder:

```text
Reports/<YYYY-MM-DD>-<two-words>/
```

and generate three markdown files: `BU.md`, `Tech Document.md`, and `Client.md`.

All three must be client-ready, stand-alone markdown documents that follow the formatting rules at the end of this file.

### 1) BU.md – Business User report (non-technical)

- **Audience**
  - Business users and non-technical stakeholders.

- **Overall style**
  - BU.md must read like a very short newspaper article:
    - One bold **headline** that states the issue and outcome in a single, clear sentence.
    - Followed by brief sections composed only of bullets and sub-bullets.
  - The entire document should be readable in under 30 seconds (aim for ~100–150 words).
  - Use clear, everyday language and keep every bullet short and focused.

- **Required sections**

  - **Headline**
    - One short sentence summarising:
      - What went wrong, and
      - The high-level fix or outcome.
    - Example format: “New account records were blocked because address details were incomplete; guidance has now been added.”

  - **Cause**
    - 3–5 short bullets describing the root cause in everyday language.
    - Explicitly state whether the issue was caused by:
      - Incorrect or incomplete information entered by users, or
      - A system rule or automation behaving in a way users did not expect.
    - Focus on what the user experienced (blocked save, missing data, confusing message), not on how the code failed.
    - When data is the root cause, clearly but respectfully state that the information entered did not follow the expected rule or format.

  - **Solution plan**
    - 3–5 short bullets describing the simple solution/plan in business terms.
    - State clearly what is being done or has been done, for example:
      - “We will clean up existing records where key details are missing.”
      - “We adjusted the system check so the message clearly explains what needs to be filled in.”
    - Avoid technical terms like Flow, Apex, Validation Rule, FLS, Metadata, Sandbox.

  - **User action items** (only if needed)
    - Include this section only when the business team needs to do something.
    - Use concise, direct bullets that start with a verb, for example:
      - “Always enter the store number when creating a new Ship-To account.”
      - “Review and update existing records where the ‘Region’ value is blank.”
    - Keep instructions simple and unambiguous.

  - **Problem-specific testing case**
    - A short, step-by-step scenario written as bullets that a business user can follow to confirm the fix.
    - Include:
      - Preconditions (which user, which type of record, any sample data).
      - Simple steps in the UI (what to click and what to enter, in plain language).
      - Expected result expressed in business terms (for example, “the record saves without error and shows the correct status”).

- **Language and tone rules**

  - Avoid internal technical terms like “Flow”, “Apex”, “Validation Rule”, “FLS”, “Metadata”, or “Sandbox”.
  - Do not describe which rule or piece of code failed; describe what the user saw and what will change.
  - Focus on the effect:
    - Instead of: “The validation rule fired.”
    - Say: “The system blocked your save because a required detail was missing.”
  - Be specific and concise; avoid long paragraphs.
  - Always be courteous and thank the user for helping improve the system.
  - Clearly indicate when user-entered data was incorrect or incomplete and show, in simple terms, how to enter it correctly in future.

- **Record examples**

  - Include 3–10 example record URLs where the issue was reproduced.
  - For each example, list:
    - The record URL.
    - The incorrect or incomplete field values that were found (described in plain language).
    - The appropriate field value(s) (also in plain language) so that users know what “good” looks like.

- **ADO task linkage**

  - Detailed technical discussion and implementation steps belong in:
    - Tech Document.md, and
    - One or more ADO tasks created for the bug.
  - For each bug, ensure there is at least one ADO task that captures the technical actions taken.
  - BU.md must stay non-technical and should not repeat technical explanations from those tasks.

### 2) Tech Document.md – Technical analysis

- **Audience**
  - Salesforce admins, developers, and technical client stakeholders.

- **Required sections**

  - **Summary**
    - One short paragraph restating the issue in business terms.

  - **Technical root cause**
    - Detail the objects, fields, rules, and logic involved.
    - Classify the root cause as:
      - Data-quality issue (incorrect or incomplete data entered by users), and/or
      - Configuration/automation defect or limitation.
    - Reference specific metadata (flows, validation rules, Apex classes, configuration settings) by name.

  - **Data-quality analysis**
    - Describe how the queried data shows incorrect or incomplete values.
    - Identify exactly where user errors occur:
      - Objects and fields.
      - UI entry points (record types, screens, or processes).
      - Typical patterns of incorrect entries.
    - Provide sample SOQL snippets (if helpful) that demonstrate the incorrect data patterns.

  - **Solution design**
    - Provide a detailed design for the fix, prioritising data-quality remediation first:
      - Data clean-up and backfill steps to correct existing records.
      - Guardrails such as validation rules, required fields, or UI guidance to prevent future data errors.
    - Then describe any configuration or code changes only if:
      - The automation fails or behaves incorrectly for valid and correctly structured data, or
      - The volume or nature of unavoidable data patterns clearly breaks the current automation.
    - For any proposed code or configuration change, clearly link back to:
      - The specific data pattern that breaks the automation.
      - Evidence from queries or emulation that shows why the change is needed.
    - Present this as bullet points and sub-bullets.
    - Make sure the design is complete enough for a senior admin or developer to implement without guessing.
    - Where applicable, reference related ADO tasks that hold detailed technical implementation notes.

  - **Evidence**
    - Summarise key findings from SOQL and Apex describe.
    - Instead of referencing local file paths, describe:
      - What was queried.
      - What the important results were (counts, key field values, status flags).
    - If needed, include short code blocks for sample queries, but not full result dumps.

  - **Metadata and automation path**
    - Describe how the relevant rules, flows, and other automation execute for the affected records.
    - Explain the decision path that leads to the observed behaviour.
    - Make it clear where, along this path, incorrect or incomplete data causes the automation to fail, if applicable.

  - **Emulation results**
    - Describe how the automation behaves when run against sample records.
    - Summarise how behaviour changes when appropriate field values are applied.
    - Highlight whether the automation works correctly once data is fixed, or whether it still fails and therefore needs code/configuration changes.

  - **Environment comparison** (if applicable)
    - Note differences between environments (for example, configuration differences between two sandboxes).

  - **Edge cases and assumptions**
    - Explicitly list:
      - Edge cases that could still cause issues even after the fix.
      - Assumptions made during analysis (for example, certain user roles or integrations that must behave in a specific way).

  - **Testing criteria**
    - Define clear test conditions that must pass before the fix is considered complete.
    - Include:
      - Happy path tests (expected success scenarios) that use correctly entered data.
      - Negative tests (what should be blocked or prevented when data is incorrect or incomplete).
      - Regression checks (what must not change elsewhere).
    - Express these as bullet lists of test scenarios with:
      - Preconditions.
      - Steps.
      - Expected results.

### 3) Client.md – Action items only

- **Audience**
  - Project and client leads.

- **Required sections**

  - **Context**
    - 2–3 bullet points summarising the issue in business language.
    - Clearly indicate whether the primary root cause is incorrect/incomplete user-entered data, a system issue, or both.

  - **Action items**
    - Use bullet lists only; do not use tables.
    - For each action item, include:
      - Owner (for example: Client, Salesforce Admin, Partner).
      - Short description of the action.
      - Target date or sprint, if known.
    - Ensure there are separate bullets for:
      - Data-quality actions (for example, cleaning up existing records, training users, improving data-entry guidance).
      - System/configuration actions (only when valid data is shown to break the automation).

  - **Impacted records and objects**
    - Brief bullet list describing:
      - Main objects affected.
      - Scale of impact (for example, number of records or key segments).

  - **Acceptance criteria**
    - Bullet list of pass or fail conditions that confirm the fix is working.
    - These must align with the **Testing criteria** in Tech Document.md but written in client-friendly language.
    - Include criteria that confirm:
      - Correctly entered data flows through successfully.
      - Incorrect or incomplete data is clearly flagged and does not produce unexpected failures.

## Root cause and data-quality messaging (all three documents)

- **Consistent story**
  - Ensure BU.md, Tech Document.md, and Client.md all tell the same story about:
    - Whether the primary root cause is user-entered data, configuration, automation, or a mix.
    - Where the user error occurred when data is the root cause.
  - Do not leave ambiguity about whether the system or the data is at fault.

- **Pointing out user error**
  - When user-entered data is incorrect or incomplete:
    - State this clearly but respectfully in all three documents.
    - Identify the specific fields and process steps where errors occur.
    - Provide simple guidance to prevent a repeat of the error.

- **Code/config changes**
  - Only propose code or configuration changes when:
    - Evidence from queries and emulation shows that valid data breaks the automation, or
    - Unavoidable data patterns expose a limitation in existing automation.
  - Always document this evidence in Tech Document.md under **Data-quality analysis**, **Solution design**, and **Evidence**.

## Record URLs (must include)

- **URL format**
  - Use fully qualified URLs when the domain is known.
  - For the `HQ2Prod` org, never use the Lightning domain `https://duravanthq2.lightning.force.com/`; always construct record links using the base `https://oneduravant.my.salesforce.com/`.
  - If you copy a Lightning URL from the browser for HQ2Prod, normalise it by replacing the domain with `https://oneduravant.my.salesforce.com/` and keep the remainder of the path unchanged.
  - If the domain is unknown, you may provide the record Id and a relative path pattern, but do not mention local file paths.

- **Coverage**
  - Ensure that all reports reference the same core set of example records where possible to keep the narrative consistent.

## Common formatting rules for BU.md, Tech Document.md, Client.md

- **Client-ready style**
  - All three files must be written so they can be sent directly to clients and business stakeholders without editing.

- **No file paths**
  - Do not include any repository or local workspace paths:
    - Do not mention `scripts/`, `agent_workspace/`, `Reports/`, or similar locations inside these three documents.
  - Embed the necessary information directly in the markdown as short, clear bullet points.

- **No tables**
  - Never use markdown tables in any of the three documents.
  - When you need structured information, use bold headings with bullet and sub-bullet lists.

- **Headings and bullets**
  - Use bold headings for categories, for example:
    - **Headline**
    - **Cause**
    - **Root cause and data quality**
    - **Solution plan**
    - **User action items**
    - **Problem-specific testing case**
    - **Solution design**
    - **Edge cases and assumptions**
    - **Testing criteria**
    - **Action items**
    - **Acceptance criteria**
  - Under each bold heading, use bullet points and sub-bullets only.

- **Data in markdown**
  - Include key numbers, counts, and example values directly in the documents.
  - Avoid phrases like “see findings file” or “see logs”; instead, summarise the important data.
  - Continue to mask or abbreviate sensitive data where required.

## Report file rules

- **Folder creation**
  - Always create `Reports/<YYYY-MM-DD>-<two-words>/` and then write `BU.md`, `Tech Document.md`, and `Client.md` in that folder.
  - Overwrite the existing bundle when re-running in the same diagnostic context.

- **Consistency**
  - Ensure that:
    - BU.md strictly follows the non-technical, headline-plus-bullets guidelines above, clearly calls out root cause and data issues, and includes a problem-specific testing case.
    - Tech Document.md includes root-cause classification, data-quality analysis, solution design, edge cases, and testing criteria.
    - Client.md is concise, separates data-related and system-related actions, and is implementation-focused.

## Safety checks

- **Schema confirmation**
  - Confirm object and field names via describe or schema queries before running SOQL.

- **PII handling**
  - Never paste full PII (names, personal emails, phone numbers) into reports; mask or shorten where possible.

- **Scope enforcement**
  - Keep all outputs quarantined to `scripts/`, `agent_workspace/`, and `Reports/`.
  - If any requested action would break the non-destructive rules, refuse and propose a safe alternative.
