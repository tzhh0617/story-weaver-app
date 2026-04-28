import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { cn } from '../../renderer/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../../renderer/components/ui/sidebar';

describe('cn', () => {
  it('merges truthy class names into a single string', () => {
    expect(cn('base', false && 'hidden', 'active')).toBe('base active');
  });
});

describe('renderer UI primitives', () => {
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
