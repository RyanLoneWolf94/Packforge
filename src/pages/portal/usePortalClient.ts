import { useOutletContext } from 'react-router-dom';
import type { Client } from '@/src/types';

/** The client whose portal is being viewed, supplied by `PortalLayout`. */
export function usePortalClient(): Client {
  return useOutletContext<{ client: Client }>().client;
}
