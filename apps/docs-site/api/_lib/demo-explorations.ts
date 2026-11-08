// The sample team's explorations, started the way an email member starts theirs.
//
// The sample team (src/lib/demo.ts SAMPLE_REPO) shows explorations on its products (Acme Prints, Acme CRM: their
// design team's copies). A real team's designers who joined by email start them in Studio, save their screens, ask a
// lead, and the lead says it looks right: every step goes through Bridge's proxy as them (api/contribute runAsMember),
// so GitHub shows Bridge's App acting with their "Requested by <name> through Bridge." line and the exploration block
// names them (member, memberName). This reads the plan an admin sends (scripts/seed-demo-explorations.mjs) and says
// what is wrong with it, before anything is written; api/contribute action `seed-demo-explorations` does the steps.
//
// Pure. Covered by src/lib/demo-explorations.test.ts.
import { DEMO_MEMBERS, RETIRED_DEMO_MEMBERS, type DemoMember } from './demo-members.js';

/** Where an exploration of the plan ends up: still being explored, waiting for a lead, or handed to the developers. */
export type SeedState = 'exploring' | 'waiting-for-lead' | 'done';
export const SEED_STATES: readonly SeedState[] = ['exploring', 'waiting-for-lead', 'done'];

/** What one plan may hold: a handful of explorations of small source files, never a whole app. */
export const SEED_LIMITS = { items: 40, filesPerItem: 80, bytes: 200_000, request: 320_000 } as const;

/** One product of the sample team that has a design team's copy, as its bridge.config.json names it. */
export interface SeedProduct {
  key: string;
  name: string;
  /** The design team's copy, lower case. */
  copy: string;
  /** The developers' repository, lower case. */
  code: string;
}

export interface SeedFile {
  path: string;
  content: string;
}

export interface SeedItem {
  product: SeedProduct;
  member: Pick<DemoMember, 'email' | 'name'>;
  /** Who says it looks right when the plan wants it done: a lead of the sample team other than the member. */
  lead: Pick<DemoMember, 'email' | 'name'> | null;
  name: string;
  purpose: string;
  useCase?: string;
  branch: string;
  slug: string;
  message: string;
  files: SeedFile[];
  state: SeedState;
}

const BRANCH = /^explore\/([a-z0-9][a-z0-9-]{0,62})$/;

/** A demo member by email or name, never someone the sample team no longer lists. */
export function seedMemberOf(who: unknown): DemoMember | null {
  if (typeof who !== 'string' || !who.trim()) return null;
  const w = who.trim().toLowerCase();
  if (RETIRED_DEMO_MEMBERS.some((r) => r.email === w || r.name.toLowerCase() === w)) return null;
  return DEMO_MEMBERS.find((m) => m.email === w || m.name.toLowerCase() === w) ?? null;
}

/** The lead who answers `member`'s ask: Ann reviews design, Dana answers Ann's own. */
export function seedLeadFor(member: Pick<DemoMember, 'email'>): DemoMember | null {
  const leads = DEMO_MEMBERS.filter((m) => m.lead && m.email !== member.email);
  return leads.find((m) => m.role !== 'admin') ?? leads[0] ?? null;
}

/** Why a file path cannot be saved on an exploration of a copy (mcp savePathProblem, the proxy's sandbox), or null. */
export function seedPathProblem(path: unknown): string | null {
  if (typeof path !== 'string') return 'a file without a path';
  const p = path.trim();
  if (!p || p.length > 300 || p.startsWith('/') || p.includes('\\') || p.split('/').some((x) => x === '' || x === '.' || x === '..')) return `"${path}" is not a path inside the repository`;
  const parts = p.split('/');
  if (parts[0] === '.github') return `${p}: CI settings are not part of an exploration`;
  if (parts.includes('node_modules') || parts.includes('.git')) return `${p}: never saved`;
  if (parts.includes('.vercel') || parts[parts.length - 1] === 'vercel.json') return `${p}: hosting settings are not part of an exploration`;
  return null;
}

/** A product by key, name, copy or developers' repository. */
const productOf = (products: readonly SeedProduct[], v: unknown): SeedProduct | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const w = v.trim().toLowerCase();
  return products.find((p) => p.key === w || p.name.toLowerCase() === w || p.copy === w || p.code === w) ?? null;
};

/**
 * The plan's items, checked: a product with a copy, a member of the sample team, a name, an explore/<slug> branch
 * named once, files that may be saved there within SEED_LIMITS, a known state. Every problem is said at once, or none.
 */
export function parseSeedPlan(plan: unknown, products: readonly SeedProduct[], useCases: readonly string[]): { items: SeedItem[]; problems: string[] } {
  const problems: string[] = [];
  const raw = plan && typeof plan === 'object' ? (plan as { items?: unknown }).items : null;
  if (!Array.isArray(raw) || !raw.length) return { items: [], problems: ['The plan has no items.'] };
  if (raw.length > SEED_LIMITS.items) return { items: [], problems: [`The plan has ${raw.length} items; ${SEED_LIMITS.items} at most.`] };
  const items: SeedItem[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  raw.forEach((x: unknown, i) => {
    const at = `Item ${i + 1}`;
    if (!x || typeof x !== 'object') {
      problems.push(`${at} is not an object.`);
      return;
    }
    const o = x as Record<string, unknown>;
    const product = productOf(products, o.product);
    if (!product) problems.push(`${at}: no product "${String(o.product)}" with a design copy (${products.map((p) => p.key).join(', ') || 'none'}).`);
    const member = seedMemberOf(o.member);
    if (!member) problems.push(`${at}: "${String(o.member)}" is not a member of the sample team (${DEMO_MEMBERS.map((m) => m.name).join(', ')}).`);
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name || name.length > 80) problems.push(`${at}: a name of 1 to 80 characters.`);
    const purpose = typeof o.purpose === 'string' ? o.purpose.trim() : '';
    if (o.purpose !== undefined && typeof o.purpose !== 'string') problems.push(`${at}: purpose is text.`);
    const useCase = typeof o.useCase === 'string' && o.useCase.trim() ? o.useCase.trim() : undefined;
    if (o.useCase !== undefined && (!useCase || !useCases.includes(useCase))) problems.push(`${at}: useCase is one of ${useCases.join(', ')}.`);
    const m = typeof o.branch === 'string' ? BRANCH.exec(o.branch.trim()) : null;
    if (!m) problems.push(`${at}: branch is explore/<slug>, lowercase letters, digits and dashes.`);
    const key = `${product?.copy ?? '?'} ${m?.[1] ?? i}`;
    if (m && seen.has(key)) problems.push(`${at}: ${o.branch} is in the plan twice.`);
    seen.add(key);
    const state = o.state === undefined ? 'exploring' : o.state;
    if (!SEED_STATES.includes(state as SeedState)) problems.push(`${at}: state is one of ${SEED_STATES.join(', ')}.`);
    const lead = member ? seedLeadFor(member) : null;
    if (member && state === 'done' && !lead) problems.push(`${at}: no lead of the sample team can say it looks right.`);
    const message = typeof o.message === 'string' && o.message.trim() ? o.message.trim().slice(0, 200) : `Save ${name}`;
    const files: SeedFile[] = [];
    if (o.files !== undefined && !Array.isArray(o.files)) problems.push(`${at}: files is a list.`);
    const list = Array.isArray(o.files) ? (o.files as unknown[]) : [];
    if (list.length > SEED_LIMITS.filesPerItem) problems.push(`${at}: ${list.length} files; ${SEED_LIMITS.filesPerItem} at most.`);
    const paths = new Set<string>();
    for (const f of list.slice(0, SEED_LIMITS.filesPerItem)) {
      const file = f && typeof f === 'object' ? (f as Record<string, unknown>) : {};
      const bad = seedPathProblem(file.path);
      if (bad) {
        problems.push(`${at}: ${bad}.`);
        continue;
      }
      const path = (file.path as string).trim();
      if (typeof file.content !== 'string') {
        problems.push(`${at}: ${path} has no text content.`);
        continue;
      }
      if (paths.has(path)) problems.push(`${at}: ${path} is listed twice.`);
      paths.add(path);
      bytes += Buffer.byteLength(file.content, 'utf8');
      files.push({ path, content: file.content });
    }
    if (product && member && name && m && SEED_STATES.includes(state as SeedState)) {
      items.push({
        product,
        member: { email: member.email, name: member.name },
        lead: lead ? { email: lead.email, name: lead.name } : null,
        name,
        purpose,
        ...(useCase ? { useCase } : {}),
        branch: m[0],
        slug: m[1]!,
        message,
        files,
        state: state as SeedState,
      });
    }
  });
  if (bytes > SEED_LIMITS.bytes) problems.push(`The files weigh ${Math.round(bytes / 1000)} kB; ${SEED_LIMITS.bytes / 1000} kB at most. Send the plan in a few parts.`);
  return problems.length ? { items: [], problems } : { items, problems };
}

/** The products of a team's bridge.config.json that have a design copy, with their names. Anything malformed is left out. */
export function seedProductsFrom(config: unknown): SeedProduct[] {
  const products = config && typeof config === 'object' ? (config as { products?: unknown }).products : null;
  if (!Array.isArray(products)) return [];
  const repo = (v: unknown) => (typeof v === 'string' && /^[\w.-]+\/[\w.-]+$/.test(v.trim()) ? v.trim().toLowerCase() : null);
  const out: SeedProduct[] = [];
  for (const p of products) {
    if (!p || typeof p !== 'object') continue;
    const o = p as { key?: unknown; name?: unknown; repo?: unknown; design?: { repo?: unknown } };
    const code = repo(o.repo);
    const copy = repo(o.design?.repo);
    if (typeof o.key !== 'string' || !code || !copy || code === copy) continue;
    out.push({ key: o.key.toLowerCase(), name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : o.key, copy, code });
  }
  return out;
}
