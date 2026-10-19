// theme:build — writes src/theme/palette.css (R23), src/theme/fonts.css, public/favicon.svg and the comments themes in
// public/giscus/, generated from the TypeScript next to them.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fontFacesCss } from '../src/theme/fonts.ts'
import { giscusThemeCss } from '../src/theme/giscus.ts'
import { faviconSvg } from '../src/theme/icons.ts'
import { paletteCss } from '../src/theme/palette.ts'

const themeDir = path.resolve(import.meta.dirname, '../src/theme')
await writeFile(path.join(themeDir, 'palette.css'), paletteCss())
await writeFile(path.join(themeDir, 'fonts.css'), fontFacesCss())
const publicDir = path.resolve(themeDir, '../../public')
await writeFile(path.join(publicDir, 'favicon.svg'), faviconSvg())
await mkdir(path.join(publicDir, 'giscus'), { recursive: true })
await writeFile(path.join(publicDir, 'giscus/light.css'), giscusThemeCss('light'))
await writeFile(path.join(publicDir, 'giscus/dark.css'), giscusThemeCss('dark'))
console.log('✔ wrote palette.css, fonts.css, favicon.svg and the giscus themes')
