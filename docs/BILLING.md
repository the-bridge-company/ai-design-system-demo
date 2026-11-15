# Billing

Bridge bills with Stripe: Team is self-serve (Stripe Checkout, then the Stripe Customer Portal), Organization is set up
by hand and billed by invoice. Everything ships **off**: until launch day, production behaves exactly as before.

- One switch: `BILLING_LAUNCHED` in `apps/docs-site/src/lib/billing.ts` (`false`). While it is false, Studio shows no
  billing at all (the Billing card is not even in the Settings page), the Free limits are never checked (no extra read),
  and every billing endpoint answers 503.
- One date: `BILLING_LAUNCH_DATE` in the same file (`null`). Teams created before it are founding teams. While it is
  null, every team counts as founding.
- No key, no billing: when `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is missing, `GET /api/billing` says
  `{ "billing": "off" }`, `GET /api/billing?team=` says `{ "on": false }`, and checkout and portal answer 503 "Billing
  is not available on this site yet."
- Test teams before launch: `BILLING_TEST_TEAMS` (below) turns billing on for the listed teams only.

## BILLING_TEST_TEAMS: one team on, before launch

A server environment variable, set by Florian in Vercel (Production, or Preview), **removed after the test**. Comma
separated team keys, the same key the billing API takes as `team`:

- a repository's team: `owner/repo` (the part of its Studio address after `/studio/`),
- a team made in Bridge without a repository: `_team/<id>`, or the bare `<id>`. The id is the `team=` value in the
  address of its Settings (`/studio/workspace/settings/?team=<id>`) or of its home (`/studio/workspace/?team=<id>`):
  16 letters and digits. Once that team is linked to a repository, its key becomes `owner/repo`: update the variable.

Billing is on for a team when `BILLING_LAUNCHED` is true **or** the team is listed. For a listed team, everything
applies: the Billing card (team admins only), status, checkout, portal, and the Free limits ("Needs Team" at the 4th
editor; a 2nd design system for its admins). A listed team is founding only if it was marked by hand (so the test sees
Free, then Team). Every other team sees no change. The webhook accepts every signed event once the keys are set, and
writes only on the team the event names. With `BILLING_LAUNCHED` false and the list empty, Studio and the API behave as
before (the Settings page asks `/api/billing?team=` once for an admin and gets `{ "on": false }`). Changing the
variable needs a redeploy to apply.

## The rules the code applies

| | Free | Team | Organization |
| --- | --- | --- | --- |
| Editors | 3 | unlimited (billed up to 10 per design system) | unlimited |
| Design systems | 1 | up to 3 | unlimited |
| Billed | never | per editor, yearly (12 EUR / 14 USD a month) or monthly (15 EUR / 17 USD) | 490 EUR / 550 USD a month, yearly, by invoice |

- **Editor**: whoever proposes or decides in Studio. Counted as the team's email members with Can edit or Admin, plus
  pending invites that would make one (Can edit, Reviewer, Admin). Can view and GitHub-only people do not count.
- **Checkout quantity**: the team's editors, at least 1 and at most 10, times its design systems (1 to 3). One
  subscription item with that quantity rather than one item per design system: the price per editor is the same on every
  design system, so one line reads simpler on the invoice and in the portal. Today a Bridge team is one design system,
  so the quantity is the editor count, capped at 10.
- **Founding teams** (marked at launch, or a team made in Bridge before `BILLING_LAUNCH_DATE`) are never limited and
  never billed: checkout refuses them.
- **A limit pauses, never deletes**, and never charges: on Free, a 4th editor's invite is kept, not emailed, and shows
  "Needs Team" in Members; accepting it, approving a join request, or turning Can view into Can edit answers "needs
  Team" the same way; starting a 2nd design system (a new team made in Bridge by an admin of a Free team) is refused
  with the same words. Nobody already on the team loses anything. Once the team is on Team, Resend sends the waiting
  invite.
- **When a subscription ends** (canceled, unpaid), the team goes back to the Free rules: what is past them waits; nothing
  is deleted, the Stripe customer stays on the team. A failed payment keeps Team while Stripe retries (`past_due`).
- **Refunds** have no code: monthly has no prorated refund (cancel at period end in the portal); a yearly plan is refunded
  in full within 30 days, by hand in the Stripe Dashboard (Payments, the payment, Refund), then cancel the subscription.

## Endpoints

One Vercel function, `apps/docs-site/api/billing/index.ts`; `vercel.json` rewrites `/api/billing/<action>` to it.

| Call | Who | What |
| --- | --- | --- |
| `GET /api/billing` | anyone | `{ billing: 'on' \| 'off' }` |
| `GET /api/billing?team=<team>` | anyone; the status itself to team admins only | `{ on: false }` where billing is off for that team, else the Billing card's status (`on: true`) |
| `POST /api/billing/checkout` `{ team, currency: eur\|usd, interval: yearly\|monthly }` | team admin | `{ url }` of a Stripe Checkout Session |
| `POST /api/billing/portal` `{ team }` | team admin | `{ url }` of a Customer Portal session |
| `POST /api/billing/webhook` | Stripe | signature checked on the raw body, each event once |

Checkout: subscription mode, `automatic_tax`, `tax_id_collection`, `billing_address_collection: required`, the
customer made once per team and kept, `client_reference_id` and `metadata.bridge_team` = the team, back to the team's
Settings. Prices are found by lookup key, never by id.

Storage (Upstash Redis, `api/_lib/billing.ts`): `bridge:billing:team:<team>` (customer, subscription, tier, status,
period end, cancel at period end, currency, interval, quantity), `bridge:billing:customer:<cus>`,
`bridge:billing:founding:<team>`, `bridge:billing:event:<evt>` (30 days). The webhook reads the subscription again from
Stripe on every event, so the order events arrive in does not matter.

## What to set (Florian)

Environment variables on the Vercel project of the docs site (names only, values from the Stripe Dashboard):

- `STRIPE_SECRET_KEY`: Developers, API keys, Secret key (a restricted key works too: write on Customers, Checkout
  Sessions, Customer portal, Subscriptions; read on Prices).
- `STRIPE_WEBHOOK_SECRET`: the signing secret of the webhook endpoint below.

Webhook endpoint (Developers, Webhooks, Add endpoint):

- URL: `https://bridgedesignsystem.com/api/billing/webhook`
- Events, exactly:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Stripe settings (Dashboard, once per mode): Public details: business name **Bridge**; Tax: origin address in France,
registrations (France, and EU OSS once needed); Customer emails: send finalized invoices and failed payment emails;
Subscriptions: Smart Retries on.

## Testing end to end in test mode

1. In the sandbox the catalog and the portal configuration already exist (run `scripts/stripe-catalog.mjs` to check).
2. With the test-mode keys and the sandbox webhook endpoint in place, set `BILLING_TEST_TEAMS` to the key of one test
   team (above) and redeploy. Nothing else changes for anyone.
3. Use a team of your own, never a customer's. Sign in as its admin, open its Settings (Team tab; a team made in Bridge: its workspace Settings), Billing: Move to Team, pick a currency and
   yearly or monthly, Continue to payment.
4. Pay with the card `4242 4242 4242 4242`, any future date, any CVC, any postal code. For a VAT number use
   `FR12345678901` (test mode accepts it).
5. Back in Settings: Team, the quantity paid for, the renewal date. Members: invite a 4th and 5th editor, they are sent.
6. Manage billing: the portal shows the invoice; cancel. The card says "Stops on ..."; in the Dashboard, cancel the
   subscription immediately: the card shows Free again, and a new 4th editor invite waits.
7. Failed payment: in the Dashboard, change the customer's card to `4000 0000 0000 0341` and advance a test clock (or
   use `stripe trigger invoice.payment_failed`): the card asks to update the payment method.

Unit tests cover the same paths offline: `apps/docs-site/src/lib/billing.test.ts` (endpoints and webhook; the
signature is checked by Stripe's own code with an obviously fake secret), `billing-limits.test.ts` (the Free limits,
billing off and on), `components/ds/studio/BillingCard.test.ts`, `scripts/stripe-billing-scripts.test.mjs`.

## Organization (by invoice)

No self-serve checkout. Once the contract is agreed, with the live key in your own shell:

```sh
STRIPE_SECRET_KEY=... node scripts/stripe-organization.mjs --team acme/design-system --currency eur \
  --email billing@acme.example --name "Acme SAS" --country FR --postal-code 75002 --vat FR12345678901
# says what it would do; add --apply to create it
```

It makes (or reuses) the team's customer and a yearly `bridge_org_<currency>_yearly` subscription with
`collection_method: send_invoice`, `days_until_due: 30`, Stripe Tax on, `metadata.bridge_team`. Stripe emails the
invoice; the webhook writes Organization on the team. It never makes a second subscription for a team that has one.

## Launch checklist

0. Remove `BILLING_TEST_TEAMS` from Vercel (and cancel the test subscription in the sandbox).

1. Live catalog: with the **live** key, `node scripts/stripe-catalog.mjs` (dry run), then `--apply`. It creates the two
   products (tax code `txcd_10103001`, `metadata.bridge_tier`), the six prices (same lookup keys, tax exclusive) and the
   portal configuration (`metadata.bridge_portal = team`), and changes nothing that exists. Run again: all `ok`.
2. Live Stripe settings as above (business name, Tax, emails, retries).
3. Live webhook endpoint with the six events; copy its signing secret.
4. Vercel Production: `STRIPE_SECRET_KEY` (live) and `STRIPE_WEBHOOK_SECRET` (live). Keep the test ones on Preview.
5. Founding teams: `node --env-file=.env.prod scripts/billing-mark-founding.mjs` (dry run, lists the teams), then
   `--apply`. Add any team Redis does not know with `--team owner/repo`.
6. In `apps/docs-site/src/lib/billing.ts`: `BILLING_LAUNCH_DATE` = launch day, `BILLING_LAUNCHED = true`, in the same
   pull request as the pricing page (#1184, `LAUNCH_DATE` there is the same day). Add Stripe to `/privacy/` (payment
   processor) in that pull request.
7. After the deploy: `GET /api/billing` says `on`; a real checkout with a real card on a test team, refunded in the
   Dashboard.

Rollback: set `BILLING_LAUNCHED = false` and deploy. Subscriptions keep running in Stripe and the webhook keeps
syncing them; nothing is limited while the switch is off.
