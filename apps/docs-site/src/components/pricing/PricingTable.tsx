// /pricing/: the full comparison, one DS Table per group, Free, Team and Organization as columns. The price group
// follows the switches above it (components/pricing/pricing-store.ts); the rest is lib/pricing.ts TABLE_GROUPS. A check
// or a dash reads its state to screen readers. Styles: styles/pricing.css.
import { Icon, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, VisuallyHidden } from '@bridge-ds/react';
import { Check, Minus } from 'lucide-react';
import { ORGANIZATION_PRICE, TABLE_GROUPS, TEAM_PRICE, TIERS, money, type TableCell as Cell, type TableGroup } from '../../lib/pricing';
import { usePricing } from './pricing-store';

function Value({ cell }: { cell: Cell }) {
  if (typeof cell === 'string') return <span className="pr-cell-text">{cell}</span>;
  return (
    <span className="pr-cell" data-state={cell ? 'yes' : 'no'}>
      <Icon icon={cell ? Check : Minus} size="sm" className={cell ? 'pr-yes' : 'pr-no'} />
      <VisuallyHidden>{cell ? 'Included' : 'Not included'}</VisuallyHidden>
    </span>
  );
}

export default function PricingTable() {
  const { billing, currency } = usePricing();
  const team = TEAM_PRICE[currency][billing];
  const price: TableGroup = {
    name: 'Price, excluding VAT',
    rows: [
      {
        label: billing === 'yearly' ? 'Per month, billed yearly' : 'Per month, billed monthly',
        cells: [
          money(0, currency),
          `${money(team.perEditor, currency)} per editor, at most ${money(team.cap, currency)} per design system`,
          `${money(ORGANIZATION_PRICE[currency], currency)}${billing === 'monthly' ? ', billed yearly only' : ''}`,
        ],
      },
    ],
  };

  return (
    <div className="pr-table">
      {[price, ...TABLE_GROUPS].map((g) => (
        <Table key={g.name} caption={g.name} narrowLayout="scroll" className="pr-table-group">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" minWidth="12rem">
                <VisuallyHidden>{g.name}</VisuallyHidden>
              </TableHead>
              {TIERS.map((t) => (
                <TableHead key={t.id} scope="col" minWidth="9rem">
                  {t.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {g.rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell>{r.label}</TableCell>
                {r.cells.map((c, i) => (
                  <TableCell key={TIERS[i].id}>
                    <Value cell={c} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ))}
    </div>
  );
}
