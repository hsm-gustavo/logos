import { describe, expect, it } from 'vitest'
import { createNoteID } from './noteId'

describe('note id', () => {
  it('creates a lowercase alphanumeric id', () => {
    const id = createNoteID(1712476800000, 42)

    expect(id).toMatch(/^[a-z0-9]+$/)
    expect(id.length).toBeGreaterThanOrEqual(6)
  })

  it('creates different ids for different entropy', () => {
    const first = createNoteID(1712476800000, 42)
    const second = createNoteID(1712476800000, 43)

    expect(first).not.toBe(second)
  })
})
