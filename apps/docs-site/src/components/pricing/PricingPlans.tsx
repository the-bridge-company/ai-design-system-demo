// /pricing/: the two switches (Yearly or Monthly, EUR or USD) and the three tier cards, Team recommended. Hydrated on
// load so the currency follows the browser language (components/pricing/pricing-store.ts). Words and prices:
// lib/pricing.ts. Styles: styles/pricing.css.
import { useEffect } from 'react';
import { Badge, Card, CardBody, Icon, SegmentedControl } from '@bridge-ds/react';
import { Check, Minus } from 'lucide-react';
import ButtonLink from '../ds/ButtonLink';
import {
  BILLINGS,
  BILLING_LABEL,
  CURRENCIES,
  CURRENCY_LABEL,
  ORGANIZATION_PRICE,
  TEAM_PRICE,
  TIERS,
  VAT_NOTE,
  editorsCapped,
  inWords,
  money,
  type Billing,
  type Currency,
  type Tier,
  type TierId,
} from '../../lib/pricing';
import { initCurrencyFromBrowser, setPricing, usePricing } from './pricing-store';

export interface PricingPlansProps {
  /** Where each tier's button goes. */
  hrefs: Record<TierId, string>;
}

function Price({ tier, billing, currency }: { tier: Tier; billing: Billing; currency: Currency }) {
  if (tier.id === 'free') {
    return (
      <div className="pr-price">
        <p className="pr-amount">{money(0, currency)}</p>
        <p className="pr-per">No card needed</p>
      </div>
    );
  }
  if (tier.id === 'team') {
    const p = TEAM_PRICE[currency][billing];
    return (
      <div className="pr-price">
        <p className="pr-amount">
          {money(p.perEditor, currency)}
          <span className="pr-unit"> per editor per month</span>
        </p>
        <p className="pr-per">Billed {billing}</p>
        <p className="pr-cap">
          Capped at {money(p.cap, currency)} a month per design system: editors past {inWords(editorsCapped(p))} cost nothing.
        </p>
      </div>
    );
  }
  return (
    <div className="pr-price">
      <p className="pr-amount">
        {money(ORGANIZATION_PRICE[currency], currency)}
        <span className="pr-unit"> per month</span>
      </p>
      <p className="pr-per">{billing === 'monthly' ? 'Billed yearly only' : 'Billed yearly'}</p>
    </div>
  );
}

export default function PricingPlans({ hrefs }: PricingPlansProps) {
  const { billing, currency } = usePricing();
  useEffect(() => initCurrencyFromBrowser(), []);

  return (
    <div className="pr-plans">
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
        <p className="pr-vat">{VAT_NOTE}</p>
      </div>

      <ul className="pr-cards">
        {TIERS.map((t) => (
          <li key={t.id}>
            <Card className="pr-card" data-recommended={t.recommended ? '' : undefined} aria-labelledby={`pr-tier-${t.id}`}>
              <CardBody className="pr-card-body">
                <div className="pr-card-head">
                  <h2 id={`pr-tier-${t.id}`} className="pr-tier">
                    {t.name}
                  </h2>
                  {t.recommended && (
                    <Badge tone="info" size="sm">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="pr-pitch">{t.pitch}</p>
                <Price tier={t} billing={billing} currency={currency} />
                <ButtonLink href={hrefs[t.id]} variant={t.recommended ? 'primary' : 'secondary'} size="lg" fullWidth>
                  {t.cta}
                </ButtonLink>
                <ul className="pr-includes">
                  {t.includes.map((line) => (
                    <li key={line}>
                      <Icon icon={Check} size="sm" className="pr-yes" />
                      <span>{line}</span>
                    </li>
                  ))}
                  {t.without && (
                    <li className="pr-without">
                      <Icon icon={Minus} size="sm" className="pr-no" />
                      <span>{t.without}</span>
                    </li>
                  )}
                </ul>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
