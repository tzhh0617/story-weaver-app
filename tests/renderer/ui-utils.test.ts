import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { cn } from '@story-weaver/frontend/lib/utils';
import { Button } from '@story-weaver/frontend/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@story-weaver/frontend/components/ui/sidebar';

describe('cn', () => {
  it('merges truthy class names into a single string', () => {
    expect(cn('base', false && 'hidden', 'active')).toBe('base active');
  });
});

describe('renderer UI primitives', () => {
  it('shows loading while an async button click is pending', async () => {
    let resolveClick: () => void = () => undefined;
    const clickPromise = new Promise<void>((resolve) => {
      resolveClick = resolve;
    });

    render(createElement(Button, { onClick: () => clickPromise }, '保存'));

    const button = screen.getByRole('button', { name: '保存' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
    expect(button).toBeDisabled();
    expect(
      button.querySelector('[data-testid="button-loading-indicator"]')
    ).toBeInTheDocument();
    expect(
      button.querySelector('[data-testid="button-loading-indicator"]')
    ).toHaveClass('absolute');
    expect(
      button.querySelector('[data-testid="button-content"]')
    ).toHaveClass('opacity-0');

    resolveClick();

    await waitFor(() => {
      expect(button).not.toHaveAttribute('aria-busy');
    });
    expect(button).toBeEnabled();
  });

  it('renders sidebar menu buttons through the local alias setup', () => {
    render(
      createElement(
        SidebarProvider,
        null,
        createElement(
          Sidebar,
          null,
          createElement(
            SidebarContent,
            null,
            createElement(
              SidebarMenu,
              null,
              createElement(
                SidebarMenuItem,
                null,
                createElement(SidebarMenuButton, null, '作品')
              )
            )
          )
        )
      )
    );

    expect(screen.getByRole('button', { name: '作品' })).toBeInTheDocument();
  });
});
