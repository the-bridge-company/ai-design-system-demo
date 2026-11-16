// /pricing/ "What paid plans will cost from 2027": the heading, the two switches (Yearly or Monthly, EUR or USD), the
// three cards (Free, then Team and Organization marked "Opens in 2027") and the line under them (the other billing and
// the VAT mention). No primary button here: the page's one primary action is in the hero. Hydrated on load so the
// currency follows the browser language (components/pricing/pricing-store.ts). Words and prices: lib/pricing.ts.
import { useEffect } from 'react';
import { Badge, Card, CardBody, CardFooter, CardHeader, SegmentedControl } from '@bridge-ds/react';
import ButtonLink from '../ds/ButtonLink';
import {
  BILLINGS,
  BILLING_LABEL,
  CURRENCIES,
  CURRENCY_LABEL,
  ORGANIZATION_PRICE,
  PLANNED_NOTE,
  PLANS_TITLE,
  TEAM_PRICE,
  TIERS,
  VAT_NOTE,
  money,
  type Billing,
  type Currency,
  type Tier,
  type TierId,
} from '../../lib/pricing';
import { initCurrencyFromBrowser, setPricing, usePricing } from './pricing-store';

export interface PricingPlansProps {
  /** Where each card's button goes (Team has none). */
  hrefs: Partial<Record<TierId, string>>;
}

function amount(tier: Tier, billing: Billing, currency: Currency): { value: string; unit: string } {
  if (tier.id === 'free') return { value: money(0, currency), unit: 'No card needed' };
  if (tier.id === 'team') return { value: money(TEAM_PRICE[currency][billing].perEditor, currency), unit: `per editor per month, billed ${billing}` };
  return { value: money(ORGANIZATION_PRICE[currency], currency), unit: billing === 'monthly' ? 'per month, billed yearly only' : 'per month, billed yearly' };
}

/** The line under the cards: the other billing's Team price, then the VAT mention. */
function otherBilling(billing: Billing, currency: Currency): string {
  const other: Billing = billing === 'yearly' ? 'monthly' : 'yearly';
  const p = TEAM_PRICE[currency][other];
  return `${BILLING_LABEL[other]} billing: Team ${money(p.perEditor, currency)} per editor, at most ${money(p.cap, currency)} per design system. Organization is yearly only. ${VAT_NOTE}`;
}

export default function PricingPlans({ hrefs }: PricingPlansProps) {
  const { billing, currency } = usePricing();
  useEffect(() => initCurrencyFromBrowser(), []);
  const cap = money(TEAM_PRICE[currency][billing].cap, currency);

  return (
    <div className="pr-plans">
      <div className="pr-plans-head">
        <div className="pr-plans-title">
          <h2 id="pr-plans" className="pr-h2 pr-h2-lg">
            {PLANS_TITLE}
          </h2>
          <p className="pr-muted">{PLANNED_NOTE}</p>
        </div>
        <div className="pr-switches">
          <SegmentedControl
            label="Billing"
            value={billing}
            onValueChange={(v) => setPricing({ billing: v as Billing })}
            items={BILLINGS.map((b) => ({ value: b, label: BILLING_LABEL[b] }))}
          />
          <SegmentedControl
            label="Currency"
            value={currency}
            onValueChange={(v) => setPricing({ currency: v as Currency })}
            items={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))}
          />
        </div>
      </div>

      <ul className="pr-cards">
        {TIERS.map((t) => {
          const a = amount(t, billing, currency);
          const href = hrefs[t.id];
          return (
            <li key={t.id}>
              <Card className="pr-card" aria-labelledby={`pr-tier-${t.id}`}>
                <CardHeader className="pr-card-head">
                  <h3 id={`pr-tier-${t.id}`} className="pr-tier">
                    {t.name}
                  </h3>
                  {t.badge && (
                    <Badge tone="neutral" size="sm">
                      {t.badge}
                    </Badge>
                  )}
                </CardHeader>
                <CardBody className="pr-card-body">
                  <p className="pr-price">
                    <span className="pr-amount">{a.value}</span>
                    <span className="pr-unit">{a.unit}</span>
                  </p>
                  <p className="pr-pitch">{t.pitch.split('{cap}').join(cap)}</p>
                  <ul className="pr-includes">
                    {t.includes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </CardBody>
                <CardFooter className="pr-card-foot">
                  {t.cta && href ? (
                    <ButtonLink href={href} variant="secondary" fullWidth>
                      {t.cta}
                    </ButtonLink>
                  ) : (
                    <p className="pr-foot-note">{t.footerNote}</p>
                  )}
                </CardFooter>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="pr-small pr-muted">{otherBilling(billing, currency)}</p>
    </div>
  );
}
