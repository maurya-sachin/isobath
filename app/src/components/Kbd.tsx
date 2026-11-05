/** A keyboard key hint shown inside a button; hidden on small screens where there is usually no keyboard. */
export function Kbd({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden="true"
      className="ml-1.5 hidden rounded border border-current/40 px-1 font-mono text-[0.7rem] text-inherit sm:inline"
    >
      {children}
    </kbd>
  )
}
