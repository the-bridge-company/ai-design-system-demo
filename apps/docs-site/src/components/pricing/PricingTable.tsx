// /pricing/: the full comparison, one DS Table per group, Free, Team and Organization as columns. Every group has the
// same fixed column widths (layout="fixed", widths in styles/pricing.css), so each tier sits on one vertical line down
// the whole table. Under 700px a DS tier switch shows one tier at a time next to the labels (Team first), with no
// sideways scroll. The price group follows the switches above it (components/pricing/pricing-store.ts); the rest is
// lib/pricing.ts TABLE_GROUPS. A check or a dash reads its state to screen readers.
import { useState } from 'react';
import { Icon, SegmentedControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, VisuallyHidden } from '@bridge-ds/react';
import { Check, Minus } from 'lucide-react';
import {
  NARROW_DEFAULT_TIER,
  ORGANIZATION_PRICE,
  TABLE_GROUPS,
  TEAM_PRICE,
  TIERS,
  money,
  type TableCell as Cell,
  type TableGroup,
  type TierId,
} from '../../lib/pricing';
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
  const [shown, setShown] = useState<TierId>(NARROW_DEFAULT_TIER);
  const team = TEAM_PRICE[currency][billing];
  const price: TableGroup = {
    name: 'Price',
    rows: [
      {
        label: 'Planned price, per month',
        cells: [
          money(0, currency),
          `${money(team.perEditor, currency)} per editor, at most ${money(team.cap, currency)} per design system, billed ${billing}`,
          `${money(ORGANIZATION_PRICE[currency], currency)}, billed yearly${billing === 'monthly' ? ' only' : ''}`,
        ],
      },
    ],
  };

  return (
    <div className="pr-table" data-shown={shown}>
      <div className="pr-tier-switch">
        <SegmentedControl
          label="Tier to compare"
          value={shown}
          onValueChange={(v) => setShown(v as TierId)}
          items={TIERS.map((t) => ({ value: t.id, label: t.name }))}
          fullWidth
        />
      </div>
      {[price, ...TABLE_GROUPS].map((g) => (
        <Table key={g.name} caption={g.name} layout="fixed" narrowLayout="scroll" className="pr-table-group">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pr-col-label">
                <VisuallyHidden>{g.name}</VisuallyHidden>
              </TableHead>
              {TIERS.map((t) => (
                <TableHead key={t.id} scope="col" className="pr-col-tier" data-tier={t.id}>
                  {t.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {g.rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="pr-col-label">{r.label}</TableCell>
                {r.cells.map((c, i) => (
                  <TableCell key={TIERS[i].id} className="pr-col-tier" data-tier={TIERS[i].id}>
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
