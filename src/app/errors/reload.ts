// Own module so tests can replace it: jsdom cannot spy on location.reload.
export function reloadApp(): void {
  window.location.reload();
}
