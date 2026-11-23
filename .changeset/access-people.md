---
'@bridge-ds/docs-site': patch
---

Bridge on invitation, the founder's side: the notice email of each access request has a "Review the request" button to /admin/access/?request=<email>, where that row is scrolled to, marked and focused (signed out, Sign in comes back to the same address). /admin/access/ is now "Access" with three Tabs: Requests, Invite links and People. People (new admin action `people` on /api/access) lists every account (name, email, GitHub or email code, created, teams and role) and every team (name, repository, members, created), newest first, up to 2000 accounts, never a session or a secret. An access link now opens on "You're invited to the Bridge beta" with "Hi <label>, Florian opened early access to Bridge for you"; signed in already, the Continue screen keeps the invitation (no use taken), or says the link is no longer valid while Continue still works.
