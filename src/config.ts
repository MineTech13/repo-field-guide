/**
 * Set VITE_REPO_URL (e.g. in Cloudflare Pages → Settings → Environment variables,
 * or a local .env file) to show "Edit on GitHub" / "Contribute" links.
 */
export const REPO_URL: string = (import.meta.env.VITE_REPO_URL as string | undefined)?.replace(/\/$/, '') ?? '';
