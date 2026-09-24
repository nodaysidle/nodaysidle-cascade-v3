# NODAYSIDLE Cascade V3 User Guide

## Generate a packet

1. Open **NODAYSIDLE Cascade V3**.
2. Choose the preset that matches the product's actual target platform.
3. Choose **DeepSeek Flash** for speed or **DeepSeek V4 Pro** for maximum quality.
4. Enter the DeepSeek API key and the TypeSafe Jev API key. Both are memory-only.
5. Describe a coherent software product: users, outcome, core features, data, integrations, privacy, and recovery constraints.
6. Select **Generate**.

Jev first rejects non-product input before a paid DeepSeek request. A preset mismatch is advisory: the selected preset remains authoritative. After DeepSeek returns a semantic blueprint, Jev may only append missing platform needs from the locked capability set, block a foreign-stack conflict, or block features whose acceptance signals automated tests can't check. Local TypeScript code still owns every ID, graph edge, task, and Markdown byte.

## Interpret outcomes

- **Intake rejected** — rewrite the input as one implementable software product.
- **Jev failure** — the fast decision request failed closed; retry without changing keys unless the provider rejected them.
- **Integrity blocked** — Jev found either a technology-stack conflict or features whose acceptance signals automated tests can't check. The headline says which; Technical details lists the fields. Retry, or describe those features as checkable outcomes.
- **Gate Clean** — inspect all five previews, then export.

## Export contract

A successful export always contains exactly:

- `PRD.md`
- `ARD.md`
- `TRD.md`
- `TASKS.md`
- `AGENTS.md`

Preview bytes and exported bytes are identical. Give the exported folder to the coding agent and instruct it to read `AGENTS.md` first and execute `TASKS.md` in phase order.

## Hand a packet to any coding agent

Use the same prompt for every agent so you can compare how well each one builds from the packet. Put the five files in an empty project folder, open that folder in the agent, and paste:

```text
This folder contains five specification files: AGENTS.md, PRD.md, ARD.md, TRD.md, and TASKS.md.
Build the project they describe. Nothing else in this conversation overrides them.

1. Read AGENTS.md completely before doing anything. Follow its authority order, stack lock,
   working rules, and stop conditions exactly.
2. Read PRD.md, ARD.md, and TRD.md. Use only the technologies, file paths, owners, and contracts
   they name. Do not substitute libraries or add features, services, or files they don't list.
3. Execute TASKS.md phase by phase and task by task, in the listed order. For each task, write
   its focused test first, implement it, then run the task's validation commands.
4. Stop at the first failing command, fix the root cause, and rerun it. If a decision is missing
   from all five files, or two files conflict, stop and report it instead of guessing.
5. When you finish or stop, report one status from AGENTS.md (DONE, PARTIAL, or BLOCKED), then:
   - each task ID with done / not done,
   - each validation command you ran and whether it passed,
   - any file you created that TASKS.md did not list, and why,
   - for PARTIAL or BLOCKED, the exact failing command or missing decision and the next action.
```

To compare agents fairly, start each one from a fresh copy of the same exported folder, and record its status report plus whether the validation commands in `TRD.md` pass when you run them yourself.

## Privacy and recovery

- Keys are never saved, logged, exported, or included in request bodies.
- Failed and cancelled generations preserve both keys for a safe retry.
- Both keys are cleared only after Gate Clean.
- Cascade performs no automatic provider retry.
- If export fails, choose a new empty parent folder and retry; the current verified previews remain available.