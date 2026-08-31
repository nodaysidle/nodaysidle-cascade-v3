import type { SemanticBlueprint } from "../../src/schema"

// Portable semantic fixture reconstructed from the immutable five-document failure packet.
export const exportedVoiceV3Blueprint = {
  productName: "NODAYSIDLE Voice",
  summary: "A native macOS menu-bar speech-to-text app that lets users dictate into any application using configurable global hotkeys, with low-latency cloud transcription, optional AI text refinement, local history, and flexible insertion modes.",
  targetUsers: [
    "Professionals who write frequently in email, chat, and documents",
    "Developers dictating code comments and technical notes",
    "Multilingual users who need translation or language detection",
    "Users with repetitive strain or mobility limitations",
    "Writers who prefer speaking over typing",
    "Power users who want configurable dictation modes and vocabulary",
  ],
  goals: [
    "Dictate into any macOS text field using a global hotkey",
    "Provide low-latency accurate transcription with provider choice",
    "Offer optional AI refinement for tone, formatting, and translation",
    "Preserve user privacy with local storage and Keychain credentials",
    "Keep the full workflow operable without opening Settings",
    "Recover gracefully from provider, permission, and network failures",
  ],
  nonGoals: [
    "Offline on-device transcription",
    "Mobile or web versions",
    "Team collaboration or shared history",
    "Built-in audio editing or recording studio",
    "Replacing the macOS built-in dictation feature",
  ],
  features: [
    {
      name: "Global hotkey dictation",
      userOutcome: "Start and stop dictation from any application without opening the app",
      trigger: "User presses a configured global hotkey",
      behavior: "The app captures microphone audio and begins streaming to the selected transcription provider. A second hotkey press or release stops capture and finalizes the transcript.",
      failureOutcome: "The user sees a clear error in the HUD and the recording is preserved for retry or provider switch",
      acceptanceSignals: ["Hotkey works while another app is focused", "Recording starts within 300 ms of hotkey press", "Hotkey conflicts are detected and reported"],
    },
    {
      name: "Push-to-talk and toggle recording modes",
      userOutcome: "Choose the recording style that fits their workflow",
      trigger: "User selects a recording mode in Settings or from the menu bar",
      behavior: "Push-to-talk records while the hotkey is held. Toggle mode starts on first press and stops on second press. The HUD reflects the active mode.",
      failureOutcome: "Mode confusion is prevented by clear HUD state and optional recording sounds",
      acceptanceSignals: ["Push-to-talk stops when hotkey is released", "Toggle mode starts and stops on separate presses", "HUD shows the current mode and state"],
    },
    {
      name: "Floating recording HUD",
      userOutcome: "See recording status, level, and elapsed time at a glance",
      trigger: "Recording starts",
      behavior: "A compact floating window shows microphone level, elapsed time, current state, and a cancel control. Success or error feedback appears when recording ends.",
      failureOutcome: "The HUD shows a clear error state with retry or cancel actions",
      acceptanceSignals: ["HUD appears within 300 ms of recording start", "Microphone level updates in real time", "Cancel discards the recording without pasting"],
    },
    {
      name: "Provider and model configuration",
      userOutcome: "Select transcription and refinement providers and models that fit their needs",
      trigger: "User opens Provider settings or selects a provider from the menu bar",
      behavior: "The app supports Deepgram Nova streaming and OpenRouter speech-to-text models. Users can choose separate transcription and text-refinement models, test connections, and save API keys to Keychain.",
      failureOutcome: "Connection test failures show actionable error messages without exposing keys",
      acceptanceSignals: ["Provider connection test succeeds with valid credentials", "Model selection persists across launches", "API keys are stored only in Keychain"],
    },
    {
      name: "AI text refinement",
      userOutcome: "Receive cleaned, formatted, translated, summarized, or rewritten text after transcription",
      trigger: "User enables refinement and selects a refinement model",
      behavior: "After transcription completes, the raw transcript is sent to the selected OpenRouter language model with the active mode's instructions. The refined text becomes the insertion candidate.",
      failureOutcome: "If refinement fails, the raw transcript is preserved and offered for insertion",
      acceptanceSignals: ["Refined text matches the selected mode's instructions", "Raw transcript remains available in history", "Refinement failure does not lose the transcript"],
    },
    {
      name: "Flexible insertion options",
      userOutcome: "Control how finished text reaches the target application",
      trigger: "Dictation completes successfully",
      behavior: "The app can auto-paste into the previously focused application, copy to clipboard only, or show a preview before insertion. Clipboard contents are preserved and restored where practical.",
      failureOutcome: "If paste fails, the text remains on the clipboard and the user is notified",
      acceptanceSignals: ["Auto-paste inserts text at the original cursor position", "Clipboard is restored after paste", "Preview mode shows text before insertion"],
    },
    {
      name: "Searchable local transcription history",
      userOutcome: "Find, reuse, edit, and manage past transcriptions",
      trigger: "User opens the history view from the menu bar",
      behavior: "History entries show timestamp, source application, duration, provider, mode, raw transcript, refined text, and actions for copy, re-paste, edit, favorite, and delete. Search filters entries by text or metadata.",
      failureOutcome: "History is unavailable if local storage fails, but current transcription still completes",
      acceptanceSignals: ["History search returns matching entries quickly", "Re-paste inserts text into the current focused app", "Delete removes the entry permanently"],
    },
    {
      name: "Dictation modes and custom vocabulary",
      userOutcome: "Apply consistent tone, formatting, and terminology across dictation sessions",
      trigger: "User selects a mode or edits vocabulary in Settings",
      behavior: "Built-in modes include Message, Email, Notes, Coding, Formal, Casual, and Raw Transcript. Users can create custom modes with instructions for tone, punctuation, formatting, vocabulary, and output language. A custom vocabulary supports names, technical terms, acronyms, and replacement rules.",
      failureOutcome: "Invalid mode instructions are rejected with clear validation feedback",
      acceptanceSignals: ["Custom modes appear in the mode picker", "Vocabulary replacements apply during refinement", "Per-application default modes are respected"],
    },
    {
      name: "Permission guidance and recovery",
      userOutcome: "Resolve missing microphone, Accessibility, and Input Monitoring permissions without guesswork",
      trigger: "The app detects a missing or denied permission",
      behavior: "A guided recovery flow explains which permission is needed, why, and how to enable it in System Settings. The app re-checks permission status after the user returns.",
      failureOutcome: "The app remains usable for clipboard-only workflows while permissions are missing",
      acceptanceSignals: ["Missing permission is detected before recording starts", "Recovery flow opens the correct System Settings pane", "Permission status updates after user action"],
    },
    {
      name: "File transcription",
      userOutcome: "Transcribe existing audio files without live dictation",
      trigger: "User selects an audio file from the menu bar or Settings",
      behavior: "The app accepts common audio formats, sends the file to the selected transcription provider, and inserts or saves the resulting transcript according to the active insertion mode.",
      failureOutcome: "Unsupported or unreadable files show a clear error without crashing",
      acceptanceSignals: ["Supported audio formats transcribe successfully", "Progress is visible during file transcription", "Resulting transcript follows insertion preferences"],
    },
    {
      name: "Provider failure recovery",
      userOutcome: "Never lose a transcript when a provider fails",
      trigger: "A transcription or refinement request fails",
      behavior: "The recording is preserved temporarily. The user sees a retry or provider-switch action. Existing transcripts are never discarded, and incomplete text is never auto-pasted.",
      failureOutcome: "If all providers fail, the user can still cancel and retain the raw audio temporarily",
      acceptanceSignals: ["Retry reuses the preserved recording", "Provider switch is offered after failure", "No incomplete text is pasted automatically"],
    },
    {
      name: "Usage and cost visibility",
      userOutcome: "Understand provider usage and cost when available",
      trigger: "User opens the usage view or completes a transcription",
      behavior: "When the provider supplies usage or cost data, the app displays it in the history entry and a summary view. No usage data is sent to third parties.",
      failureOutcome: "Missing usage data is shown as unavailable without blocking transcription",
      acceptanceSignals: ["Usage appears in history when provider supplies it", "Cost summary is accurate for the selected provider", "No usage data is included in logs or analytics"],
    },
  ],
  dataObjects: [
    { name: "Transcription history entry", purpose: "Stores timestamp, source application, duration, provider, mode, raw transcript, refined text, favorite status, and usage data for search and reuse", sensitivity: "sensitive", retentionIntent: "Kept locally until user deletes it or the configured retention period expires" },
    { name: "User settings", purpose: "Stores hotkeys, recording mode, insertion preference, provider and model selections, and UI preferences", sensitivity: "internal", retentionIntent: "Kept locally for the lifetime of the app installation" },
    { name: "Custom dictation mode", purpose: "Stores user-defined instructions for tone, punctuation, formatting, vocabulary, and output language", sensitivity: "internal", retentionIntent: "Kept locally until user deletes the mode" },
    { name: "Custom vocabulary entry", purpose: "Stores names, technical terms, acronyms, and replacement rules for transcription and refinement", sensitivity: "personal", retentionIntent: "Kept locally until user deletes the entry" },
    { name: "Temporary audio recording", purpose: "Holds captured microphone audio or uploaded file audio only long enough to complete the selected cloud request", sensitivity: "sensitive", retentionIntent: "Deleted immediately after the cloud request completes or fails, unless the user explicitly saves the recording" },
    { name: "API credentials", purpose: "Stores provider API keys for Deepgram and OpenRouter", sensitivity: "sensitive", retentionIntent: "Stored only in macOS Keychain and removed when the user deletes the credential" },
  ],
  externalServices: [
    { name: "Deepgram Nova streaming transcription", purpose: "Low-latency streaming speech-to-text transcription", dataSent: ["Streaming microphone audio", "Selected transcription model identifier", "Language detection preferences"], credentialRequired: true },
    { name: "OpenRouter speech-to-text", purpose: "Alternative speech-to-text transcription provider", dataSent: ["Audio data", "Selected speech-to-text model identifier"], credentialRequired: true },
    { name: "OpenRouter language models", purpose: "Optional text refinement, cleaning, formatting, translation, summarization, or rewriting", dataSent: ["Raw transcript text", "Selected refinement model identifier", "Active dictation mode instructions", "Custom vocabulary entries"], credentialRequired: true },
  ],
  platformNeeds: ["audio-input", "clipboard", "global-hotkey", "accessibility-control", "notifications", "filesystem", "local-storage", "network", "background-execution", "launch-at-login"],
  qualityRequirements: [
    "Recording starts within 300 ms of hotkey press",
    "HUD appears within 300 ms of recording start",
    "Transcription latency feels minimal for streaming providers",
    "No incomplete text is ever pasted automatically",
    "Clipboard contents are restored after paste where practical",
    "API keys never appear in logs, preferences, history, exports, URLs, or analytics",
    "All UI states have clear empty, loading, offline, permission, rate-limit, and provider-error feedback",
    "Full workflow is operable without opening the Settings window",
  ],
  productConstraints: [
    "API keys are stored only in macOS Keychain",
    "Audio is deleted after the cloud request unless the user explicitly saves it",
    "History and settings remain local and are never synced or exported without user action",
    "Cloud transcription sends audio to the selected provider and this is clearly disclosed",
    "The app must remain usable when a provider fails, with retry or provider-switch actions",
    "No more than twelve features are exposed in the primary product surface",
  ],
} satisfies SemanticBlueprint

export function observedAcceptanceOwnershipVoiceBlueprint(): SemanticBlueprint {
  const blueprint: SemanticBlueprint = structuredClone(exportedVoiceV3Blueprint)
  const hotkey = blueprint.features.find(feature => feature.name === "Global hotkey dictation")!
  const insertion = blueprint.features.find(feature => feature.name === "Flexible insertion options")!
  const sharedOutcome = "Approved final text reaches the configured target application exactly once"

  hotkey.acceptanceSignals = [sharedOutcome]
  insertion.name = "Insertion behavior"
  insertion.userOutcome = "Approved final text reaches the configured target application"
  insertion.trigger = "A transcription reaches its accepted final state"
  insertion.behavior = "Insert one approved final transcript into the configured target application or retain it for explicit copy or preview."
  insertion.failureOutcome = "The completed transcript remains available without changing the target application"
  insertion.acceptanceSignals = [sharedOutcome]
  const insertionIndex = blueprint.features.indexOf(insertion)
  const refinementIndex = blueprint.features.findIndex(feature => feature.name === "AI text refinement")
  blueprint.features.splice(insertionIndex, 1)
  blueprint.features.splice(refinementIndex, 0, insertion)
  return blueprint
}
