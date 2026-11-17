import 'fake-indexeddb/auto';
import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from '../bootstrap';
import { GENERIC_ERROR_MESSAGE } from '../errors/messages';
import { useNoticeStore } from '../errors/notice-store';

// Spec 000 AC-33 and plan §5 (startup order).

let rootElement: HTMLElement;
let teardown: (() => void) | undefined;

// Awaited act: "Hoy" suspends on use(ready), and React only retries it inside an awaited act.
async function start(storage: Parameters<typeof bootstrap>[1]['storage']) {
  await act(async () => {
    teardown = bootstrap(rootElement, { storage });
    await Promise.resolve();
  });
}

/** Lets the fire-and-forget persist() promise settle. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  rootElement = document.body.appendChild(document.createElement('div'));
  useNoticeStore.setState({ notice: null });
});

afterEach(() => {
  act(() => teardown?.());
  teardown = undefined;
  rootElement.remove();
});

describe('bootstrap', () => {
  it('renders the app into the root element', async () => {
    await start(undefined);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(rootElement).toContainElement(screen.getByRole('navigation', { name: 'Principal' }));
  });

  it('AC-33: asks for persistent storage once when the API exists', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    await start({ persist });
    await settle();
    expect(persist).toHaveBeenCalledOnce();
  });

  it.each([
    ['there is no navigator.storage', undefined],
    ['storage has no persist()', {}],
  ])('AC-33: starts without a visible error when %s', async (_case, storage) => {
    await start(storage);
    await settle();
    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-33: a denied request shows no error', async () => {
    await start({ persist: vi.fn().mockResolvedValue(false) });
    await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-33: a rejected request is handled, so no error notice appears', async () => {
    // Uncaught, the rejection would reach the global unhandledrejection handler in the browser.
    // jsdom never fires that event, so the test checks that a rejection handler is attached:
    // .catch(fn), .then(ok, fn) and await inside try/catch all call then() with a function second.
    const rejected = Promise.reject(new Error('not allowed'));
    const then = vi.spyOn(rejected, 'then');
    await start({ persist: () => rejected });
    await settle();

    expect(then.mock.calls.some(([, onRejected]) => typeof onRejected === 'function')).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('installs the global handlers and mounts AppNotice', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await start(undefined);
    await screen.findByRole('heading', { level: 1, name: 'Hoy' });

    act(() => {
      window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'boom' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    consoleError.mockRestore();
  });

  it('teardown removes the handlers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await start(undefined);
    await screen.findByRole('heading', { level: 1, name: 'Hoy' });
    act(() => teardown?.());
    teardown = undefined;

    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'boom' }));
    expect(useNoticeStore.getState().notice).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
