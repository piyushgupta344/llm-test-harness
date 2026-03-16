import type { CassetteInteraction, CassetteRequest } from '../types.js'
import type { CassetteStore } from './cassette-store.js'
import { hashRequest } from './cassette-hash.js'
import { CassetteMissError } from '../errors.js'

export function findInteraction(
  store: CassetteStore,
  req: CassetteRequest,
): CassetteInteraction | undefined {
  const hash = hashRequest(req)
  return store.findById(hash)
}

export function requireInteraction(
  store: CassetteStore,
  req: CassetteRequest,
): CassetteInteraction {
  const hash = hashRequest(req)
  const interaction = store.findById(hash)
  if (!interaction) throw new CassetteMissError(hash)
  return interaction
}
