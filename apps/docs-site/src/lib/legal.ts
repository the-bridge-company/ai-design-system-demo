// Who publishes Bridge and who hosts the site: one source for /legal/ (the legal notice, LCEN article 1-1) and
// /terms/ (section 1). Pure data.

export const PUBLISHER = {
  name: 'Florian Gouloubi',
  status: 'Sole proprietor (entrepreneur individuel)',
  address: "26 rue de la Tramontane, 34680 Saint-Georges-d'Orques, France",
  phone: '+33 7 45 39 40 27',
  email: 'hello@bridgedesignsystem.com',
  siren: '947 632 055',
  vat: 'VAT not applicable, article 293 B of the French tax code (Code général des impôts)',
  director: 'Florian Gouloubi',
  /**
   * The site's host, as Vercel publishes it (vercel.com/legal/privacy-policy and vercel.com/legal/terms, read on
   * 2026-11-15): "Vercel Inc.", "440 N Barranca Avenue #4133, Covina, CA 91723, United States".
   */
  host: {
    name: 'Vercel Inc.',
    address: '440 N Barranca Avenue #4133, Covina, CA 91723, United States',
    // TO DECIDE (Florian): Vercel publishes no phone number (privacy policy, terms and contact page checked on
    // 2026-11-15); LCEN article 1-1 asks for one. Its published contact is privacy@vercel.com and vercel.com/contact.
    phone: null as string | null,
    contact: 'privacy@vercel.com',
    contactPage: 'https://vercel.com/contact',
  },
} as const;
