// Why off in this fork: resolving threads or posting "Fixing" replies the moment an agent starts
// tells reviewers the feedback is handled before anyone has looked at the fix.
export function shouldAcknowledgeSentPRCommentsOnHost(): boolean {
  return false
}
