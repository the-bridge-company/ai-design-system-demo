---
'@bridge-ds/core': minor
'@bridge-ds/cli': minor
'@bridge-ds/docs-site': minor
---

Adoption report follow-ups. A lead or an admin signed in by email can now keep a group as "Not a problem": the decision goes through Bridge like "Send to developers" (the server lets a lead or an admin write `audit-ignores.json` on the bridge-data branch, nothing else there). Saving a decision is safe while the bridge-data workflow runs: `saveAuditIgnore` reads the file again and adds the decision when it changed meanwhile, and the workflow (and `templates/bridge-data.yml`) carries the branch's latest `audit-ignores.json` forward and only replaces the tip it read. Requests sent from a report say so on their rows: "From the Acme CRM adoption report", linked to the report, on Being built and on Changes (the request brief asks developers to keep the origin line in their pull request). The snapshot records each audit's biggest gain (`SnapshotAudit.topGain`), and the Quality adoption row says it in one line: "Buttons would take it from 13% to 24%."
