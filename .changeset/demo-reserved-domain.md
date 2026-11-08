---
"@bridge-ds/docs-site": patch
---

The sample team's people move to the reserved acme.example domain (acme.design is a real, registered domain): seeding moves their old records, what they own and drops the notification keys of the old addresses. Bridge never mails a reserved or test domain (.example, .test, .invalid, .localhost, example.com, .org, .net), whichever provider, and never mails anything about the sample team (notifications, summaries, sign-in links, invites, join requests). A new admin-only `update-demo-branches` action (scripts/refile-demo-items.mjs --update-branches, dry run by default) brings the sample team's explorations up to date from their product as their member, through the same "Bring it in" path an email member takes, so the activity names the member.
