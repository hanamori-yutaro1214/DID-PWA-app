// src/services/resolver.js
import { resolveDidKey } from './didKey';
import { resolveDidEthr } from './didEthr';

export async function universalResolve(did) {
  if (did.startsWith('did:key:')) {
    return resolveDidKey(did);
  }
  if (did.startsWith('did:ethr:')) {
    return await resolveDidEthr(did);
  }
  throw new Error('未対応のDIDです。');
}
