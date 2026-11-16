// /pricing/ "Only what changes between tiers": one DS Table, the rows that differ, Free, Team and Organization as
// columns, in words. Fixed column widths (styles/pricing.css). Under 700px a DS tier switch shows the labels and one
// tier at a time (Team first), with no sideways scroll. Rows: lib/pricing.ts DIFF_ROWS.
import { useState } from 'react';
import { SegmentedControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, VisuallyHidden } from '@bridge-ds/react';
import { DIFF_ROWS, NARROW_DEFAULT_TIER, TIERS, type TierId } from '../../lib/pricing';

export default function PricingTable() {
  const [shown, setShown] = useState<TierId>(NARROW_DEFAULT_TIER);
  return (
    <div className="pr-table" data-shown={shown}>
      <div className="pr-tier-switch">
        <SegmentedControl label="Tier to compare" value={shown} onValueChange={(v) => setShown(v as TierId)} items={TIERS.map((t) => ({ value: t.id, label: t.name }))} fullWidth />
      </div>
      <Table aria-label="Differences between tiers" layout="fixed" narrowLayout="scroll" className="pr-table-group">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="pr-col-label">
              <VisuallyHidden>What changes</VisuallyHidden>
            </TableHead>
            {TIERS.map((t) => (
              <TableHead key={t.id} scope="col" className="pr-col-tier" data-tier={t.id}>
                {t.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {DIFF_ROWS.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="pr-col-label">{r.label}</TableCell>
              {r.cells.map((c, i) => (
                <TableCell key={TIERS[i].id} className="pr-col-tier" data-tier={TIERS[i].id}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
