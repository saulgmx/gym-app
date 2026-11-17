import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('renders a component in jsdom with jest-dom matchers', () => {
    render(<h1>Hoy</h1>);
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
  });
});
