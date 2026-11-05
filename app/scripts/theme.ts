// theme:build — writes src/theme/palette.css from src/theme/palette.ts (R23).

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { paletteCss } from '../src/theme/palette.ts'

const file = path.resolve(import.meta.dirname, '../src/theme/palette.css')
await writeFile(file, paletteCss())
console.log('✔ wrote src/theme/palette.css')
