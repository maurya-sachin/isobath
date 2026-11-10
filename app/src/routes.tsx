import { Outlet, type LoaderFunctionArgs, type RouteObject } from 'react-router'
import { Layout } from '@/components/Layout'
import { LoadingShell } from '@/components/LoadingShell'
import { NotFound } from '@/components/PageShell'
import { RouteError } from '@/components/RouteError'
import {
  loadChangelog,
  loadCheatsheet,
  loadFlashcards,
  loadManifest,
  loadPractice,
  loadQuestion,
  loadSiteIndex,
  loadTopic,
  SITE_ROUTE_ID,
  TOPIC_ROUTE_ID,
} from '@/content/index-data'

// Each page is its own chunk, fetched in parallel with its loader.
// Pages under `:topic` read the topic with `useTopic()`. Practice and Flashcards sit under their own
// paths, so their loaders return the topic alongside their data.
export const routes: RouteObject[] = [
  {
    id: SITE_ROUTE_ID,
    path: '/',
    element: <Layout />,
    errorElement: <RouteError standalone />,
    HydrateFallback: LoadingShell,
    loader: loadSiteIndex,
    children: [
      // Pages sit under a pathless route so a failed load renders inside the layout, keeping the header.
      {
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }),
            loader: loadManifest,
          },
          {
            path: 'paths',
            lazy: async () => ({ Component: (await import('@/pages/PathsPage')).PathsPage }),
            loader: loadManifest,
          },
          {
            path: 'paths/:slug',
            lazy: async () => ({ Component: (await import('@/pages/PathPage')).PathPage }),
            loader: loadManifest,
          },
          {
            path: 'changelog',
            lazy: async () => ({ Component: (await import('@/pages/ChangelogPage')).ChangelogPage }),
            loader: loadChangelog,
          },
          {
            path: 'privacy',
            lazy: async () => ({ Component: (await import('@/pages/PrivacyPage')).PrivacyPage }),
          },
          {
            path: 'cheatsheet/:topic/:chapter',
            lazy: async () => ({ Component: (await import('@/pages/CheatsheetPage')).CheatsheetPage }),
            loader: ({ params }: LoaderFunctionArgs) => loadCheatsheet(params.topic, params.chapter),
          },
          {
            path: 'roadmap',
            lazy: async () => ({ Component: (await import('@/pages/RoadmapPage')).RoadmapPage }),
            loader: loadManifest,
          },
          {
            path: 'practice',
            lazy: async () => ({ Component: (await import('@/pages/PracticeHubPage')).PracticeHubPage }),
            loader: loadManifest,
          },
          {
            path: 'practice/:topic',
            lazy: async () => ({ Component: (await import('@/pages/PracticeTopicPage')).PracticeTopicPage }),
            loader: ({ params }: LoaderFunctionArgs) => loadTopic(params.topic),
          },
          {
            path: 'practice/:topic/:chapter',
            lazy: async () => ({ Component: (await import('@/pages/PracticePage')).PracticePage }),
            loader: ({ params }: LoaderFunctionArgs) => loadPractice(params.topic, params.chapter),
          },
          {
            path: 'flashcards/:topic',
            lazy: async () => ({ Component: (await import('@/pages/FlashcardsPage')).FlashcardsPage }),
            loader: ({ params }: LoaderFunctionArgs) => loadFlashcards(params.topic),
          },
          {
            id: TOPIC_ROUTE_ID,
            path: ':topic',
            element: <Outlet />,
            loader: ({ params }: LoaderFunctionArgs) => loadTopic(params.topic),
            children: [
              { index: true, lazy: async () => ({ Component: (await import('@/pages/TopicPage')).TopicPage }) },
              {
                path: ':chapter',
                lazy: async () => ({ Component: (await import('@/pages/ChapterPage')).ChapterPage }),
              },
              {
                path: ':chapter/:question',
                lazy: async () => ({ Component: (await import('@/pages/QuestionPage')).QuestionPage }),
                loader: ({ params }: LoaderFunctionArgs) =>
                  loadQuestion(`${params.topic}/${params.chapter}/${params.question}`),
              },
            ],
          },
          { path: '*', element: <NotFound what="Page" /> },
        ],
      },
    ],
  },
]
