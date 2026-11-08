// Work a contributor can pick up: a `planned` question stub, or a coverage gap (`→ —`) in a chapter README.

import type { Topic } from './content.ts'
import { repoRelative } from './paths.ts'

export interface IssueCandidate {
  title: string
  body: string
}

const HOW_TO_START =
  'Start with `templates/README.md` → Adding content. Say here that you are taking it before you begin.'

/** One candidate per planned stub and per gap, in topic and chapter order. */
export function issueCandidates(topics: Topic[]): IssueCandidate[] {
  return topics.flatMap((topic) =>
    topic.chapters.flatMap((chapter) => {
      const where = `${topic.slug}/${chapter.number}-${chapter.slug}`
      const stubs = chapter.questions.flatMap((question) =>
        question.meta?.status === 'planned'
          ? [
              {
                title: `Write: ${question.meta.title} (${where})`,
                body: `Stub: \`${repoRelative(question.file)}\`.\n\n${HOW_TO_START}`,
              },
            ]
          : [],
      )
      const gaps = chapter.subTopics
        .filter((subTopic) => subTopic.refs.length === 0)
        .map((subTopic) => ({
          title: `Cover: ${subTopic.text} (${where})`,
          body: `No question covers this sub-topic yet: \`${repoRelative(chapter.readmeFile)}\` line ${subTopic.line}.\n\n${HOW_TO_START}`,
        }))
      return [...stubs, ...gaps]
    }),
  )
}

/** The candidates whose title is not already used by an issue, open or closed. */
export const withoutExisting = (candidates: IssueCandidate[], existingTitles: string[]): IssueCandidate[] =>
  candidates.filter((candidate) => !existingTitles.includes(candidate.title))
