// theme:build — writes src/theme/palette.css (R23) and src/theme/fonts.css, generated from the TypeScript next to them.

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fontFacesCss } from '../src/theme/fonts.ts'
import { paletteCss } from '../src/theme/palette.ts'

const themeDir = path.resolve(import.meta.dirname, '../src/theme')
await writeFile(path.join(themeDir, 'palette.css'), paletteCss())
await writeFile(path.join(themeDir, 'fonts.css'), fontFacesCss())
console.log('✔ wrote src/theme/palette.css and src/theme/fonts.css')
