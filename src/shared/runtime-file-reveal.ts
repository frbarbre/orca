/** Fork: where `orca file open --line/--column` puts the cursor; both 1-based. */
export type RuntimeFileReveal = {
  line: number
  column?: number
}
