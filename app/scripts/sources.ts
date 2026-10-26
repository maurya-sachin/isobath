// sources:list — prints every distinct page cited in a question's `sources`, one URL per line, for the weekly link check.

import { loadContent } from './lib/content.ts'
import { sourceUrls } from './lib/sourceUrls.ts'

const { topics } = await loadContent()
const questions = topics.flatMap((topic) => topic.chapters.flatMap((chapter) => chapter.questions))
console.log(sourceUrls(questions).join('\n'))
