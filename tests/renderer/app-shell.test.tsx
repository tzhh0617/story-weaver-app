import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../renderer/App';

describe('App shell', () => {
  it('shows the Story Weaver heading', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Story Weaver' }),
    ).toBeInTheDocument();
  });
});
