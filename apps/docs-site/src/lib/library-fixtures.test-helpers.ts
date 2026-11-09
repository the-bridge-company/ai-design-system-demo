// Shared pieces for the Library review phase 3 tests (Map, Who gets it, old addresses). Not a test file itself.
import { withNeededBy, type ProductConfig } from '@bridge-ds/core';
import { pieceOfChange, pieceOfConflict, pieceOfExploration, type ChangeInput, type Viewer } from './library-review';

export const PRODUCTS: ProductConfig[] = [
  { key: 'library', name: 'Library', default: true },
  { key: 'prints', name: 'Acme Prints', repo: 'acme/prints' },
  { key: 'crm', name: 'Acme CRM', repo: 'acme/crm' },
];

export const LEAD: Viewer = { reviews: true, name: 'Dana', leadsPublishTier1: true };

const needed = (piece: string, title: string) =>
  withNeededBy('Body.', { pr: 2, title: 'Bulk actions on products', branch: 'explore/bulk', url: 'https://github.com/acme/prints-design/pull/2', product: 'prints', productName: 'Acme Prints', piece, pieceTitle: title, repo: 'acme/prints-design' });

export const change = (x: Partial<ChangeInput> = {}) =>
  pieceOfChange(
    {
      repo: 'acme/ds',
      number: 13,
      title: 'feat(tokens): Deepen the primary blue for stronger buttons',
      body: needed('color-primary-deeper', 'Deeper primary blue'),
      labels: [],
      statusKind: 'needs-design',
      mine: false,
      by: 'Leo',
      designer: 'Leo',
      ...x,
    },
    PRODUCTS,
  );

export const leadChange = (n: number, title: string) => change({ number: n, title, body: null, mine: true, by: 'Dana', designer: null });

export const newComponent = () =>
  pieceOfExploration({ repo: 'acme/crm-design', number: 7, name: 'Contact page summary', product: 'Acme CRM', productKey: 'crm', href: '?exploration=7&product=crm', designer: 'Sofia', item: { id: 'profile-header', kind: 'component', title: 'ProfileHeader' }, decision: null, nearest: null, asked: true, mine: false })!;

export const conflict = () =>
  pieceOfConflict(
    { component: 'Card', property: 'padding', piece: 'card-padding', mine: { key: 'acme/prints-design#1', designer: 'Sofia', value: '24' }, other: { key: 'acme/crm-design#1', name: 'Deal pipeline cards', product: 'Acme CRM', designer: 'Leo', value: '12' }, pick: null },
    { name: 'Order fulfilment timeline', product: 'Acme Prints', href: null, productKey: 'prints' },
    'Dana',
    { otherPiece: 'card-room', today: '16' },
  );
