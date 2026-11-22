import { useOutletContext, useParams } from 'react-router-dom';
import type { Client } from '@/src/types';

/** The client whose portal is being viewed, supplied by `PortalLayout`. */
export function usePortalClient(): Client {
  return useOutletContext<{ client: Client }>().client;
}

/**
 * The current portal's base path, preserving whichever URL shape the visitor
 * arrived on — `/portal/{slug}/{token}` or the older `/portal/{token}`.
 * Links inside the portal build on this so navigating never silently rewrites
 * the address the client was given.
 */
export function usePortalBase(): string {
  const { slug, token } = useParams();
  return slug ? `/portal/${slug}/${token}` : `/portal/${token}`;
}
