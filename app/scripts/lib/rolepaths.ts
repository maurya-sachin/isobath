// Role paths: content/paths/<role>.yaml, per `templates/README.md` → Paths.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { chapterStats } from '../../src/content/stats.ts'
import type { PathStep, RolePath, TopicSummary } from '../../src/content/types.ts'
import { countWords } from './frontmatter.ts'
import { contentDir, repoRelative, type Problem } from './paths.ts'

const pathsDir = path.join(contentDir, 'paths')
const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*'

const wordLimit = (limit: number) => (text: string) => countWords(text) <= limit

const stepSchema = z.strictObject({
  ref: z.string().regex(new RegExp(`^${KEBAB}(?:/${KEBAB})?$`), 'must be `<topic>` or `<topic>/<chapter>`'),
  why: z.string().min(1).refine(wordLimit(25), 'must be 25 words or fewer'),
})

const pathSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1).refine(wordLimit(30), 'must be 30 words or fewer'),
  order: z.number().int().positive(),
  start: z.string().min(1).optional(),
  steps: z.array(stepSchema).min(1),
})

export interface RolePathSource extends z.infer<typeof pathSchema> {
  slug: string
  file: string
}

/** What validation needs from a topic; the content loader's `Topic` fits. */
export interface TopicRef {
  slug: string
  chapters: { slug: string }[]
}

/** A resolved path before its start question is rendered (the build adds that). */
export type ResolvedPath = Omit<RolePath, 'start'> & { startId: string | null }

export async function loadRolePaths(problems: Problem[]): Promise<RolePathSource[]> {
  let names: string[]
  try {
    names = (await readdir(pathsDir)).filter((name) => !name.startsWith('.')).sort()
  } catch {
    return [] // no paths yet
  }

  const paths: RolePathSource[] = []
  for (const name of names) {
    const file = path.join(pathsDir, name)
    if (!name.endsWith('.yaml')) {
      problems.push({ file: repoRelative(file), message: 'path files must be `<role>.yaml`' })
      continue
    }
    const parsed = await parsePath(file, problems)
    if (parsed) paths.push({ ...parsed, slug: name.slice(0, -'.yaml'.length), file: repoRelative(file) })
  }
  return paths
}

async function parsePath(file: string, problems: Problem[]) {
  let data: unknown
  try {
    data = parseYaml(await readFile(file, 'utf8'))
  } catch (error) {
    problems.push({ file: repoRelative(file), message: `not valid YAML: ${(error as Error).message}` })
    return undefined
  }
  const result = pathSchema.safeParse(data)
  if (result.success) return result.data
  for (const issue of result.error.issues) {
    problems.push({ file: repoRelative(file), message: `${issue.path.join('.') || 'file'}: ${issue.message}` })
  }
  return undefined
}

const KEBAB_SLUG = new RegExp(`^${KEBAB}$`)

/** `order` is unique across paths: the later path is reported. */
function checkUniqueOrders(paths: RolePathSource[]): Problem[] {
  const owners = new Map<number, string>()
  return paths.flatMap(({ file, slug, order }) => {
    const owner = owners.get(order)
    if (owner === undefined) {
      owners.set(order, slug)
      return []
    }
    return [{ file, message: `order ${order} is already used by \`${owner}\`` }]
  })
}

/** One entry names an existing topic (and chapter), and a chapter entry isn't beside its whole topic. */
function checkStep(file: string, ref: string, steps: RolePathSource['steps'], topics: TopicRef[]): Problem[] {
  const [topicSlug, chapterSlug] = ref.split('/')
  const problems: Problem[] = []
  if (chapterSlug !== undefined && steps.some((step) => step.ref === topicSlug)) {
    problems.push({ file, message: `\`${ref}\` is already covered by \`${topicSlug}\`` })
  }
  const topic = topics.find((candidate) => candidate.slug === topicSlug)
  if (!topic) problems.push({ file, message: `unknown topic \`${topicSlug}\` in entry \`${ref}\`` })
  else if (chapterSlug !== undefined && !topic.chapters.some((chapter) => chapter.slug === chapterSlug)) {
    problems.push({ file, message: `unknown chapter \`${ref}\`` })
  }
  return problems
}

/** Each entry appears once and names something real. */
function checkSteps({ file, steps }: RolePathSource, topics: TopicRef[]): Problem[] {
  const seen = new Set<string>()
  return steps.flatMap(({ ref }) => {
    const repeated: Problem[] = seen.has(ref) ? [{ file, message: `entry \`${ref}\` appears twice` }] : []
    seen.add(ref)
    return [...repeated, ...checkStep(file, ref, steps, topics)]
  })
}

function checkIdentity({ file, slug, start }: RolePathSource, questionIds: ReadonlySet<string>): Problem[] {
  const problems: Problem[] = []
  if (!KEBAB_SLUG.test(slug))
    problems.push({ file, message: 'file name must be kebab-case: it becomes the URL `/paths/<name>`' })
  if (start !== undefined && !questionIds.has(start))
    problems.push({ file, message: `start: unknown question \`${start}\`` })
  return problems
}

/**
 * Every entry names an existing topic (and chapter) and appears once; a chapter entry can't sit beside its whole
 * topic (its questions would count twice); `order` is unique; `start` is a real question.
 */
export function validateRolePaths(
  paths: RolePathSource[],
  topics: TopicRef[],
  questionIds: ReadonlySet<string>,
): Problem[] {
  return [
    ...checkUniqueOrders(paths),
    ...paths.flatMap((rolePath) => [...checkIdentity(rolePath, questionIds), ...checkSteps(rolePath, topics)]),
  ]
}

/**
 * Resolves valid paths (run `validateRolePaths` first) against the built topics, sorted by `order`.
 * Counts and readiness use readable questions only (those with a page in this build).
 */
export function resolveRolePaths(paths: RolePathSource[], topics: TopicSummary[]): ResolvedPath[] {
  return [...paths]
    .sort((a, b) => a.order - b.order)
    .map(({ slug, title, summary, start, steps }) => ({
      slug,
      title,
      summary,
      startId: start ?? null,
      steps: steps.map(({ ref, why }): PathStep => {
        const [topicSlug, chapterSlug] = ref.split('/')
        const topic = topics.find((candidate) => candidate.slug === topicSlug)!
        const chapter =
          chapterSlug === undefined ? null : topic.chapters.find((candidate) => candidate.slug === chapterSlug)!
        const questionCount = chapterStats(chapter ? [chapter] : topic.chapters).readable
        return {
          topic: topic.slug,
          topicTitle: topic.title,
          chapter: chapter?.slug ?? null,
          chapterTitle: chapter?.title ?? null,
          why,
          ready: questionCount > 0,
          started: chapter !== null || topic.chapters.length > 0,
          questionCount,
        }
      }),
    }))
}
