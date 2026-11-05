import { Outlet, type LoaderFunctionArgs, type RouteObject } from 'react-router'
import { Layout } from '@/components/Layout'
import { LoadingShell } from '@/components/LoadingShell'
import { NotFound } from '@/components/PageShell'
import { RouteError } from '@/components/RouteError'
import {
  loadChangelog,
  loadFlashcards,
  loadManifest,
  loadPractice,
  loadQuestion,
  loadTopic,
  MANIFEST_ROUTE_ID,
  TOPIC_ROUTE_ID,
} from '@/content/index-data'

// Each page is its own chunk, fetched in parallel with its loader.
// Pages under `:topic` read the topic with `useTopic()`. Practice and Flashcards sit under their own
// paths, so their loaders return the topic alongside their data.
export const routes: RouteObject[] = [
  {
    id: MANIFEST_ROUTE_ID,
    path: '/',
    element: <Layout />,
    errorElement: <RouteError standalone />,
    HydrateFallback: LoadingShell,
    loader: loadManifest,
    children: [
      // Pages sit under a pathless route so a failed load renders inside the layout, keeping the header.
      {
        errorElement: <RouteError />,
        children: [
          { index: true, lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }) },
          { path: 'paths', lazy: async () => ({ Component: (await import('@/pages/PathsPage')).PathsPage }) },
          { path: 'paths/:slug', lazy: async () => ({ Component: (await import('@/pages/PathPage')).PathPage }) },
          {
            path: 'changelog',
            lazy: async () => ({ Component: (await import('@/pages/ChangelogPage')).ChangelogPage }),
            loader: loadChangelog,
          },
          { path: 'roadmap', lazy: async () => ({ Component: (await import('@/pages/RoadmapPage')).RoadmapPage }) },
          {
            path: 'practice',
            lazy: async () => ({ Component: (await import('@/pages/PracticeHubPage')).PracticeHubPage }),
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
