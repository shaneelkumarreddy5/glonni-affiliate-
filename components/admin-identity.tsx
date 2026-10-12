'use client';

import { createContext, useContext, type ReactNode } from 'react';

type AdminIdentity = { name: string; role: string };
const IdentityContext = createContext<AdminIdentity>({ name: 'Account', role: '' });

export function AdminIdentityProvider({ identity, children }: { identity: AdminIdentity; children: ReactNode }) {
  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}

export function useAdminIdentity() {
  return useContext(IdentityContext);
}
