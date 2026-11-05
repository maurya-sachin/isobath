import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TEXT_SIZES, type Appearance } from '@/lib/appearance'
import { resetAppearance, setAppearance, useAppearance } from '@/lib/appearanceStore'
import { cn } from '@/lib/utils'
import { DEFAULT_HUE, HUE_PRESETS } from '@/theme/palette'

const CHOICE =
  'rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted aria-checked:border-link aria-checked:bg-tldr aria-checked:text-tldr-foreground'

/** Reading and accessibility settings, kept in this browser: accent colour per mode, text size, contrast and motion. */
export function AppearanceMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Appearance and accessibility settings">
          <SlidersHorizontal />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <AppearancePanel />
      </PopoverContent>
    </Popover>
  )
}

/** Mounted only while the popover is open, so `separate` starts from the settings saved in this browser. */
function AppearancePanel() {
  const appearance = useAppearance()
  const [separate, setSeparate] = useState(appearance.hueLight !== appearance.hueDark)
  const update = (patch: Partial<Appearance>) => setAppearance({ ...appearance, ...patch })
  const setHue = (mode: 'light' | 'dark', hue: number) =>
    update(separate ? { [mode === 'light' ? 'hueLight' : 'hueDark']: hue } : { hueLight: hue, hueDark: hue })

  return (
    <>
      <h2 className="font-semibold">Appearance</h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Text size</legend>
        <div role="radiogroup" aria-label="Text size" className="flex gap-2">
          {TEXT_SIZES.map(({ percent, label }) => (
            <button
              key={percent}
              type="button"
              role="radio"
              aria-checked={appearance.textSize === percent}
              className={cn(CHOICE, 'flex-1')}
              onClick={() => update({ textSize: percent })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <HueSetting
        label={separate ? 'Accent, light mode' : 'Accent colour'}
        hue={appearance.hueLight}
        onChange={(hue) => setHue('light', hue)}
      />
      {separate && (
        <HueSetting label="Accent, dark mode" hue={appearance.hueDark} onChange={(hue) => setHue('dark', hue)} />
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-link"
          checked={separate}
          onChange={(event) => setSeparate(event.target.checked)}
        />
        Different accent in dark mode
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-link"
          checked={appearance.contrast === 'high'}
          onChange={(event) => update({ contrast: event.target.checked ? 'high' : 'auto' })}
        />
        Higher contrast
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-link"
          checked={appearance.motion === 'reduce'}
          onChange={(event) => update({ motion: event.target.checked ? 'reduce' : 'auto' })}
        />
        Reduce motion
      </label>
      <p className="text-xs text-muted-foreground">
        Contrast and motion follow your system settings unless you switch them on here. Choices stay in this browser.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          resetAppearance()
          setSeparate(false)
        }}
      >
        Reset to defaults
      </Button>
    </>
  )
}

function HueSetting({ label, hue, onChange }: { label: string; hue: number | null; onChange: (hue: number) => void }) {
  const value = hue ?? DEFAULT_HUE
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {HUE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            role="radio"
            aria-checked={value === preset.hue}
            className={cn(CHOICE, 'flex items-center gap-2')}
            onClick={() => onChange(preset.hue)}
          >
            {/* The accent's lightness and chroma in the current mode (`--accent-lc`), at this preset's hue. */}
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: `oklch(var(--accent-lc) ${preset.hue})` }}
            />
            {preset.name}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="shrink-0">Custom hue</span>
        <input
          type="range"
          min={0}
          max={359}
          value={value}
          className="w-full accent-link"
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output className="w-8 shrink-0 text-right tabular-nums">{value}°</output>
      </label>
    </fieldset>
  )
}
