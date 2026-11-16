// /pricing/ FAQ: the DS Accordion, "When do paid plans open?" open on load, hydrated when it scrolls into view (client:visible). Amounts follow the currency
// switch (components/pricing/pricing-store.ts). Words: lib/pricing.ts FAQ.
import { Accordion, AccordionItem, Link } from '@bridge-ds/react';
import { FAQ, FAQ_OPEN, faqAnswer, type FaqLink } from '../../lib/pricing';
import { usePricing } from './pricing-store';

export interface PricingFaqProps {
  /** Where an answer's link goes. */
  links: Record<FaqLink['to'], string>;
}

export default function PricingFaq({ links }: PricingFaqProps) {
  const { currency } = usePricing();
  return (
    <Accordion headingLevel={3} defaultValue={[FAQ_OPEN]} className="pr-faq-list">
      {FAQ.map((f) => (
        <AccordionItem key={f.id} value={f.id} title={f.question}>
          {faqAnswer(f, currency).map((a) => (
            <p key={a} className="pr-faq-answer">
              {a}
            </p>
          ))}
          {f.link && (
            <p className="pr-faq-answer">
              <Link href={links[f.link.to]}>{f.link.label}</Link>
            </p>
          )}
        </AccordionItem>
      ))}
    </Accordion>
  );
}
