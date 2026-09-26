import type { FeatureRecovery, FeatureSurface, PlatformNeed, SemanticBlueprint } from "../../src/schema"

export type FixturePresetId =
  | "native-macos-swiftui-desktop"
  | "native-macos-swiftui-menubar"
  | "tauri2-rust-typescript-desktop"
  | "astro-web"
  | "android-kotlin-compose"

type Feature = SemanticBlueprint["features"][number]

interface FeatureUses {
  readonly platform?: readonly PlatformNeed[]
  readonly data?: readonly string[]
  readonly services?: readonly string[]
  readonly recovery?: FeatureRecovery
  readonly surface?: FeatureSurface
}

function feature(name: string, userOutcome: string, behavior: string, acceptance: string, uses: FeatureUses = {}): Feature {
  return {
    name,
    userOutcome,
    trigger: `The user starts ${name.toLowerCase()}.`,
    behavior,
    failureOutcome: "The operation stops without replacing the last valid state and explains what can be retried.",
    failureRecovery: uses.recovery ?? "retry",
    surface: uses.surface ?? "main",
    acceptanceSignals: [acceptance],
    usesPlatformNeeds: [...(uses.platform ?? [])],
    usesData: [...(uses.data ?? [])],
    usesServices: [...(uses.services ?? [])],
  }
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
    feature("Folder scan", "See every eligible file exactly once", "Read metadata only inside a user-selected folder and group eligible files without opening their contents.", "Unreadable files stay in place with a clear explanation.", { platform: ["filesystem"], data: ["Organization rules", "Selected folder"] }),
    feature("Move preview", "Review every source and destination before writing", "Build a complete move plan and identify destination collisions before any filesystem change.", "No move occurs outside the reviewed plan.", { platform: ["filesystem"], data: ["Organization rules", "Selected folder"] }),
    feature("Reversible batch", "Restore every successfully moved file", "Apply the approved plan, stop safely on partial failure, and record the completed subset for exact undo.", "Undo restores the completed subset to original locations.", { platform: ["filesystem", "local-storage"], data: ["Move journal", "Selected folder"] }),
  ],
  dataObjects: [
    { name: "Organization rules", purpose: "Map file metadata to reviewed destination folders.", sensitivity: "personal", retentionIntent: "Keep locally until edited or reset.", storage: "records", writeMode: "direct" },
    { name: "Move journal", purpose: "Record completed source and destination pairs for undo.", sensitivity: "personal", retentionIntent: "Keep through the configured undo window.", storage: "records", writeMode: "direct" },
    { name: "Selected folder", purpose: "The folder the user chooses whose files are scanned and moved.", sensitivity: "personal", retentionIntent: "Owned by the user; the app keeps no copy.", storage: "document", writeMode: "direct" },
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
    feature("Metadata inspection", "Understand what each image exposes", "List human-readable location, device, timestamp, and descriptive metadata for selected images.", "Every reported value identifies its source and category.", { platform: ["filesystem"], data: ["Selected photographs"] }),
    feature("Cleaning policy", "Choose exactly which metadata categories to remove", "Maintain a reviewed category policy without altering an image.", "The export summary matches the selected policy.", { platform: ["local-storage"], data: ["Cleaning policy"] }),
    feature("Verified copy export", "Receive cleaned copies with unchanged originals", "Write new files, reread metadata, and discard incomplete outputs when verification fails.", "Every output passes the selected policy and source hashes remain unchanged.", { platform: ["filesystem"], data: ["Cleaning policy", "Selected photographs", "Cleaned copies"] }),
  ],
  dataObjects: [
    { name: "Cleaning policy", purpose: "Remember the last reviewed metadata categories.", sensitivity: "personal", retentionIntent: "Keep locally until reset.", storage: "settings", writeMode: "direct" },
    { name: "Selected photographs", purpose: "The source images the user chooses to inspect and clean.", sensitivity: "personal", retentionIntent: "Owned by the user; never modified.", storage: "document", writeMode: "direct" },
    { name: "Cleaned copies", purpose: "The cleaned image files written to the folder the user chooses.", sensitivity: "personal", retentionIntent: "Owned by the user after writing.", storage: "document", writeMode: "atomic-replace" },
  ],
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
    feature("Reachability summary", "See offline, degraded, reachable, or unknown state", "Run bounded probes and publish the newest stable classification with sample time.", "Unavailable probes become unknown rather than falsely offline.", { platform: ["network", "background-execution"] }),
    feature("Transition timeline", "Review when connectivity changed", "Store deduplicated state transitions and representative latency without traffic content.", "Repeated samples do not flood the timeline.", { platform: ["local-storage"], data: ["Incident timeline"] }),
    feature("Meaningful alerts", "Receive one outage and one recovery alert", "Notify only after a stable state crosses the configured threshold.", "Denied notifications never block monitoring.", { platform: ["notifications"] }),
  ],
  dataObjects: [{ name: "Incident timeline", purpose: "Keep timestamped reachability states and aggregate latency.", sensitivity: "personal", retentionIntent: "Keep locally for fourteen days.", storage: "records", writeMode: "direct" }],
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
    feature("Note capture", "Create and edit notes with honest save status", "Persist titled plain-text notes while keeping unsaved content visible after a failed write.", "Reopening a saved note preserves exact content.", { platform: ["local-storage"], data: ["Notes and links"] }),
    feature("Explicit note links", "Navigate known links and visible missing targets", "Create directional links and preserve recoverable missing references when a target is deleted.", "Every link resolves or shows a missing-target state.", { platform: ["local-storage"], data: ["Notes and links"] }),
    feature("Offline search", "Find notes without network access", "Index titles and bodies locally and rebuild derived index data without altering notes.", "A newly saved note appears after the bounded index update.", { data: ["Notes and links", "Search index"] }),
    feature("Portable export", "Reconstruct notes and links from a selected folder", "Export notes, relationships, and a manifest through an atomic destination boundary.", "A fresh import preserves note and link counts.", { platform: ["filesystem"], data: ["Notes and links", "Export folder"] }),
  ],
  dataObjects: [
    { name: "Notes and links", purpose: "Store user-authored text and directional relationships.", sensitivity: "personal", retentionIntent: "Keep locally until explicit deletion.", storage: "records", writeMode: "direct" },
    { name: "Search index", purpose: "Provide derived offline search data.", sensitivity: "personal", retentionIntent: "Keep until rebuilt or application data is cleared.", storage: "records", writeMode: "direct" },
    { name: "Export folder", purpose: "The folder the user chooses for the portable export.", sensitivity: "personal", retentionIntent: "Owned by the user after export.", storage: "document", writeMode: "atomic-replace" },
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
    feature("Invoice import", "Add selected invoices without cloud upload", "Copy selected files into the archive and surface unsupported or unreadable inputs before acceptance.", "Every accepted document has one archive record.", { platform: ["filesystem"], data: ["Invoice archive", "Selected invoice files"] }),
    feature("Verified fields", "Confirm vendor, amount, currency, date, and status", "Keep extracted values provisional until the user reviews them.", "No provisional value silently becomes authoritative.", { data: ["Invoice archive"] }),
    feature("Duplicate review", "Resolve likely duplicates without losing originals", "Compare stable document evidence and require an explicit keep, merge, or reject choice.", "A duplicate decision remains reversible until export.", { data: ["Invoice archive"] }),
    feature("Reconciliation export", "Receive a stable local summary", "Export reviewed records in deterministic order without modifying the archive.", "Repeated export from unchanged records is byte-identical.", { platform: ["filesystem"], data: ["Invoice archive", "Reconciliation file"] }),
  ],
  dataObjects: [
    { name: "Invoice archive", purpose: "Store document references, verified fields, and duplicate decisions.", sensitivity: "sensitive", retentionIntent: "Keep until explicit record deletion.", storage: "records", writeMode: "direct" },
    { name: "Selected invoice files", purpose: "The invoice files the user chooses to import.", sensitivity: "sensitive", retentionIntent: "Owned by the user; never modified.", storage: "document", writeMode: "direct" },
    { name: "Reconciliation file", purpose: "The reconciliation export written to the location the user chooses.", sensitivity: "sensitive", retentionIntent: "Owned by the user after export.", storage: "document", writeMode: "atomic-replace" },
  ],
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
    feature("Versioned guides", "Read instructions for the correct hardware revision", "Group procedures by released revision and show scope on every page.", "A guide never silently mixes revisions.", { data: ["Guides"], surface: "item-page" }),
    feature("Documentation search", "Find relevant procedures and terms", "Search public guide titles and text with clear empty and no-result states.", "Results identify guide revision and section."),
    feature("Troubleshooting paths", "Follow safe diagnosis from symptom to action", "Present ordered checks with stop conditions and escalation guidance.", "Dangerous steps include explicit prerequisites."),
    feature("Reference downloads", "Save complete printable reference sheets", "Offer versioned files with visible checksums and release dates.", "A missing download never masquerades as current."),
  ],
  dataObjects: [{ name: "Guides", purpose: "Published procedures grouped by released hardware revision.", sensitivity: "public", retentionIntent: "Published until a revision is withdrawn.", storage: "records", writeMode: "direct" }],
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
    feature("Habit schedules", "Create recurring weekday routines", "Store named habits with explicit active weekdays and archive behavior.", "Existing completion history survives schedule edits.", { platform: ["local-storage"], data: ["Habits and completions"] }),
    feature("Daily completion", "Mark today's expected habits quickly", "Toggle one local completion per habit and calendar day.", "Repeated taps never create duplicate completion rows.", { platform: ["local-storage"], data: ["Habits and completions"] }),
    feature("Deterministic streaks", "Understand current and longest streaks", "Calculate streaks from saved schedules and completions using the current local day.", "Displayed counts match documented weekday rules.", { data: ["Habits and completions"] }),
    feature("Optional reminders", "Receive enabled local reminders", "Schedule alerts only after explicit opt-in and cancel them when habits are disabled or deleted.", "Denied notifications leave tracking fully usable.", { platform: ["notifications", "background-execution"], data: ["Habits and completions"] }),
  ],
  dataObjects: [{ name: "Habits and completions", purpose: "Store schedules, daily outcomes, and archive state.", sensitivity: "personal", retentionIntent: "Keep until explicit habit deletion or data reset.", storage: "records", writeMode: "direct" }],
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
    feature("Reusable gear templates", "Reuse ordered gear lists across trips", "Create categories and items without carrying trip completion state back into the template.", "Editing a template leaves existing trips unchanged.", { platform: ["local-storage"], data: ["Gear templates"] }),
    feature("Trip checklist snapshot", "Track one trip independently", "Copy a template into a dated trip with independent checked state and trip-only items.", "Resetting one trip changes no template or other trip.", { platform: ["local-storage"], data: ["Gear templates", "Trip checklists"] }),
    feature("Optional trailhead", "Attach one coarse location or manual label", "Request a foreground position only after the user enables it for the current trip.", "Denied access leaves the trip fully usable.", { platform: ["location"], data: ["Trip checklists"] }),
    feature("Packing progress", "See checked and remaining counts", "Calculate progress from stored item state by category and whole trip.", "Counts always equal the visible stored item states.", { data: ["Trip checklists"] }),
  ],
  dataObjects: [
    { name: "Gear templates", purpose: "Store reusable ordered gear categories and items.", sensitivity: "personal", retentionIntent: "Keep until explicit deletion.", storage: "records", writeMode: "direct" },
    { name: "Trip checklists", purpose: "Store dated snapshots, checked state, and optional trailhead.", sensitivity: "personal", retentionIntent: "Keep until the trip is deleted.", storage: "records", writeMode: "direct" },
  ],
  platformNeeds: ["local-storage", "location"],
  productConstraints: ["All checklist actions work offline.", "Never request continuous or background location."],
})

export const forecastGlanceBlueprint = blueprint({
  productName: "Forecast Glance",
  summary: "A compact forecast utility that shows current conditions and the next hours for saved places using a weather service the user connects with their own API key.",
  targetUsers: ["People who check the weather several times a day"],
  goals: ["Show current conditions at a glance", "Keep saved places local", "Work only with the user's own weather API key"],
  nonGoals: ["Severe weather emergency alerts", "Weather radar maps"],
  features: [
    feature("Weather service connection", "Connect the weather service once", "Accept the user's weather API key, verify it with one test request, and show configured or missing state.", "A rejected key shows a clear error and stores nothing.", { platform: ["network"], data: ["Weather API key"], services: ["Weather service"] }),
    feature("Current conditions", "See temperature and conditions for the selected place", "Request current conditions for the selected saved place and show the newest successful result with its fetch time.", "A failed refresh keeps the last successful result visible with its age.", { platform: ["network"], data: ["Saved places"], services: ["Weather service"] }),
    feature("Saved places", "Switch between a few saved places", "Add, rename, reorder, and delete saved places stored on the device.", "Deleting a place removes it from the list and from local storage.", { platform: ["local-storage"], data: ["Saved places"] }),
  ],
  dataObjects: [
    { name: "Saved places", purpose: "Store place names and coordinates chosen by the user.", sensitivity: "personal", retentionIntent: "Keep locally until the user deletes the place.", storage: "records", writeMode: "direct" },
    { name: "Weather API key", purpose: "Authenticate requests to the weather service.", sensitivity: "sensitive", retentionIntent: "Keep until the user replaces or removes the key.", storage: "secret", writeMode: "direct" },
  ],
  externalServices: [
    { name: "Weather service", purpose: "Provide current conditions and hourly forecasts for coordinates.", dataSent: ["Coordinates of the selected saved place"], credentialRequired: true },
  ],
  platformNeeds: ["network", "local-storage"],
  productConstraints: ["Send only coordinates to the weather service.", "Never display or log the API key after it is saved."],
})

export const scanDrawerBlueprint = blueprint({
  productName: "Scan Drawer",
  summary: "A local drawer for scanned paper documents that copies each imported PDF or image into its own library folder, tags it, and keeps everything on the device.",
  targetUsers: ["People who keep scanned paperwork on their own computer"],
  goals: ["Keep scans in a local library without network access", "Find scans by tag"],
  nonGoals: ["No OCR or automatic text extraction", "No cloud sync"],
  features: [
    feature("Scan import", "Add scanned files to the library", "The app copies each chosen PDF, PNG, or JPEG into its own library folder under a generated file name and creates a scan record that points to the copy.", "After importing one PDF, the library folder contains exactly one new file with the same bytes.", { platform: ["filesystem"], data: ["Stored scans", "Scan index", "Chosen scan file"] }),
    feature("Scan removal", "Remove a scan and its copy", "On confirmation, the app deletes the scan record and removes its copied file from the library folder.", "After removal, no file exists at the removed scan's copied path.", { data: ["Stored scans", "Scan index"] }),
    feature("Tag filter", "Narrow the list to one tag", "Selecting a tag shows only scans with that tag; if the saved tag list cannot be read, the list shows every scan.", "With scans tagged Home and Work, selecting Home shows only the Home scans.", { data: ["Scan index", "Drawer preferences"], recovery: "fallback" }),
    feature("Scan list export", "Save the visible scans as a CSV file", "The app writes one CSV row per visible scan to the location the user chooses in the Save panel.", "After export, the chosen file has one header row and one row per visible scan.", { platform: ["filesystem"], data: ["Scan index", "Exported scan list"] }),
  ],
  dataObjects: [
    { name: "Stored scans", purpose: "The copied scan files the app keeps in its own library folder.", sensitivity: "personal", retentionIntent: "Keep until the user removes the scan.", storage: "app-files", writeMode: "direct" },
    { name: "Scan index", purpose: "One record per scan with its tag and the name of its copied file.", sensitivity: "personal", retentionIntent: "Keep until the user removes the scan.", storage: "records", writeMode: "direct" },
    { name: "Drawer preferences", purpose: "The saved tag list and the selected tag.", sensitivity: "internal", retentionIntent: "Keep until the user changes it.", storage: "settings", writeMode: "direct" },
    { name: "Chosen scan file", purpose: "The PDF or image file the user chooses to import.", sensitivity: "personal", retentionIntent: "Owned by the user; never modified.", storage: "document", writeMode: "direct" },
    { name: "Exported scan list", purpose: "The CSV file written at the location the user chooses.", sensitivity: "personal", retentionIntent: "Owned by the user after it is written.", storage: "document", writeMode: "atomic-replace" },
  ],
  platformNeeds: ["filesystem", "local-storage"],
  productConstraints: ["Never upload scans.", "Never modify the original file the user chose."],
})

export const sharedOutcome = "Every saved change appears in the next export"

export function sharedAcceptanceBlueprint(): SemanticBlueprint {
  const shared = structuredClone(knowledgeManagerBlueprint)
  shared.features[0]!.acceptanceSignals = [...shared.features[0]!.acceptanceSignals, sharedOutcome]
  shared.features[3]!.acceptanceSignals = [...shared.features[3]!.acceptanceSignals, sharedOutcome]
  return shared
}

export const fixtureCases: ReadonlyArray<{ presetId: FixturePresetId; blueprint: SemanticBlueprint }> = [
  { presetId: "native-macos-swiftui-desktop", blueprint: fileOrganizerBlueprint },
  { presetId: "native-macos-swiftui-desktop", blueprint: photoCleanerBlueprint },
  { presetId: "native-macos-swiftui-menubar", blueprint: forecastGlanceBlueprint },
  { presetId: "native-macos-swiftui-menubar", blueprint: networkMonitorBlueprint },
  { presetId: "tauri2-rust-typescript-desktop", blueprint: knowledgeManagerBlueprint },
  { presetId: "tauri2-rust-typescript-desktop", blueprint: invoiceArchiveBlueprint },
  { presetId: "astro-web", blueprint: landingPageBlueprint },
  { presetId: "astro-web", blueprint: docsPortalBlueprint },
  { presetId: "android-kotlin-compose", blueprint: habitTrackerBlueprint },
  { presetId: "android-kotlin-compose", blueprint: trailChecklistBlueprint },
]
