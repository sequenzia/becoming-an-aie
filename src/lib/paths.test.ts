// src/lib/paths.test.ts
import { actions } from 'astro:actions';
import { describe, expect, test } from 'vitest';
import { actionFormPath, moduleHref, safeNextPath } from './paths';

describe('actionFormPath', () => {
  test('matches the query string astro:actions puts on a form action', () => {
    expect(actionFormPath('/notify', 'notifySubscribe')).toBe('/notify' + String(actions.notifySubscribe));
    expect(actionFormPath('/progress', 'markModuleComplete')).toBe('/progress' + String(actions.markModuleComplete));
  });

  test('uses the _action query parameter', () => {
    expect(actionFormPath('/notify', 'notifySubscribe')).toBe('/notify?_action=notifySubscribe');
  });
});

describe('moduleHref', () => {
  test('builds module and heading links', () => {
    expect(moduleHref('models')).toBe('/modules/models');
    expect(moduleHref('models', 'workshop')).toBe('/modules/models#workshop');
  });
});

describe('safeNextPath', () => {
  test('accepts same-site relative paths', () => {
    expect(safeNextPath('/modules/models')).toBe('/modules/models');
    expect(safeNextPath('/account?tab=plans')).toBe('/account?tab=plans');
  });

  test('rejects anything that could leave the site', () => {
    expect(safeNextPath('//evil.example')).toBe('/account');
    expect(safeNextPath('https://x.example/')).toBe('/account');
    expect(safeNextPath('/x\\y')).toBe('/account');
    expect(safeNextPath('/proxy?to=https://x.example')).toBe('/account');
    expect(safeNextPath('modules/models')).toBe('/account');
    expect(safeNextPath('')).toBe('/account');
    expect(safeNextPath(null)).toBe('/account');
    expect(safeNextPath(undefined)).toBe('/account');
  });
});
