import { useTheme } from './ThemeProvider'
import { MdOutlineWbSunny } from 'react-icons/md'
import { IoMoonOutline } from 'react-icons/io5'
import { MdComputer } from 'react-icons/md'

export default function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()

  const label = `Theme mode: ${theme}. Click to switch mode.`
  const text =
    theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'

  const icon =
    theme === 'system' ? (
      <MdComputer size={'15px'} />
    ) : theme === 'dark' ? (
      <IoMoonOutline size={'15px'} />
    ) : (
      <MdOutlineWbSunny size={'15px'} />
    )

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={label}
      title={label}
      className="action-btn action-btn-icon"
    >
      {icon} {!collapsed && text}
    </button>
  )
}
