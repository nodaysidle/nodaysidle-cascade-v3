import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"

export const noteSummarizerAstroBlueprint: SemanticBlueprint = {
  productName: "NoteWeaver",
  summary: "A modern web documentation and note management app with AI summarization.",
  targetUsers: ["Technical writers organizing markdown notes"],
  goals: ["Organize notes into collections", "Summarize notes using OpenRouter"],
  nonGoals: ["Audio recording or dictation", "Speech synthesis"],
  features: [
    {
      name: "Note Catalog",
      userOutcome: "Browse organized markdown notes by category.",
      trigger: "User navigates to the notes dashboard.",
      behavior: "Render markdown notes from local collections with fast filtering.",
      failureOutcome: "Display empty state if no notes exist.",
      acceptanceSignals: ["Notes catalog renders without error"],
    },
    {
      name: "AI Note Summarization",
      userOutcome: "Generate a concise summary of the current note.",
      trigger: "User clicks the Summarize Note button.",
      behavior: "Send note text to OpenRouter and display generated executive summary.",
      failureOutcome: "Display error notice and keep original note untouched if API fails.",
      acceptanceSignals: ["Summary appears in callout block", "Original note content remains unmodified"],
    },
  ],
  dataObjects: [
    { name: "Note documents", purpose: "Store markdown note files.", sensitivity: "personal", retentionIntent: "Retain locally in content collection." },
  ],
  externalServices: [
    {
      name: "OpenRouter",
      purpose: "Summarize note content using selected language models.",
      dataSent: ["Selected note content"],
      credentialRequired: true,
    },
  ],
  platformNeeds: ["local-storage"],
  qualityRequirements: ["Summary renders in under 2 seconds"],
  productConstraints: ["Content collections only"],
}

describe("Cross-Preset OpenRouter Quality & Isolation (H1 & M2)", () => {
  it("does not leak audio transcription or audio refinement contracts into non-voice apps", async () => {
    const packet = await compilePacket(noteSummarizerAstroBlueprint, "astro-web")
    expect(packet.exportable).toBe(true)
    expect(packet.failures).toHaveLength(0)

    const allDocs = Object.values(packet.documents).join("\n")

    // Zero voice/audio leaks
    expect(allDocs).not.toContain("OpenRouter transcription")
    expect(allDocs).not.toContain("Transcribe one finalized audio input")
    expect(allDocs).not.toContain("Finalized audio bytes")
    expect(allDocs).not.toContain("Raw transcript")

    // Keeps generic or designated integration
    expect(allDocs).toContain("CON-INTEGRATION-OPENROUTER")
  })
})
