// issues:plan — lists the issues that would be opened for each planned stub and coverage gap; writes nothing.
// issues:open — opens them with `gh`, labelled `good first issue` and `help wanted`; titles already used are skipped.
// Run by the maintainer only: opening issues is public.

import { spawnSync } from 'node:child_process'
import { loadContent } from './lib/content.ts'
import { issueCandidates, withoutExisting, type IssueCandidate } from './lib/issueCandidates.ts'

const LABELS = ['good first issue', 'help wanted']

function gh(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${result.stderr.trim()}`)
  return result.stdout
}

function existingTitles(): string[] {
  const issues = JSON.parse(gh(['issue', 'list', '--state', 'all', '--limit', '1000', '--json', 'title'])) as {
    title: string
  }[]
  return issues.map((issue) => issue.title)
}

function open(candidate: IssueCandidate) {
  const labels = LABELS.flatMap((label) => ['--label', label])
  console.log(gh(['issue', 'create', '--title', candidate.title, '--body', candidate.body, ...labels]).trim())
}

const { topics } = await loadContent()
const all = issueCandidates(topics)
const fresh = withoutExisting(all, existingTitles())
console.log(`${all.length} candidates, ${all.length - fresh.length} already have an issue, ${fresh.length} new`)

if (process.argv.includes('--open')) fresh.forEach(open)
else fresh.forEach((candidate) => console.log(`\n${candidate.title}\n${candidate.body}`))
