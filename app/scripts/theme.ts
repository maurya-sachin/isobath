// theme:build — writes src/theme/palette.css (R23), src/theme/fonts.css and public/favicon.svg, generated from the TypeScript next to them.

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fontFacesCss } from '../src/theme/fonts.ts'
import { faviconSvg } from '../src/theme/icons.ts'
import { paletteCss } from '../src/theme/palette.ts'

const themeDir = path.resolve(import.meta.dirname, '../src/theme')
await writeFile(path.join(themeDir, 'palette.css'), paletteCss())
await writeFile(path.join(themeDir, 'fonts.css'), fontFacesCss())
await writeFile(path.resolve(themeDir, '../../public/favicon.svg'), faviconSvg())
console.log('✔ wrote palette.css, fonts.css and favicon.svg')
