/** Official inference roots; legacy roots remain readable in saved catalogs. */

/**
 * Resolve the documented endpoint root for one OpenCode billing route.
 * @param provider - Go subscription or Console pay-as-you-go identity.
 * @returns the HTTPS root before the protocol version and operation.
 */
export function inferenceRoot(provider: 'opencode' | 'opencode-go'): string {
  return `https://opencode.ai/inference${provider === 'opencode-go' ? '/go' : ''}`
}
