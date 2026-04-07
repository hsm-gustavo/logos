import Sqids from 'sqids'

const sqids = new Sqids({
  alphabet: 'abcdefghijklmnopqrstuvwxyz0123456789',
  minLength: 6,
})

export function createNoteID(
  now = Date.now(),
  entropy = Math.floor(Math.random() * 1_000_000),
): string {
  return sqids.encode([now, entropy])
}
