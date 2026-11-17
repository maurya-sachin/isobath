---
title: "What breaks when you run a Next.js app on several instances?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [self-hosting, multi-instance, version-skew, server-actions, deployment-id, cache-handler]
related:
  - nextjs/mutations/isr-and-on-demand-revalidation
  - nextjs/cache-components/private-and-remote-cache
  - nextjs/previous-caching/default-cache-locations
  - nextjs/optimizations/next-image-responsibilities
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
  - nextjs/deployment/next-build-output
verified: 2026-11
perishable:
  - "Action IDs salted with the encryption key (16.4.5)"
  - "Generated key cached in .next/cache/.rscinfo for 14 days"
  - "Constant build ID when deploymentId is set, since 16.2"
  - "images.customCacheHandler opt-in, default in next major"
sources:
  - https://nextjs.org/docs/app/guides/self-hosting#multi-server-deployments
  - https://nextjs.org/docs/app/guides/self-hosting#version-skew
  - https://nextjs.org/docs/app/guides/self-hosting#configuring-caching
  - https://nextjs.org/docs/app/guides/self-hosting#multi-instance-cache-coordination
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId#how-it-works
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath#image-optimization-caching
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers#handler-types
  - https://nextjs.org/docs/messages/failed-to-find-server-action
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/app-render/encryption-utils-server.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/build/webpack-config.ts
tldr: >
  Everything `next start` keeps per process. ISR pages, revalidation, `use cache` entries and
  optimized images live in each instance's memory and disk. Separately built instances also get
  different Server Action keys and IDs, so actions fail with "Failed to find Server Action".
  Fixes: one build or a shared encryption key, a `deploymentId`, and shared cache handlers.
---

## Answer

`next start` assumes it is alone. Its state splits into two kinds.

**Per-instance caches.** All on Next.js 16.4.5, `next build && next start`:
- **ISR and on-demand revalidation.** Each instance regenerates its own copy, and `revalidatePath`/`revalidateTag` mark entries stale only in the process that ran them (measured in the ISR question).
- **`use cache`** keeps an in-memory LRU per process, and `use cache: remote` is the same LRU until `cacheHandlers.remote` is set (see that question).
- **The image optimizer.** The same `/_next/image` URL was `MISS` then `HIT` on instance A, then `MISS` again on B: each wrote its own file in `.next/cache/images`.

**Per-build identity.** Instances built separately differ even from the same commit:
- **Server Action IDs and encryption key.** A build generates an AES key (or reuses one cached in `.next/cache/.rscinfo` for 14 days) and salts action IDs with it. Two fresh checkouts got different keys and different IDs, so an action posted to the other instance got `409` and `Failed to find Server Action "0090f7…". This request might be from an older or newer deployment.`
- **Build ID.** It differs per build, so a client navigation answered by the other build turned into a full page reload.

**The fixes the self-hosting guide lists:**
- build once and run that output everywhere, or set the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64, 16, 24 or 32 bytes) at every build;
- set `deploymentId` per deployment, so assets carry `?dpl=` and mismatches reload instead of mixing versions;
- configure `cacheHandler` (ISR, route handlers, and images with `images.customCacheHandler: true`) and `cacheHandlers` (`use cache`) backed by a shared store with a tag index, and `cacheMaxMemorySize: 0` so no instance keeps a private copy. These handlers weren't built here.

## Example

```text
Same source, two fresh checkouts built separately. A small Node proxy sends HTML
document GETs to A (port 3301) and every other request to B (3302). Chrome 156:
load /, click a button that increments state, then one of three controls.

                                  save()      inline action      <Link href="/other">
keys differ (default)             409         409                full reload, A's HTML
                                  "This page couldn’t load"
same NEXT_SERVER_ACTIONS_         ran on B    ran on B,          full reload, A's HTML
ENCRYPTION_KEY                                "from-closure"
same key, deploymentId v1 / v1    ran on B    ran on B           client nav: "other build-B"
same key, deploymentId v1 / v2    ran on B    ran on B           full reload, A's HTML

Action IDs: random keys  A 0090f717…  40ddbd45…   B 009e44c9…  4044d6be…
            shared key   A 007fc0b2…  4002a022…   B 007fc0b2…  4002a022…
```

`save` is a module-level action; the inline one closes over `label = 'from-closure'`, which travels encrypted with the form. With a shared key, B decrypted it and logged `INLINE RAN from-closure`. Firefox 159 gave the same results.

## Pitfalls

- Building per environment or per instance and assuming same commit means same build. Action IDs differed; only a shared key made them match.
- Sharing one `deploymentId` across different builds. It silences skew detection: the navigation rendered B's page inside A's document.
- Changing client code during a rolling deploy without routing by deployment. A's HTML asked B for `3spfmrl3-b19k.js?dpl=v1` and got `404`; the page never hydrated, so the forms fell back to native `POST`s. Next.js doesn't route on `?dpl=`; that's the proxy's or CDN's job.
- An in-process cache handler (a `Map`). The guide warns it gives each instance its own cache again.

## Follow-ups

**Q:** Why did a rebuild in the same folder keep working?
**A:** The second build reused the key from `.next/cache/.rscinfo` (it expires after 14 days), so IDs matched. A CI runner without that cache generates a new key.

**Q:** What does a shared handler need for `revalidateTag`?
**A:** Per the docs: a tag index in the shared store for `cacheHandler`, and for `cacheHandlers` a `refreshTags()` that syncs tag state before each request, so a call on one instance invalidates everywhere.

**Q:** With `deploymentId` set, what is the build ID?
**A:** Constant: both builds wrote the same `BUILD_ID`, and skew detection moved to the `x-nextjs-deployment-id` response header.
