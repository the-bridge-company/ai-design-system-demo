---
'@bridge-ds/core': minor
'@bridge-ds/docs-site': patch
---

Sample team journeys, one source of truth per fact.

- Core: "Ask someone else to review" can ask reviewers who joined by email, by name (`toNames`): they read it in Studio and nobody is mentioned on GitHub for them. A decision keeps those names (`Decision.toNames`).
- Studio asks one set of reviewers everywhere (lib/design-lead `reviewAsk`, the same rule as the name the page shows): on a team whose reviewers joined by email, Done exploring, a designer's answer and Ask someone else name them and mention nobody on GitHub; the toast after Done exploring names the lead ("Sent to Dana, with 2 pieces for the library").
- Who explored an exploration is one rule (lib/author `explorerName`): Library review and its Map name the person who explored it, not who filed a library change it needs.
- Home lists each exploration once (a lead's row and a product manager's row for the same exploration were both shown), so its rows and the Explorations badge agree.
- The Library on the sample team honors See it as (?as=) and the stored pick, shows it in the banner, and opens edit mode (?edit=1) from a direct link for who may edit. A Can view member never gets edit mode.
- A signed-out visitor of the hosted site's own Studio goes to the sample team: Bridge's real products are never shown to the public.
- The onboarding's sign-in step shows an email session as "Signed in as dana@acme.example" under "Sign in".
- Adoption report: Send to developers confirms what was sent (a toast with a link to the request, or to Being built for several) and each group says "Sent to developers"; the trend line says it starts when the product's code changes.
- Check the build has one h1; a product manager's Needs changes stays enabled and asks for the note when it is empty.
