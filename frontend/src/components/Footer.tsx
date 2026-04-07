export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-14 border-t border-[var(--line)] px-4 pb-10 pt-6 text-[var(--sea-ink-soft)]">
      <div className="page-wrap flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-xs">
          &copy; {year} Logos. Built for deep study sessions.
        </p>
        <p className="m-0 text-xs uppercase tracking-[0.2em]">
          Markdown Native
        </p>
      </div>
    </footer>
  )
}
