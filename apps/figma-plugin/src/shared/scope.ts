// What the plugin shows for the MVP (owner decision 2026-11-19, confirmed 2026-11-22; earlier ones 2026-11-18,
// 2026-11-11, note on the Studio canvas "Décisions" page, and 2026-11-10). The published plugin is tokens only. The
// promise, and the only one: "Your tokens sync both ways between GitHub and Figma."
//
// In scope: Pull and Push of tokens (a pull request or a suggestion), Sign in with Bridge, contrast checks.
// Hidden, code kept (fullScope() shows them again):
// - what is missing in Figma (the components from the code this file does not have, matched by name: blind to a
//   team's library components, and nothing to do with the list while drawing is hidden). The pull reads no component.
// - Compare with code (it compares the sets Bridge drew with images of the code).
// - drawing component sets from code (and updating them), the "Spec source" setting, two-way variant sync, component
//   changes sent from Figma as requests or library branches, "Ask Claude to fix it" and the fix loop (on hold since
//   2026-11-06: Figma fixes stay in the team's Figma), "Draft with Claude" and the Claude setup card.
// "Send to Figma" is a Studio button, off there (SEND_TO_FIGMA_IN_STUDIO in apps/docs-site/src/lib/studio-flags.ts);
// the plugin has none.
//
// One edit turns everything back on: set PLUGIN_MVP_SCOPE to false (as JIRA_IN_BRIDGE in the site).
export const PLUGIN_MVP_SCOPE = true;

/** Read at run time, so the tests of the hidden features can show them (`scope.mvp = false`). */
export const scope = { mvp: PLUGIN_MVP_SCOPE };

/** The hidden features are shown: only when PLUGIN_MVP_SCOPE is false (or a test asks for them). */
export const fullScope = (): boolean => !scope.mvp;
