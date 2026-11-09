import { useEffect } from 'react'

/** Prints in the light theme, so a dark-theme reader doesn't get pale text on unprinted white paper. */
export function usePrintInLight() {
  useEffect(() => {
    const root = document.documentElement
    let wasDark = false
    const beforePrint = () => {
      wasDark = root.classList.contains('dark')
      root.classList.remove('dark')
    }
    const afterPrint = () => root.classList.toggle('dark', wasDark)
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
    }
  }, [])
}
