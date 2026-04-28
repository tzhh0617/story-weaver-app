import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rendererRoot = path.resolve(__dirname, '../../renderer');
const projectRoot = path.resolve(rendererRoot, '..');
const arbitraryPixelMaxWidthPattern = /max-w-\[\d+px\]/;

function listRendererSourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listRendererSourceFiles(resolvedPath);
    }

    if (!/\.(ts|tsx|css)$/.test(entry.name)) {
      return [];
    }

    return [resolvedPath];
  });
}

describe('renderer layout constraints', () => {
  it('does not cap renderer layouts with arbitrary pixel max widths', () => {
    const offenders = listRendererSourceFiles(rendererRoot).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');

      return arbitraryPixelMaxWidthPattern.test(source)
        ? [path.relative(rendererRoot, filePath)]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it('keeps the app shell page gutter consistent across viewport sizes', () => {
    const appSource = fs.readFileSync(path.join(rendererRoot, 'App.tsx'), 'utf8');

    expect(appSource).not.toMatch(/\b(?:sm|md|lg|xl|2xl):px-/);
    expect(appSource).not.toContain('max-w-screen-2xl');
    expect(appSource).not.toContain('mx-auto grid w-full');
  });

  it('applies the paper grid background to the whole app shell', () => {
    const appSource = fs.readFileSync(path.join(rendererRoot, 'App.tsx'), 'utf8');
    const cssSource = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');

    expect(cssSource).toContain('.app-paper-background');
    expect(appSource.match(/app-paper-background/g)).toHaveLength(2);
  });

  it('uses a fixed viewport shell with right-side internal scrolling', () => {
    const appSource = fs.readFileSync(path.join(rendererRoot, 'App.tsx'), 'utf8');
    const sidebarSource = fs.readFileSync(
      path.join(rendererRoot, 'components/app-sidebar.tsx'),
      'utf8'
    );

    expect(appSource).toContain('h-svh overflow-hidden');
    expect(appSource).toContain('min-w-0 flex-1 overflow-hidden');
    expect(appSource).toContain('h-svh overflow-y-auto');
    expect(appSource).not.toContain('min-h-screen w-full p-5');
    expect(sidebarSource).toContain('h-svh shrink-0');
  });

  it('uses explicit var() syntax for sidebar width utilities', () => {
    const sidebarSource = fs.readFileSync(
      path.join(rendererRoot, 'components/ui/sidebar.tsx'),
      'utf8'
    );

    expect(sidebarSource).not.toContain('w-[--sidebar-width]');
    expect(sidebarSource).not.toContain('w-[--sidebar-width-icon]');
    expect(sidebarSource).toContain('w-[var(--sidebar-width)]');
    expect(sidebarSource).toContain('w-[var(--sidebar-width-icon)]');
  });

  it('lets the app background fill the hidden desktop titlebar area', () => {
    const appSource = fs.readFileSync(path.join(rendererRoot, 'App.tsx'), 'utf8');
    const cssSource = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
    const electronMainSource = fs.readFileSync(
      path.join(projectRoot, 'electron/main.ts'),
      'utf8'
    );

    expect(electronMainSource).toContain("titleBarStyle: 'hiddenInset'");
    expect(electronMainSource).toContain('trafficLightPosition');
    expect(electronMainSource).toContain("backgroundColor: '#efe6d5'");
    expect(appSource).toContain('app-titlebar-drag-region');
    expect(appSource).toContain('app-content-scrollport');
    expect(cssSource).toContain('.app-titlebar-drag-region');
    expect(cssSource).toContain('-webkit-app-region: drag');
    expect(cssSource).toContain('--app-titlebar-height');
  });

  it('keeps the hidden titlebar fill visually transparent outside the sidebar', () => {
    const cssSource = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
    const titlebarRule =
      cssSource.match(/\.app-titlebar-drag-region \{[\s\S]*?\n  \}/)?.[0] ?? '';

    expect(titlebarRule).toContain('background-color: transparent');
    expect(titlebarRule).toContain('var(--sidebar) 0 var(--sidebar-width)');
    expect(titlebarRule).not.toContain('box-shadow');
    expect(titlebarRule).not.toContain('var(--paper-background-image)');
    expect(titlebarRule).not.toContain('background-attachment');
  });

  it('defines the shared shadcn theme tokens used by overlay and form primitives', () => {
    const cssSource = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
    const tailwindSource = fs.readFileSync(
      path.resolve(rendererRoot, '../tailwind.config.ts'),
      'utf8'
    );

    expect(cssSource).toContain('--popover:');
    expect(cssSource).toContain('--popover-foreground:');
    expect(cssSource).toContain('--secondary:');
    expect(cssSource).toContain('--secondary-foreground:');
    expect(cssSource).toContain('--destructive-foreground:');
    expect(cssSource).toContain('--input:');
    expect(cssSource).toContain('--ring:');

    expect(tailwindSource).toContain("popover: 'hsl(var(--popover))'");
    expect(tailwindSource).toContain("'popover-foreground': 'hsl(var(--popover-foreground))'");
    expect(tailwindSource).toContain("secondary: 'hsl(var(--secondary))'");
    expect(tailwindSource).toContain(
      "'secondary-foreground': 'hsl(var(--secondary-foreground))'"
    );
    expect(tailwindSource).toContain(
      "'destructive-foreground': 'hsl(var(--destructive-foreground))'"
    );
    expect(tailwindSource).toContain("input: 'hsl(var(--input))'");
    expect(tailwindSource).toContain("ring: 'hsl(var(--ring))'");
  });

  it('routes layout containers through the shared layout-card contract', () => {
    const cardSource = fs.readFileSync(
      path.join(rendererRoot, 'components/ui/card.tsx'),
      'utf8'
    );
    const settingsSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/Settings.tsx'),
      'utf8'
    );
    const newBookSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/NewBook.tsx'),
      'utf8'
    );
    const bookDetailSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/BookDetail.tsx'),
      'utf8'
    );
    const modelFormSource = fs.readFileSync(
      path.join(rendererRoot, 'components/ModelForm.tsx'),
      'utf8'
    );

    expect(cardSource).toContain('export const layoutCardClassName');
    expect(cardSource).toContain('export const layoutCardHeaderClassName');
    expect(cardSource).toContain('export const layoutCardSectionClassName');
    expect(settingsSource).toContain('layoutCardClassName');
    expect(settingsSource).toContain('layoutCardHeaderClassName');
    expect(newBookSource).toContain('layoutCardClassName');
    expect(newBookSource).toContain('layoutCardHeaderClassName');
    expect(bookDetailSource).toContain('layoutCardClassName');
    expect(bookDetailSource).toContain('layoutCardSectionClassName');
    expect(modelFormSource).toContain('layoutCardClassName');
  });

  it('routes page titles through the shared intro panel contract', () => {
    const cardSource = fs.readFileSync(
      path.join(rendererRoot, 'components/ui/card.tsx'),
      'utf8'
    );
    const librarySource = fs.readFileSync(
      path.join(rendererRoot, 'pages/Library.tsx'),
      'utf8'
    );
    const settingsSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/Settings.tsx'),
      'utf8'
    );
    const newBookSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/NewBook.tsx'),
      'utf8'
    );
    const bookDetailSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/BookDetail.tsx'),
      'utf8'
    );

    expect(cardSource).toContain('export const pageIntroPanelClassName');
    expect(cardSource).toContain('export const pageIntroEyebrowClassName');
    expect(cardSource).toContain('export const pageIntroTitleClassName');
    expect(cardSource).toContain('export const pageIntroDescriptionClassName');
    expect(librarySource).toContain('pageIntroPanelClassName');
    expect(settingsSource).toContain('pageIntroPanelClassName');
    expect(newBookSource).toContain('pageIntroPanelClassName');
    expect(bookDetailSource).toContain('pageIntroPanelClassName');
  });

  it('does not clamp the new-book workspace to a centered max width', () => {
    const newBookSource = fs.readFileSync(
      path.join(rendererRoot, 'pages/NewBook.tsx'),
      'utf8'
    );

    expect(newBookSource).not.toContain('max-w-screen-lg');
    expect(newBookSource).not.toContain('mx-auto');
  });
});
