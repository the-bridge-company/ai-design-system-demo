---
"@bridge-ds/docs-site": minor
---

Changes: the Library group stays for everyone and every library change says where it comes from (boards LI6, LI7).
"Needed by Order fulfilment timeline · Acme Prints" links to the exploration; the rest reads "From the DS lead" with
the reason Bridge can tell (accessibility fix, new brand, from the Figma UI kit, docs, rule for every product). The
origin is read from an `origin` field in any Bridge block of the change (tolerant), else its "Needed by" block, else
inferred. A filter narrows it (All, From explorations, From the DS lead, with counts, kept in the address), and the
library rows wear the exploration section's tags (Needs Dana, Approved, Being built, Kept in this screen). The design
lead groups the library by component or by exploration: a component two explorations ask for in different ways opens
with Compare and pick, an exploration asking for what the lead already made opens with Approve, build once, the rest
stays folded. Library changes no longer hide under their exploration's row.
