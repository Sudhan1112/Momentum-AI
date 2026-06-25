'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('canvas-ai-theme') as Theme | null
      const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      const initial = stored ?? preferred
      setTheme(initial)
      applyTheme(initial)
    } catch {
      applyTheme('dark')
    }
  }, [])

  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(t)
    root.setAttribute('data-theme', t)
    root.style.colorScheme = t
  }

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('canvas-ai-theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
