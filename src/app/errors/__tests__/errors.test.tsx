import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { routes } from '../../router';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { AppNotice } from '../AppNotice';
import { installGlobalErrorHandlers } from '../global-handlers';
import { GENERIC_ERROR_MESSAGE } from '../messages';
import { useNoticeStore } from '../notice-store';
import { reloadApp } from '../reload';

// Spec 000 AC-28, AC-29 and plan §6.11 (ADR-0010: unexpected errors).

vi.mock('../reload', () => ({ reloadApp: vi.fn() }));

function Boom(): never {
  throw new Error('render failed');
}

function rejectionEvent(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason });
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useNoticeStore.setState({ notice: null });
  vi.mocked(reloadApp).mockClear();
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('render errors', () => {
  it('uses the generic message from spec 000 §6', () => {
    expect(GENERIC_ERROR_MESSAGE).toBe(
      'Algo salió mal. Tus datos guardados no se han perdido. Recarga la app para continuar.',
    );
  });

  it('AC-28: AppErrorBoundary shows the generic alert instead of a blank screen', async () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);

    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(reloadApp).toHaveBeenCalledOnce();
  });

  it('AC-28: a page that throws inside the router shows the same alert', () => {
    const [root] = routes;
    if (!root) throw new Error('Expected a root route');
    // The real root errorElement above a page that throws.
    const router = createMemoryRouter(
      [{ errorElement: root.errorElement, children: [{ path: 'boom', element: <Boom /> }] }],
      { initialEntries: ['/boom'] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });
});

describe('notice store', () => {
  it('keeps the visible notice when another one arrives', () => {
    const { showNotice } = useNoticeStore.getState();
    showNotice({ message: 'first' });
    showNotice({ message: 'second' });
    expect(useNoticeStore.getState().notice).toEqual({ message: 'first' });
  });
});

describe('async errors', () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installGlobalErrorHandlers();
  });

  afterEach(() => {
    uninstall();
  });

  it('AC-29: an unhandled rejection shows the generic notice and is logged', () => {
    render(<AppNotice />);
    const reason = new Error('write failed');
    act(() => {
      window.dispatchEvent(rejectionEvent(reason));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), reason);
  });

  it('AC-29: an uncaught error event shows the notice and is logged', () => {
    render(<AppNotice />);
    const error = new Error('handler failed');
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { error }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  });

  it('spec 007 decisión 19: an error event without an error object (a browser script) only warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<AppNotice />);
    const message =
      "TypeError: null is not an object (evaluating 'this.viewportDominantIFrameElement().contentWindow')";
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message }));
      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.', error: null }));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useNoticeStore.getState().notice).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      ['Ignored error from outside the app', message],
      ['Ignored error from outside the app', 'Script error.'],
    ]);
    warn.mockRestore();
  });

  it('spec 007 decisión 19: a plain error Event (error undefined) only warns too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<AppNotice />);
    act(() => {
      window.dispatchEvent(new Event('error'));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('spec 007 decisión 19: only a missing error object is ignored; any other value shows the notice', () => {
    render(<AppNotice />);
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { error: 'thrown string' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), 'thrown string');
  });

  it('keeps a single notice when several errors arrive', () => {
    render(<AppNotice />);
    act(() => {
      window.dispatchEvent(rejectionEvent(new Error('first')));
      window.dispatchEvent(rejectionEvent(new Error('second')));
    });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it('offers Recargar and Cerrar; Cerrar hides the notice', async () => {
    render(<AppNotice />);
    act(() => {
      window.dispatchEvent(rejectionEvent(new Error('write failed')));
    });

    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(reloadApp).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stops listening after uninstall', () => {
    render(<AppNotice />);
    uninstall();
    act(() => {
      window.dispatchEvent(rejectionEvent(new Error('ignored')));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
