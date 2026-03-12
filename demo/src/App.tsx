import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "./components/Header"
import type { Theme } from "./types"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within App")
  }
  return context
}

export function App({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <TooltipProvider>
        <div className="bg-background text-foreground">
          <Header theme={theme} onThemeChange={setTheme} />
          {children}
        </div>
      </TooltipProvider>
    </ThemeContext.Provider>
  )
}
