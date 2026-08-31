import type { PlatformNeed, SemanticBlueprint } from "../../src/schema"
import { nodaysidleVoiceBlueprint } from "./voice"

export type FixturePresetId =
  | "native-macos-swiftui-desktop"
  | "native-macos-swiftui-menubar"
  | "tauri2-rust-typescript-desktop"
  | "astro-web"
  | "android-kotlin-compose"

type Feature = SemanticBlueprint["features"][number]

function feature(
  name: string,
  userOutcome: string,
  behavior: string,
  acceptance: string,
  trigger = `The user starts ${name.toLowerCase()}.`,
  failure = "The operation stops without replacing the last valid state and explains what can be retried.",
): Feature {
  return { name, userOutcome, trigger, behavior, failureOutcome: failure, acceptanceSignals: [acceptance] }
}

interface FixtureSeed {
  readonly productName: string
  readonly summary: string
  readonly targetUsers: readonly string[]
  readonly goals: readonly string[]
  readonly nonGoals: readonly string[]
  readonly features: readonly Feature[]
  readonly dataObjects?: SemanticBlueprint["dataObjects"]
  readonly externalServices?: SemanticBlueprint["externalServices"]
  readonly platformNeeds?: readonly PlatformNeed[]
  readonly qualityRequirements?: readonly string[]
  readonly productConstraints?: readonly string[]
}

function blueprint(seed: FixtureSeed): SemanticBlueprint {
  return {
    productName: seed.productName,
    summary: seed.summary,
    targetUsers: [...seed.targetUsers],
    goals: [...seed.goals],
    nonGoals: [...seed.nonGoals],
    features: [...seed.features],
    dataObjects: [...(seed.dataObjects ?? [])],
    externalServices: [...(seed.externalServices ?? [])],
    platformNeeds: [...(seed.platformNeeds ?? [])],
    qualityRequirements: [...(seed.qualityRequirements ?? ["Keyboard-operable controls with visible status and accessible labels."])],
    productConstraints: [...(seed.productConstraints ?? ["Preserve the last valid state across every recoverable failure."])],
  }
}

export const fileOrganizerBlueprint = blueprint({
  productName: "Harbor Sort",
  summary: "A trustworthy local file organizer that previews deterministic moves from a selected folder and keeps a reversible journal for completed batches.",
  targetUsers: ["People who regularly organize crowded local folders"],
  goals: ["Preview every planned move", "Undo completed organization batches", "Keep filenames and contents on the device"],
  nonGoals: ["Cloud synchronization", "Document editing"],
  features: [
    feature("Folder scan", "See every eligible file exactly once", "Read metadata only inside a user-selected folder and group eligible files without opening their contents.", "Unreadable files stay in place with a clear explanation."),
    feature("Move preview", "Review every source and destination before writing", "Build a complete move plan and identify destination collisions before any filesystem change.", "No move occurs outside the reviewed plan."),
    feature("Reversible batch", "Restore every successfully moved file", "Apply the approved plan, stop safely on partial failure, and record the completed subset for exact undo.", "Undo restores the completed subset to original locations."),
  ],
  dataObjects: [
    { name: "Organization rules", purpose: "Map file metadata to reviewed destination folders.", sensitivity: "personal", retentionIntent: "Keep locally until edited or reset." },
    { name: "Move journal", purpose: "Record completed source and destination pairs for undo.", sensitivity: "personal", retentionIntent: "Keep through the configured undo window." },
  ],
  platformNeeds: ["filesystem", "local-storage"],
  productConstraints: ["Never upload filenames, paths, metadata, or contents.", "Never follow links outside the selected folder."],
})

export const photoCleanerBlueprint = blueprint({
  productName: "Quiet Exif",
  summary: "A privacy utility that explains metadata in selected photographs and exports verified cleaned copies while preserving every source image.",
  targetUsers: ["People preparing photographs for privacy-conscious sharing"],
  goals: ["Explain exposed metadata", "Remove selected categories from copies", "Keep source images unchanged"],
  nonGoals: ["Photo editing", "Social publishing"],
  features: [
    feature("Metadata inspection", "Understand what each image exposes", "List human-readable location, device, timestamp, and descriptive metadata for selected images.", "Every reported value identifies its source and category."),
    feature("Cleaning policy", "Choose exactly which metadata categories to remove", "Maintain a reviewed category policy without altering an image.", "The export summary matches the selected policy."),
    feature("Verified copy export", "Receive cleaned copies with unchanged originals", "Write new files, reread metadata, and discard incomplete outputs when verification fails.", "Every output passes the selected policy and source hashes remain unchanged."),
  ],
  dataObjects: [{ name: "Cleaning policy", purpose: "Remember the last reviewed metadata categories.", sensitivity: "personal", retentionIntent: "Keep locally until reset." }],
  platformNeeds: ["filesystem", "local-storage"],
  productConstraints: ["Never transmit selected photographs or metadata.", "Never overwrite a source image or existing destination."],
})

export const networkMonitorBlueprint = blueprint({
  productName: "Linewatch",
  summary: "A lightweight status utility that summarizes reachability and latency, records a bounded local incident timeline, and alerts only on stable changes.",
  targetUsers: ["Remote workers diagnosing intermittent connectivity"],
  goals: ["Show current connectivity at a glance", "Record meaningful transitions", "Avoid repeated alerts"],
  nonGoals: ["Packet capture", "Remote employee monitoring"],
  features: [
    feature("Reachability summary", "See offline, degraded, reachable, or unknown state", "Run bounded probes and publish the newest stable classification with sample time.", "Unavailable probes become unknown rather than falsely offline."),
    feature("Transition timeline", "Review when connectivity changed", "Store deduplicated state transitions and representative latency without traffic content.", "Repeated samples do not flood the timeline."),
    feature("Meaningful alerts", "Receive one outage and one recovery alert", "Notify only after a stable state crosses the configured threshold.", "Denied notifications never block monitoring."),
  ],
  dataObjects: [{ name: "Incident timeline", purpose: "Keep timestamped reachability states and aggregate latency.", sensitivity: "personal", retentionIntent: "Keep locally for fourteen days." }],
  platformNeeds: ["network", "notifications", "local-storage", "background-execution"],
  productConstraints: ["Never capture payloads, visited domains, or application traffic.", "Run no more than one probe per endpoint."],
})

export const knowledgeManagerBlueprint = blueprint({
  productName: "Threadmark",
  summary: "A cross-platform local-first knowledge manager for short notes, explicit links, offline search, and portable folder export.",
  targetUsers: ["Individuals building a private linked knowledge collection"],
  goals: ["Capture and link notes quickly", "Search offline", "Export a portable collection"],
  nonGoals: ["Real-time collaboration", "Hosted accounts"],
  features: [
    feature("Note capture", "Create and edit notes with honest save status", "Persist titled plain-text notes while keeping unsaved content visible after a failed write.", "Reopening a saved note preserves exact content."),
    feature("Explicit note links", "Navigate known links and visible missing targets", "Create directional links and preserve recoverable missing references when a target is deleted.", "Every link resolves or shows a missing-target state."),
    feature("Offline search", "Find notes without network access", "Index titles and bodies locally and rebuild derived index data without altering notes.", "A newly saved note appears after the bounded index update."),
    feature("Portable export", "Reconstruct notes and links from a selected folder", "Export notes, relationships, and a manifest through an atomic destination boundary.", "A fresh import preserves note and link counts."),
  ],
  dataObjects: [
    { name: "Notes and links", purpose: "Store user-authored text and directional relationships.", sensitivity: "personal", retentionIntent: "Keep locally until explicit deletion." },
    { name: "Search index", purpose: "Provide derived offline search data.", sensitivity: "personal", retentionIntent: "Keep until rebuilt or application data is cleared." },
  ],
  platformNeeds: ["filesystem", "local-storage"],
  productConstraints: ["All core note operations work offline.", "Exports never modify the local collection."],
})

export const invoiceArchiveBlueprint = blueprint({
  productName: "Ledger Crate",
  summary: "A private invoice archive that imports local documents, captures user-verified fields, detects duplicates, and exports reproducible reconciliation data.",
  targetUsers: ["Independent operators maintaining invoice records"],
  goals: ["Keep invoices local", "Require field verification", "Produce reproducible reconciliation exports"],
  nonGoals: ["Tax advice", "Payments or bank connections"],
  features: [
    feature("Invoice import", "Add selected invoices without cloud upload", "Copy selected files into the archive and surface unsupported or unreadable inputs before acceptance.", "Every accepted document has one archive record."),
    feature("Verified fields", "Confirm vendor, amount, currency, date, and status", "Keep extracted values provisional until the user reviews them.", "No provisional value silently becomes authoritative."),
    feature("Duplicate review", "Resolve likely duplicates without losing originals", "Compare stable document evidence and require an explicit keep, merge, or reject choice.", "A duplicate decision remains reversible until export."),
    feature("Reconciliation export", "Receive a stable local summary", "Export reviewed records in deterministic order without modifying the archive.", "Repeated export from unchanged records is byte-identical."),
  ],
  dataObjects: [{ name: "Invoice archive", purpose: "Store document references, verified fields, and duplicate decisions.", sensitivity: "sensitive", retentionIntent: "Keep until explicit record deletion." }],
  platformNeeds: ["filesystem", "local-storage"],
  productConstraints: ["Never upload financial documents.", "Never overwrite an imported source document."],
})

export const landingPageBlueprint = blueprint({
  productName: "Copper Kite",
  summary: "A fast public landing page for a repair studio with clear services, trust evidence, pricing guidance, and a direct contact path.",
  targetUsers: ["People comparing local repair services"],
  goals: ["Explain services quickly", "Build trust with verifiable evidence", "Make contact straightforward"],
  nonGoals: ["Customer accounts", "Online payments"],
  features: [
    feature("Service overview", "Understand available repairs and boundaries", "Present scannable service categories with typical turnaround and exclusions.", "Every service has a clear next action."),
    feature("Trust evidence", "Evaluate real workshop proof", "Show attributable testimonials, warranty terms, and process evidence without fabricated metrics.", "Claims remain specific and attributable."),
    feature("Contact path", "Send a repair inquiry", "Provide accessible contact details and a privacy-minimal inquiry form when enabled.", "A failed submission preserves the typed inquiry."),
  ],
  platformNeeds: [],
  qualityRequirements: ["Meet accessible semantic markup expectations.", "Keep production pages within a strict performance budget."],
  productConstraints: ["Collect no analytics or form data unless explicitly configured.", "Publish no invented testimonials or prices."],
})

export const docsPortalBlueprint = blueprint({
  productName: "Signal Manual",
  summary: "A searchable public documentation portal for a hardware controller with versioned guides, troubleshooting paths, and downloadable reference sheets.",
  targetUsers: ["Operators installing and maintaining the controller"],
  goals: ["Find procedures quickly", "Keep version scope visible", "Support offline reference downloads"],
  nonGoals: ["Device control", "Customer support ticketing"],
  features: [
    feature("Versioned guides", "Read instructions for the correct hardware revision", "Group procedures by released revision and show scope on every page.", "A guide never silently mixes revisions."),
    feature("Documentation search", "Find relevant procedures and terms", "Search public guide titles and text with clear empty and no-result states.", "Results identify guide revision and section."),
    feature("Troubleshooting paths", "Follow safe diagnosis from symptom to action", "Present ordered checks with stop conditions and escalation guidance.", "Dangerous steps include explicit prerequisites."),
    feature("Reference downloads", "Save complete printable reference sheets", "Offer versioned files with visible checksums and release dates.", "A missing download never masquerades as current."),
  ],
  platformNeeds: [],
  qualityRequirements: ["Keyboard and assistive-technology navigation.", "Fast static production output with validated links."],
  productConstraints: ["Do not collect reader behavior.", "Only released hardware revisions may be published."],
})

export const habitTrackerBlueprint = blueprint({
  productName: "Steady Day",
  summary: "An offline habit tracker for scheduled routines, one-tap daily completion, deterministic streaks, and optional local reminders.",
  targetUsers: ["People building private repeatable routines"],
  goals: ["Track habits offline", "Explain streak calculations", "Use reminders only by opt-in"],
  nonGoals: ["Social feeds", "Health diagnosis"],
  features: [
    feature("Habit schedules", "Create recurring weekday routines", "Store named habits with explicit active weekdays and archive behavior.", "Existing completion history survives schedule edits."),
    feature("Daily completion", "Mark today's expected habits quickly", "Toggle one local completion per habit and calendar day.", "Repeated taps never create duplicate completion rows."),
    feature("Deterministic streaks", "Understand current and longest streaks", "Calculate streaks from saved schedules and completions using the current local day.", "Displayed counts match documented weekday rules."),
    feature("Optional reminders", "Receive enabled local reminders", "Schedule alerts only after explicit opt-in and cancel them when habits are disabled or deleted.", "Denied notifications leave tracking fully usable."),
  ],
  dataObjects: [{ name: "Habits and completions", purpose: "Store schedules, daily outcomes, and archive state.", sensitivity: "personal", retentionIntent: "Keep until explicit habit deletion or data reset." }],
  platformNeeds: ["local-storage", "notifications", "background-execution"],
  productConstraints: ["All core behavior works in airplane mode.", "Use the current local calendar day consistently."],
})

export const trailChecklistBlueprint = blueprint({
  productName: "Trail Ready",
  summary: "An offline trip checklist that creates independent packing lists from reusable gear templates and optionally records one user-chosen coarse trailhead.",
  targetUsers: ["Hikers preparing repeatable gear checklists"],
  goals: ["Reuse templates", "Keep trips independent", "Make location optional"],
  nonGoals: ["Navigation", "Emergency rescue or social routes"],
  features: [
    feature("Reusable gear templates", "Reuse ordered gear lists across trips", "Create categories and items without carrying trip completion state back into the template.", "Editing a template leaves existing trips unchanged."),
    feature("Trip checklist snapshot", "Track one trip independently", "Copy a template into a dated trip with independent checked state and trip-only items.", "Resetting one trip changes no template or other trip."),
    feature("Optional trailhead", "Attach one coarse location or manual label", "Request a foreground position only after the user enables it for the current trip.", "Denied access leaves the trip fully usable."),
    feature("Packing progress", "See checked and remaining counts", "Calculate progress from stored item state by category and whole trip.", "Counts always equal the visible stored item states."),
  ],
  dataObjects: [
    { name: "Gear templates", purpose: "Store reusable ordered gear categories and items.", sensitivity: "personal", retentionIntent: "Keep until explicit deletion." },
    { name: "Trip checklists", purpose: "Store dated snapshots, checked state, and optional trailhead.", sensitivity: "personal", retentionIntent: "Keep until the trip is deleted." },
  ],
  platformNeeds: ["local-storage", "location"],
  productConstraints: ["All checklist actions work offline.", "Never request continuous or background location."],
})

export const fixtureCases: ReadonlyArray<{ presetId: FixturePresetId; blueprint: SemanticBlueprint }> = [
  { presetId: "native-macos-swiftui-desktop", blueprint: fileOrganizerBlueprint },
  { presetId: "native-macos-swiftui-desktop", blueprint: photoCleanerBlueprint },
  { presetId: "native-macos-swiftui-menubar", blueprint: nodaysidleVoiceBlueprint },
  { presetId: "native-macos-swiftui-menubar", blueprint: networkMonitorBlueprint },
  { presetId: "tauri2-rust-typescript-desktop", blueprint: knowledgeManagerBlueprint },
  { presetId: "tauri2-rust-typescript-desktop", blueprint: invoiceArchiveBlueprint },
  { presetId: "astro-web", blueprint: landingPageBlueprint },
  { presetId: "astro-web", blueprint: docsPortalBlueprint },
  { presetId: "android-kotlin-compose", blueprint: habitTrackerBlueprint },
  { presetId: "android-kotlin-compose", blueprint: trailChecklistBlueprint },
]
