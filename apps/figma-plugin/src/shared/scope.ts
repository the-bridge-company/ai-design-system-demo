// What the plugin shows for the MVP (owner decisions 2026-11-18, 2026-11-11, note on the Studio canvas "Décisions"
// page, and 2026-11-10). The promise, and the only one: "Your tokens sync both ways."
//
// In scope: Pull and Push of tokens (a pull request or a suggestion), Sign in with Bridge, contrast.
// Hidden since 2026-11-18: what is missing in Figma (matched by name only, blind to library components, and nothing to
// do with the list while drawing is hidden) and Compare with code (it compares the sets Bridge drew).
// Hidden, code kept: drawing component sets from code (and updating them), two-way variant sync, component changes
// sent from Figma as requests or library branches, "Ask Claude to fix it" and the fix loop (on hold since 2026-11-06:
// Figma fixes stay in the team's Figma), "Draft with Claude" and the Claude setup card. "Send to Figma" is a Studio
// button, off there (SEND_TO_FIGMA_IN_STUDIO in apps/docs-site/src/lib/studio-flags.ts); the plugin has none.
//
// One edit turns everything back on: set PLUGIN_MVP_SCOPE to false (as JIRA_IN_BRIDGE in the site).
export const PLUGIN_MVP_SCOPE = true;

/** Read at run time, so the tests of the hidden features can show them (`scope.mvp = false`). */
export const scope = { mvp: PLUGIN_MVP_SCOPE };

/** The hidden features are shown: only when PLUGIN_MVP_SCOPE is false (or a test asks for them). */
export const fullScope = (): boolean => !scope.mvp;
