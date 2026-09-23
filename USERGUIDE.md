# NODAYSIDLE Cascade V3 User Guide

## Generate a packet

1. Open **NODAYSIDLE Cascade V3**.
2. Choose the preset that matches the product's actual target platform.
3. Choose **DeepSeek Flash** for speed or **DeepSeek V4 Pro** for maximum quality.
4. Enter the DeepSeek API key and the TypeSafe Jev API key. Both are memory-only.
5. Describe a coherent software product: users, outcome, core features, data, integrations, privacy, and recovery constraints.
6. Select **Generate**.

Jev first rejects non-product input before a paid DeepSeek request. A preset mismatch is advisory: the selected preset remains authoritative. After DeepSeek returns a semantic blueprint, Jev may only append missing platform needs from the locked capability set or block a foreign-stack conflict. Local TypeScript code still owns every ID, graph edge, task, and Markdown byte.

## Interpret outcomes

- **Intake rejected** — rewrite the input as one implementable software product.
- **Jev failure** — the fast decision request failed closed; retry without changing keys unless the provider rejected them.
- **Integrity blocked** — the blueprint contains instructions for a stack that conflicts with the selected preset; revise the idea or preset and retry.
- **Gate Clean** — inspect all five previews, then export.

## Export contract

A successful export always contains exactly:

- `PRD.md`
- `ARD.md`
- `TRD.md`
- `TASKS.md`
- `AGENTS.md`

Preview bytes and exported bytes are identical. Give the exported folder to the coding agent and instruct it to read `AGENTS.md` first and execute `TASKS.md` in phase order.

## Privacy and recovery

- Keys are never saved, logged, exported, or included in request bodies.
- Failed and cancelled generations preserve both keys for a safe retry.
- Both keys are cleared only after Gate Clean.
- Cascade performs no automatic provider retry.
- If export fails, choose a new empty parent folder and retry; the current verified previews remain available.