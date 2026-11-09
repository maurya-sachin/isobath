// The custom analytics events and the properties sent with every event. Pure: no DOM and no posthog-js, so Node tests
// can run it. Properties never hold personal data; the only free text is the search query, cut to 80 characters.

const MAX_QUERY_LENGTH = 80

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export type AnalyticsEvent =
  | {
      name: 'search_complete'
      properties: { query: string; results: number; selected_id: string | null; rank: number | null }
    }
  | { name: 'flashcard_rate'; properties: { topic: string; rating: Rating; is_new_card: boolean } }
  | { name: 'flashcard_session_finish'; properties: { topic: string; rated: number; round: number } }
  | { name: 'practice_answer'; properties: { question_id: string; result: 'knew' | 'missed' } }
  | {
      name: 'practice_session_finish'
      properties: { topic: string; chapter: string; knew: number; missed: number }
    }
  | { name: 'exercise_reveal'; properties: { question_id: string; exercise: string } }
  | { name: 'consent_decline'; properties: Record<string, never> }

interface SearchOutcome {
  query: string
  results: number
  selectedId: string | null
  /** Zero-based position of the chosen result, or null when the dialog was dismissed. */
  rankIndex: number | null
}

/** Null for an empty query: closing the dialog without typing says nothing. */
export function searchComplete({ query, results, selectedId, rankIndex }: SearchOutcome): AnalyticsEvent | null {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)
  if (!trimmed) return null
  return {
    name: 'search_complete',
    properties: {
      query: trimmed,
      results,
      selected_id: selectedId,
      rank: rankIndex === null ? null : rankIndex + 1,
    },
  }
}

export const flashcardRate = (topic: string, rating: Rating, isNewCard: boolean): AnalyticsEvent => ({
  name: 'flashcard_rate',
  properties: { topic, rating, is_new_card: isNewCard },
})

export const flashcardSessionFinish = (topic: string, rated: number, round: number): AnalyticsEvent => ({
  name: 'flashcard_session_finish',
  properties: { topic, rated, round },
})

export const practiceAnswer = (questionId: string, knew: boolean): AnalyticsEvent => ({
  name: 'practice_answer',
  properties: { question_id: questionId, result: knew ? 'knew' : 'missed' },
})

export const practiceSessionFinish = (
  topic: string,
  chapter: string,
  knew: number,
  missed: number,
): AnalyticsEvent => ({
  name: 'practice_session_finish',
  properties: { topic, chapter, knew, missed },
})

export const exerciseReveal = (questionId: string, exercise: string): AnalyticsEvent => ({
  name: 'exercise_reveal',
  properties: { question_id: questionId, exercise },
})

export const consentDecline = (): AnalyticsEvent => ({ name: 'consent_decline', properties: {} })

export type ThemeSetting = 'light' | 'dark' | 'system'

/** Sent with every event, so "what settings do readers use" needs no events of its own. */
export function superProperties(appearance: { readingFont: string; textSize: number }, theme: ThemeSetting) {
  return { theme, reading_font: appearance.readingFont, text_size: appearance.textSize }
}
