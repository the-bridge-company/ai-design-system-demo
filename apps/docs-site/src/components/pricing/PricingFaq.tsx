// /pricing/ FAQ: the DS Accordion, hydrated when it scrolls into view (client:visible). Words: lib/pricing.ts FAQ.
import { Accordion, AccordionItem } from '@bridge-ds/react';
import { FAQ } from '../../lib/pricing';

export default function PricingFaq() {
  return (
    <Accordion headingLevel={3} className="pr-faq-list">
      {FAQ.map((f) => (
        <AccordionItem key={f.id} value={f.id} title={f.question}>
          {f.answer.map((a) => (
            <p key={a} className="pr-faq-answer">
              {a}
            </p>
          ))}
        </AccordionItem>
      ))}
    </Accordion>
  );
}
