// A topic's flashcards as an Anki text import file. Headers: https://docs.ankiweb.net/importing/text-files.html

import { SITE_NAME, SITE_URL } from '../../src/lib/site.ts'
import type { Flashcard } from '../../src/content/types.ts'

/** Quotes a field so tabs, newlines and quotes inside it can't break the row. */
const field = (text: string) => `"${text.replaceAll('"', '""')}"`

/** `javascript/how-javascript-runs/ecmascript-engine-host` → `isobath::javascript::how-javascript-runs`, a hierarchical Anki tag. */
function chapterTag(questionId: string): string {
  const [topic, chapter] = questionId.split('/')
  return [SITE_NAME, topic, chapter].join('::')
}

/** Basic notes (front, back), HTML on; the back links to the question that explains the card. Re-importing updates notes whose front is unchanged. */
export function ankiDeck(topicTitle: string, cards: Flashcard[]): string {
  const headers = ['#separator:tab', '#html:true', '#notetype:Basic', `#deck:${SITE_NAME}::${topicTitle}`, '#tags column:3']
  const rows = cards.map((card) => {
    const source = `<br><a href="${SITE_URL}/${card.question}">Read the full question</a>`
    return [field(card.frontHtml), field(card.backHtml + source), field(chapterTag(card.question))].join('\t')
  })
  return [...headers, ...rows].join('\n') + '\n'
}
