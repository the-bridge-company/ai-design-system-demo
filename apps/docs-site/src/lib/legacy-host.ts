// The redirects of Bridge's former address (api/_lib/site-origin.ts LEGACY_SITE_ORIGINS) that vercel.json carries
// first: a page opened there goes to the same path on SITE_ORIGIN (permanent; Vercel keeps the query). What other
// products, installs and workflows call keeps answering on the old host, never redirected (legacy-host.test.ts):
//   /api/...                 every function (Studio, MCP server, toolbar proxy, CLI and scripts, GitHub webhook, crons)
//   /mcp, /oauth/..., /.well-known/...   the Claude connector, its OAuth server and metadata (/oauth/authorize hands
//                            off to SITE_ORIGIN in code, api/mcp, so the client keeps its issuer)
//   /studio/auth/callback/   a GitHub sign-in already on its way (its state lives in that host's browser storage)
//   /claude-design-system/..., /_astro/...  the Library for Claude Design, built assets
//   any file (an extension below): tokens.css, library-export.zip, *.json data, llms.txt, icons, schemas
import { LEGACY_SITE_ORIGINS, SITE_ORIGIN } from '../../api/_lib/site-origin';

/** Leading path segments that stay on the old host (regex source). */
export const LEGACY_KEPT_PREFIXES = ['api', 'mcp', 'oauth', '\\.well-known', 'claude-design-system', '_astro'] as const;
/** File extensions that stay on the old host: files, not pages (regex source). */
export const LEGACY_KEPT_EXTENSIONS = ['css', 'js', 'mjs', 'cjs', 'map', 'json', 'txt', 'md', 'html', 'xml', 'zip', 'png', 'jpe?g', 'gif', 'webp', 'avif', 'svg', 'ico', 'webmanifest', 'woff2?', 'ttf', 'otf', 'pdf', 'wasm'] as const;

/** The pattern of a page path (after the leading slash) that redirects. */
export const LEGACY_PAGE_PATTERN = `(?!(?:${LEGACY_KEPT_PREFIXES.join('|')})(?:/|$)|studio/auth/callback(?:/|$))(?!.*\\.(?:${LEGACY_KEPT_EXTENSIONS.join('|')})$).*`;

export interface HostRedirect {
  source: string;
  has: { type: 'host'; value: string }[];
  destination: string;
  permanent: true;
}

/** The redirects vercel.json carries first, in order: the root, then every page path, per former address. */
export function legacyHostRedirects(): HostRedirect[] {
  return LEGACY_SITE_ORIGINS.flatMap((origin) => {
    const has = [{ type: 'host' as const, value: new URL(origin).host }];
    return [
      { source: '/', has, destination: `${SITE_ORIGIN}/`, permanent: true as const },
      { source: `/:path(${LEGACY_PAGE_PATTERN})`, has, destination: `${SITE_ORIGIN}/:path`, permanent: true as const },
    ];
  });
}
