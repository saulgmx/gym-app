import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

// Spec 000 AC-32 and plan §6.12, with the vite-plugin-pwa virtual module simulated.

const sw = vi.hoisted(() => ({
  waiting: false,
  updateServiceWorker: vi.fn<(reloadPage?: boolean) => Promise<void>>(),
}));

vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react');
  return {
    useRegisterSW: () => ({
      needRefresh: useState(sw.waiting),
      offlineReady: useState(false),
      updateServiceWorker: sw.updateServiceWorker,
    }),
  };
});

beforeEach(() => {
  sw.waiting = false;
  sw.updateServiceWorker.mockReset().mockResolvedValue(undefined);
});

describe('UpdatePrompt', () => {
  it('shows nothing while no new version is waiting', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByText('Hay una versión nueva.')).not.toBeInTheDocument();
  });

  it('AC-32: announces a waiting version without reloading on its own', () => {
    sw.waiting = true;
    render(<UpdatePrompt />);

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva.');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('AC-32: Actualizar activates the new version and reloads', async () => {
    sw.waiting = true;
    render(<UpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('Ahora no hides the prompt without updating', async () => {
    sw.waiting = true;
    render(<UpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByText('Hay una versión nueva.')).not.toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
  });
});
