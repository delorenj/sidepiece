/**
 * Wire-contract version: a plain integer, not the package version and not semver.
 * Echoed on `/v1/health` and on every response as the `X-Sidepiece-Contract` header.
 * Bump it by hand in the same change as any breaking change to a `contract/` type.
 */
export const CONTRACT_VERSION: number = 1;
