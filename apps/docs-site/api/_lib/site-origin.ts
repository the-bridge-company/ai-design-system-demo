// Bridge's public address, and the older one that still answers. vercel.json sends people who open a page on the old
// host to the same page on SITE_ORIGIN (a permanent redirect). Machine endpoints (the API, /mcp, OAuth, files) keep
// answering on the old host, so Claude connectors, Figma plugins and toolbars installed with it keep working.

/** Where Bridge lives. */
export const SITE_ORIGIN = 'https://bridgedesignsystem.com';

/** Older addresses of the same deployment, still attached to it. */
export const LEGACY_SITE_ORIGINS: readonly string[] = ['https://bridge.floriangouloubi.com'];

const KNOWN = new Set([SITE_ORIGIN, ...LEGACY_SITE_ORIGINS]);

const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return null;
  }
};

/** The origin is one of the older addresses: its pages redirect to SITE_ORIGIN. */
export const isLegacyOrigin = (origin: string): boolean => LEGACY_SITE_ORIGINS.includes(originOf(origin) ?? '');

/**
 * The origin a machine-facing answer names (OAuth issuer, links handed to the Figma plugin): the host the request came
 * in on when it is one of Bridge's own addresses, so an install made with the old address keeps seeing one origin.
 * Else PUBLIC_SITE_URL, else the request's own origin (previews, local servers, other deployments).
 */
export function requestSiteOrigin(req: Request, publicUrl: string | undefined): string {
  const own = new URL(req.url).origin;
  if (KNOWN.has(own.toLowerCase())) return own.toLowerCase();
  const pub = publicUrl?.trim() ? originOf(publicUrl.trim()) : null;
  return pub ?? own;
}
