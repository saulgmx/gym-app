import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverFile, type DeliveryEnv } from '../pages/settings/deliver';

// Spec 007 plan §6.7 and §8 decision 15: hand the backup to the share sheet, or download it
// (AC-4 to AC-6). navigator, URL and the timer are injected; the document is jsdom's.

const file = () => new File(['{}'], 'gym-respaldo-2026-11-19.json', { type: 'application/json' });

interface Clicked {
  href: string;
  download: string;
  connected: boolean;
}

function env(nav: DeliveryEnv['navigator']) {
  const timers: { fn: () => void; ms: number }[] = [];
  const clicked: Clicked[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download, connected: this.isConnected });
  });
  const url = {
    createObjectURL: vi.fn(() => 'blob:gym/1234'),
    revokeObjectURL: vi.fn(),
  };
  const deliveryEnv: DeliveryEnv = {
    navigator: nav,
    document,
    url,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
    },
  };
  return { deliveryEnv, timers, clicked, url };
}

const shareable = (share: (data: ShareData) => Promise<void>) => ({
  canShare: vi.fn(() => true),
  share: vi.fn(share),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deliverFile', () => {
  it('AC-4: si el navegador comparte archivos, abre la hoja con el archivo y no descarga', async () => {
    const nav = shareable(() => Promise.resolve());
    const { deliveryEnv, clicked, url } = env(nav);
    const backup = file();
    await expect(deliverFile(backup, deliveryEnv)).resolves.toBe('shared');
    expect(nav.canShare).toHaveBeenCalledWith({ files: [backup] });
    expect(nav.share).toHaveBeenCalledWith({ files: [backup], title: backup.name });
    expect(clicked).toEqual([]);
    expect(url.createObjectURL).not.toHaveBeenCalled();
  });

  it('AC-6: cerrar la hoja (AbortError) no hace nada más', async () => {
    const nav = shareable(() => Promise.reject(new DOMException('cancel', 'AbortError')));
    const { deliveryEnv, clicked } = env(nav);
    await expect(deliverFile(file(), deliveryEnv)).resolves.toBe('cancelled');
    expect(clicked).toEqual([]);
  });

  it('decisión 15: otro error al compartir (NotAllowedError, fuera del gesto) pasa a la descarga', async () => {
    const nav = shareable(() => Promise.reject(new DOMException('gesture', 'NotAllowedError')));
    const { deliveryEnv, clicked } = env(nav);
    await expect(deliverFile(file(), deliveryEnv)).resolves.toBe('downloaded');
    expect(clicked).toHaveLength(1);
  });

  it('AC-5: si canShare dice que no, descarga sin intentar compartir', async () => {
    const nav = { canShare: vi.fn(() => false), share: vi.fn(() => Promise.resolve()) };
    const { deliveryEnv, clicked } = env(nav);
    await expect(deliverFile(file(), deliveryEnv)).resolves.toBe('downloaded');
    expect(nav.share).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
  });

  it('decisión 15 (a): con share pero sin canShare, descarga', async () => {
    const nav = { share: vi.fn(() => Promise.resolve()) };
    const { deliveryEnv, clicked } = env(nav);
    await expect(deliverFile(file(), deliveryEnv)).resolves.toBe('downloaded');
    expect(nav.share).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
  });

  it('decisión 15 (c): la descarga usa un enlace con el nombre, en el documento al pulsarlo y quitado después', async () => {
    const { deliveryEnv, clicked } = env({});
    await deliverFile(file(), deliveryEnv);
    expect(clicked).toEqual([
      { href: 'blob:gym/1234', download: 'gym-respaldo-2026-11-19.json', connected: true },
    ]);
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('decisión 15 (d): la URL se libera a los 60 s, no antes', async () => {
    const { deliveryEnv, timers, url } = env({});
    const backup = file();
    await deliverFile(backup, deliveryEnv);
    expect(url.createObjectURL).toHaveBeenCalledWith(backup);
    expect(url.revokeObjectURL).not.toHaveBeenCalled();
    expect(timers.map((t) => t.ms)).toEqual([60_000]);
    timers[0]?.fn();
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:gym/1234');
  });
});
