// Settings > Team > Billing, for the team's admins only, and only once billing is launched (lib/billing.ts
// BILLING_LAUNCHED): what the team is on and what that includes, then one action.
//   founding team     the founding line, nothing to pay
//   Free              Move to Team: currency and yearly or monthly, the quantity and price shown before paying, then
//                     Stripe Checkout (scripts/billing-session.ts asks the server for the session)
//   Team, Organization  renews or stops on a date, what is paid for, Manage billing (Stripe Customer Portal)
// Everyone else sees nothing, as do admins while the server says billing is off. The server checks the admin again.
import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, SegmentedControl } from '@bridge-ds/react';
import { BILLING_LAUNCHED, BILLING_WORDS as W, type BillingStatus, type Currency, type Interval } from '../../../lib/billing';
import { useTeamPeople } from './members-state';

/** Where the page goes for Stripe (tests swap it). */
export const go = { to: (href: string) => location.assign(href) };

const defaultCurrency = (): Currency => (typeof navigator !== 'undefined' && /^en-US$/i.test(navigator.language) ? 'usd' : 'eur');

export function BillingRows({ team, status }: { team: string; status: BillingStatus }) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [interval, setBillingInterval] = useState<Interval>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = typeof location !== 'undefined' && new URLSearchParams(location.search).get('billing') === 'done';

  const open = async (which: 'checkout' | 'portal') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const api = await import('../../../scripts/billing-session');
      go.to(which === 'checkout' ? await api.checkoutUrl(team, currency, interval) : await api.portalUrl(team));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : W.failed);
      setBusy(false);
    }
  };

  const paid = status.tier !== 'free';
  return (
    <div className="set-rows">
      <div className="set-row">
        <p className="set-row-label">
          {W.tierName[status.tier]}
          {status.founding && !paid && <Badge tone="success">Founding</Badge>}
        </p>
        <div className="set-row-value">
          <p>{status.founding && !paid ? W.founding : W.includes[status.tier]}</p>
          {paid && status.quantity !== null && status.tier === 'team' && <p className="set-row-help">{W.paidFor(status.quantity)}</p>}
          {paid && status.periodEnd && <p className="set-row-help">{status.cancelAtPeriodEnd ? W.ends(status.periodEnd) : W.renews(status.periodEnd)}</p>}
        </div>
        {status.canManage && (
          <div className="set-row-action">
            <Button variant="secondary" iconEnd={ExternalLink} loading={busy} onClick={() => void open('portal')}>
              {W.manage}
            </Button>
          </div>
        )}
      </div>
      {status.status === 'past_due' && <Alert tone="warning">{W.pastDue}</Alert>}
      {done && !paid && <Alert tone="success">{W.thanks}</Alert>}
      {!paid && !status.founding && (
        <div className="set-row set-row-stack">
          <p className="set-row-label">{W.upgrade}</p>
          <p className="set-row-help">{W.editorsNow(status.editors)}</p>
          <div className="set-row-actions">
            <SegmentedControl label={W.currencyLabel} size="sm" value={currency} onValueChange={(v) => setCurrency(v as Currency)} items={(['eur', 'usd'] as const).map((c) => ({ value: c, label: W.currency[c] }))} />
            <SegmentedControl label={W.intervalLabel} size="sm" value={interval} onValueChange={(v) => setBillingInterval(v as Interval)} items={(['yearly', 'monthly'] as const).map((i) => ({ value: i, label: W.interval[i] }))} />
          </div>
          <p>{W.quote(status.checkoutQuantity, currency, interval)}</p>
          <p className="set-row-help">
            {W.vat} {W.refund[interval]}
          </p>
          <div className="set-row-actions">
            <Button iconStart={CreditCard} loading={busy} onClick={() => void open('checkout')}>
              {W.pay}
            </Button>
          </div>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

/** The band: an admin of a real team, billing launched and on (the server answers), else nothing. */
export default function BillingCard({ launched = BILLING_LAUNCHED }: { launched?: boolean }) {
  const people = useTeamPeople();
  const team = people && people.context === 'real' && people.canManage ? people.repo : null;
  const [status, setStatus] = useState<BillingStatus | null>(null);
  useEffect(() => {
    if (!launched || !team) return;
    let live = true;
    void import('../../../scripts/billing-session').then(({ getBillingStatus }) => getBillingStatus(team)).then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, [launched, team]);
  if (!launched || !team || !status) return null;
  return (
    <section className="ts-band" id="billing" aria-labelledby="ts-billing">
      <h2 id="ts-billing" className="ts-h">
        {W.band}
      </h2>
      <p className="ts-intro">{W.intro}</p>
      <Card>
        <CardBody>
          <BillingRows team={team} status={status} />
        </CardBody>
      </Card>
    </section>
  );
}
