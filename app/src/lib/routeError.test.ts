import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeRouteError } from './routeError.ts'

test('a failed fetch or an offline browser reads as offline', () => {
  assert.equal(describeRouteError(new TypeError('Failed to fetch'), true).kind, 'offline')
  assert.equal(describeRouteError(new Error('anything'), false).kind, 'offline')
})

test('a 404 route response is not found', () => {
  // The shape react-router gives a thrown 404 response.
  const response = { status: 404, statusText: 'Not Found', internal: true, data: null }
  assert.equal(describeRouteError(response, true).kind, 'not-found')
})

test('anything else is unexpected', () => {
  assert.equal(describeRouteError(new Error('Could not load manifest.json (500)'), true).kind, 'unexpected')
  assert.equal(describeRouteError(undefined, true).kind, 'unexpected')
})
