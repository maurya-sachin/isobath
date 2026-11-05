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
      <PopoverContent
        align="end"
        className="max-h-(--radix-popover-content-available-height) w-80 gap-4 overflow-y-auto p-4"
      >
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

      <ChoiceGroup
        label="Text size"
        value={appearance.textSize}
        options={TEXT_SIZES.map(({ percent, label }) => ({ value: percent, label }))}
        onChange={(textSize) => update({ textSize })}
      />
      <ChoiceGroup
        label="Reading font"
        value={appearance.readingFont}
        options={[
          { value: 'serif', label: 'Serif' },
          { value: 'sans', label: 'Sans' },
        ]}
        onChange={(readingFont) => update({ readingFont })}
      />
      <ChoiceGroup
        label="Line spacing"
        value={appearance.spacing}
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'relaxed', label: 'Relaxed' },
        ]}
        onChange={(spacing) => update({ spacing })}
      />

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

/** One setting with a few exclusive choices, as a radio group of buttons. */
function ChoiceGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={cn(CHOICE, 'flex-1')}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
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
