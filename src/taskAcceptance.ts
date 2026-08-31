interface AcceptanceRecord {
  readonly criterion: string
}

interface ContractRecord {
  readonly id: string
  readonly decision: string
  readonly details: readonly string[]
  readonly failureBehavior: string
  readonly recovery: readonly string[]
}

export function buildTaskAcceptanceCriteria(
  acceptance: readonly AcceptanceRecord[],
  contracts: readonly ContractRecord[],
  focusedTests: readonly string[],
): string[] {
  return [...new Set([
    ...acceptance.map(item => item.criterion),
    ...contracts.map(item => `Contract ${item.id}: implement the full decision, details, failure behavior, and recovery exactly as rendered in TRD.md.`),
    ...focusedTests.map(file => `Focused test ${file} passes.`),
  ])]
}
