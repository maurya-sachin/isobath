// Scaffolds a topic's chapters and planned question stubs from an approved outline (PLAN Phase 7).
// The outline is the authored part; this module only turns it into files. It never invents a title.

import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { CHAPTER_DIR, QUESTION_FILE } from './content.ts'
import { frontmatterSchema } from './frontmatter.ts'

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case')

const questionSchema = z.strictObject({
  number: z
    .string()
    .regex(/^\d{3}$/, 'must be three digits')
    .optional(),
  slug: kebab,
  title: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  frequency: z.int().min(1).max(5),
  core: z.boolean().optional(),
})

const subTopicSchema = z.strictObject({
  text: z.string().min(1),
  questions: z.array(z.string().regex(/^\d{3}$/, 'must be a question number')).default([]),
})

const chapterSchema = z.strictObject({
  number: z.string().regex(/^\d{2}$/, 'must be two digits'),
  slug: kebab,
  title: z.string().min(1),
  summary: z.string().min(1),
  learning_goals: z.array(z.string().min(1)).min(1),
  sub_topics: z.array(subTopicSchema).optional(),
  sources: z.array(z.string().min(1)).min(1),
  open_questions: z.array(z.string().min(1)).optional(),
  questions: z.array(questionSchema).min(1),
})

const outlineSchema = z.strictObject({
  topic: kebab,
  chapters: z.array(chapterSchema).min(1),
})

type QuestionInput = z.infer<typeof questionSchema>
type ChapterInput = z.infer<typeof chapterSchema>

export interface OutlineQuestion {
  number: string
  slug: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  frequency: number
  core: boolean
}

export interface OutlineSubTopic {
  text: string
  questions: string[]
}

export interface OutlineChapter {
  number: string
  slug: string
  title: string
  summary: string
  learningGoals: string[]
  subTopics: OutlineSubTopic[]
  sources: string[]
  openQuestions: string[]
  questions: OutlineQuestion[]
}

export interface Outline {
  topic: string
  chapters: OutlineChapter[]
}

/** Parses and validates an outline; throws one error listing every problem. */
export function parseOutline(text: string, source = 'outline'): Outline {
  let data: unknown
  try {
    data = parseYaml(text)
  } catch (error) {
    throw new Error(`${source}: not valid YAML: ${(error as Error).message}`, { cause: error })
  }

  const result = outlineSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || 'outline'}: ${issue.message}`)
    throw new Error(`${source}:\n${issues.join('\n')}`)
  }

  const problems: string[] = []
  const chapterNumbers = new Set<string>()
  const chapterSlugs = new Set<string>()

  const chapters = result.data.chapters.map((chapter) => {
    const where = `${chapter.number}-${chapter.slug}`
    addUnique(chapterNumbers, chapter.number, `${where}: chapter number ${chapter.number} is used twice`, problems)
    addUnique(chapterSlugs, chapter.slug, `${where}: chapter slug \`${chapter.slug}\` is used twice`, problems)
    if (!CHAPTER_DIR.test(`${chapter.number}-${chapter.slug}`)) problems.push(`${where}: invalid chapter folder name`)

    const questions = readQuestions(chapter, where, problems)
    // Every question must sit under a sub-topic; with none given, each question names its own.
    const subTopics =
      chapter.sub_topics?.map((subTopic) => ({ text: subTopic.text, questions: subTopic.questions })) ??
      questions.map((question) => ({ text: question.title, questions: [question.number] }))
    checkSubTopics(subTopics, questions, where, problems)

    return {
      number: chapter.number,
      slug: chapter.slug,
      title: chapter.title,
      summary: chapter.summary,
      learningGoals: chapter.learning_goals,
      subTopics,
      sources: chapter.sources,
      openQuestions: chapter.open_questions ?? [],
      questions,
    }
  })

  if (problems.length > 0) throw new Error(`${source}:\n${problems.join('\n')}`)
  return { topic: result.data.topic, chapters }
}

function addUnique(seen: Set<string>, value: string, problem: string, problems: string[]): void {
  if (seen.has(value)) problems.push(problem)
  seen.add(value)
}

function readQuestions(chapter: ChapterInput, where: string, problems: string[]): OutlineQuestion[] {
  const next = { value: 10 }
  const numbers = new Set<string>()
  return chapter.questions.map((question) => {
    if (question.number) next.value = Math.max(next.value, Number(question.number) + 10)
    const number = question.number ?? String(next.value).padStart(3, '0')
    if (!question.number) next.value += 10
    addUnique(numbers, number, `${where}: question number ${number} is used twice`, problems)
    if (!QUESTION_FILE.test(`${number}-${question.slug}.md`))
      problems.push(`${where}/${number}: invalid question file name`)
    checkQuestion(question, number, where, problems)
    return { ...question, number, core: question.core ?? false }
  })
}

function checkQuestion(question: QuestionInput, number: string, where: string, problems: string[]): void {
  const meta = frontmatterSchema.safeParse({
    title: question.title,
    status: 'planned',
    difficulty: question.difficulty,
    frequency: question.frequency,
    core: question.core ?? false,
  })
  if (!meta.success) {
    problems.push(`${where}/${number}: ${meta.error.issues.map((issue) => issue.message).join('; ')}`)
  } else if (meta.data.frequency === 5 && !meta.data.core) {
    problems.push(`${where}/${number}: frequency 5 must set core: true (templates/README.md)`)
  }
}

function checkSubTopics(
  subTopics: OutlineSubTopic[],
  questions: OutlineQuestion[],
  where: string,
  problems: string[],
): void {
  const numbers = new Set(questions.map((question) => question.number))
  const covered = new Set(subTopics.flatMap((subTopic) => subTopic.questions))
  for (const ref of covered) {
    if (!numbers.has(ref)) problems.push(`${where}: sub-topic points to missing question ${ref}`)
  }
  for (const number of numbers) {
    if (!covered.has(number)) problems.push(`${where}: question ${number} is not listed under any sub-topic`)
  }
}

export function renderStub(question: OutlineQuestion): string {
  // JSON strings are valid YAML double-quoted scalars, so titles with `:` or quotes stay safe.
  return [
    '---',
    `title: ${JSON.stringify(question.title)}`,
    'status: planned',
    `difficulty: ${question.difficulty}`,
    `frequency: ${question.frequency}`,
    `core: ${question.core}`,
    '---',
    '',
  ].join('\n')
}

export function renderChapterReadme(chapter: OutlineChapter): string {
  const subTopics = chapter.subTopics.map((subTopic) => {
    const refs = subTopic.questions.length > 0 ? subTopic.questions.join(', ') : '—'
    return `- ${subTopic.text} → ${refs}`
  })
  return [
    `# ${chapter.number} — ${chapter.title}`,
    '',
    `> **Status:** 🔴 planned · **Published:** 0/${chapter.questions.length} · **Last verified:** —`,
    '',
    chapter.summary,
    '',
    '## Learning goals',
    '',
    'After this chapter you can:',
    '',
    ...chapter.learningGoals.map((goal) => `- ${goal}`),
    '',
    '## Sub-topics',
    '',
    'Every concept this chapter owns — its coverage checklist. Each ends with the question(s) covering it, or `→ —` when none does yet (a known gap).',
    '',
    ...subTopics,
    '',
    '## Questions',
    '',
    '<!-- generated:questions:start -->',
    '<!-- generated:questions:end -->',
    '',
    '## Sources',
    '',
    ...chapter.sources.map((source) => `- ${source}`),
    '',
    '## Open questions',
    '',
    ...(chapter.openQuestions.length > 0 ? chapter.openQuestions.map((question) => `- [ ] ${question}`) : ['- [ ] —']),
    '',
  ].join('\n')
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

/** Every file the scaffold would write, without touching the disk. */
export function plannedFiles(root: string, outline: Outline): string[] {
  return outline.chapters.flatMap((chapter) => {
    const dir = path.join(root, outline.topic, `${chapter.number}-${chapter.slug}`)
    return [
      path.join(dir, 'README.md'),
      ...chapter.questions.map((question) => path.join(dir, `${question.number}-${question.slug}.md`)),
    ]
  })
}

/** Writes the outline to `root` (`content/` in the CLI). Refuses to overwrite anything. */
export async function scaffoldTopic(
  root: string,
  outline: Outline,
  options: { dryRun?: boolean } = {},
): Promise<string[]> {
  const files = plannedFiles(root, outline)
  const taken = []
  for (const file of files) {
    if (await exists(file)) taken.push(file)
  }
  const dirs = outline.chapters.map((chapter) => path.join(root, outline.topic, `${chapter.number}-${chapter.slug}`))
  for (const dir of dirs) {
    if (await exists(dir)) taken.push(dir)
  }
  if (taken.length > 0) {
    throw new Error(`already exists, not overwriting:\n${taken.join('\n')}`)
  }
  if (options.dryRun) return files

  for (const chapter of outline.chapters) {
    const dir = path.join(root, outline.topic, `${chapter.number}-${chapter.slug}`)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'README.md'), renderChapterReadme(chapter))
    await Promise.all(
      chapter.questions.map((question) =>
        writeFile(path.join(dir, `${question.number}-${question.slug}.md`), renderStub(question), { flag: 'wx' }),
      ),
    )
  }
  return files
}
