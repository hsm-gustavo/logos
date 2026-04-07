export type DebouncedRunner = {
  schedule: (callback: () => void) => void
  cancel: () => void
}

export function createDebouncedRunner(delayMs: number): DebouncedRunner {
  let timer: ReturnType<typeof setTimeout> | undefined

  return {
    schedule(callback) {
      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        timer = undefined
        callback()
      }, delayMs)
    },
    cancel() {
      if (!timer) {
        return
      }
      clearTimeout(timer)
      timer = undefined
    },
  }
}
