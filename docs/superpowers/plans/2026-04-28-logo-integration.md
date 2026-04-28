# Story Weaver Logo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the provided full logo image to the app shell and package configuration without cropping the artwork.

**Architecture:** Copy the user-provided PNG into repo-local assets, render that image in the sidebar and hero card with `object-contain`, then generate padded desktop icon files from the same source for Electron window usage and `electron-builder` packaging. Validation stays lightweight: focused renderer tests plus a production build to confirm asset resolution and packaging config.

**Tech Stack:** React 19, Vite 6, Electron 33, electron-builder 25, Vitest, macOS image tools (`sips`, `iconutil`)

---

## File Structure

- Create: `renderer/assets/story-weaver-logo.png`
- Create: `build/icon.png`
- Create: `build/mac/StoryWeaver.iconset/icon_16x16.png`
- Create: `build/mac/StoryWeaver.iconset/icon_16x16@2x.png`
- Create: `build/mac/StoryWeaver.iconset/icon_32x32.png`
- Create: `build/mac/StoryWeaver.iconset/icon_32x32@2x.png`
- Create: `build/mac/StoryWeaver.iconset/icon_128x128.png`
- Create: `build/mac/StoryWeaver.iconset/icon_128x128@2x.png`
- Create: `build/mac/StoryWeaver.iconset/icon_256x256.png`
- Create: `build/mac/StoryWeaver.iconset/icon_256x256@2x.png`
- Create: `build/mac/StoryWeaver.iconset/icon_512x512.png`
- Create: `build/mac/StoryWeaver.iconset/icon_512x512@2x.png`
- Create: `build/icon.icns`
- Create: `build/icon.ico` if a clean local conversion path is available
- Create: `scripts/generate-icons.mjs`
- Modify: `renderer/components/app-sidebar.tsx`
- Modify: `renderer/App.tsx`
- Modify: `electron/main.ts`
- Modify: `electron-builder.yml`
- Modify: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/renderer-entry.test.tsx`

### Task 1: Add the Logo Asset and Cover the UI With Tests

**Files:**
- Create: `renderer/assets/story-weaver-logo.png`
- Modify: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a branding-focused test near the existing app shell coverage in `tests/renderer/app-shell.test.tsx`:

```tsx
  it('renders the provided Story Weaver logo in the sidebar and hero card', async () => {
    delete window.storyWeaver;

    render(<App />);

    const logos = await screen.findAllByAltText('Story Weaver logo');

    expect(logos).toHaveLength(2);
    expect(logos[0]).toHaveAttribute('src', expect.stringContaining('story-weaver-logo'));
    expect(logos[1]).toHaveAttribute('src', expect.stringContaining('story-weaver-logo'));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx
```

Expected: FAIL because no element with alt text `Story Weaver logo` exists yet.

- [ ] **Step 3: Copy the source asset into the repo**

Run:

```bash
mkdir -p renderer/assets
cp /Users/admin/Downloads/fd81b553-a423-4d39-8089-346fdfeb0f12.png renderer/assets/story-weaver-logo.png
```

Expected: `renderer/assets/story-weaver-logo.png` exists and remains the full uncropped image.

- [ ] **Step 4: Run test again to confirm it still fails for the right reason**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx
```

Expected: FAIL because the image file exists, but the app shell still does not render it.

- [ ] **Step 5: Commit**

```bash
git add renderer/assets/story-weaver-logo.png tests/renderer/app-shell.test.tsx
git commit -m "test: add app shell logo coverage"
```

### Task 2: Render the Full Logo in the Sidebar and Hero Card

**Files:**
- Modify: `renderer/components/app-sidebar.tsx`
- Modify: `renderer/App.tsx`
- Test: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/renderer-entry.test.tsx`

- [ ] **Step 1: Write the minimal implementation in the sidebar**

Update `renderer/components/app-sidebar.tsx` to import the asset and replace the text-only brand block with a compact image-first layout:

```tsx
import logoImage from '@/assets/story-weaver-logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export type AppView = 'library' | 'new-book' | 'settings';

const navigationItems: Array<{ label: string; view: AppView }> = [
  { label: '作品', view: 'library' },
  { label: '新建作品', view: 'new-book' },
  { label: '设置', view: 'settings' },
];

export function AppSidebar({
  currentView,
  onSelectView,
}: {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
}) {
  return (
    <Sidebar collapsible="none" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="grid gap-2 px-2 py-3">
          <img
            src={logoImage}
            alt="Story Weaver logo"
            className="h-24 w-full object-contain"
          />
          <p className="text-xs text-sidebar-foreground/70">长篇写作工作台</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    isActive={currentView === item.view}
                    onClick={() => onSelectView(item.view)}
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Write the minimal implementation in the hero card**

Update the top card in `renderer/App.tsx` to render the same asset above the existing title copy:

```tsx
import logoImage from '@/assets/story-weaver-logo.png';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
```

```tsx
          <section className="w-full rounded-lg border bg-card px-8 py-7 shadow-sm">
            <img
              src={logoImage}
              alt="Story Weaver logo"
              className="h-44 w-full object-contain object-left"
            />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Story Weaver
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              AI Long-Form Fiction Studio
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Coordinate worldbuilding, outline generation, and chapter writing from
              one desktop console.
            </p>
          </section>
```

- [ ] **Step 3: Run the focused renderer tests**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx
```

Expected: PASS, including the new logo assertions and the existing hero-heading coverage.

- [ ] **Step 4: Commit**

```bash
git add renderer/components/app-sidebar.tsx renderer/App.tsx tests/renderer/app-shell.test.tsx
git commit -m "feat: show logo in app shell"
```

### Task 3: Generate Desktop Icon Assets From the Same Full Image

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `build/icon.png`
- Create: `build/mac/StoryWeaver.iconset/*`
- Create: `build/icon.icns`
- Create: `build/icon.ico` if local conversion succeeds cleanly

- [ ] **Step 1: Add the icon generation script**

Create `scripts/generate-icons.mjs` with a reproducible shell-driven workflow:

```js
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const sourceLogo = path.join(rootDir, 'renderer/assets/story-weaver-logo.png');
const buildDir = path.join(rootDir, 'build');
const macDir = path.join(buildDir, 'mac');
const iconsetDir = path.join(macDir, 'StoryWeaver.iconset');
const paddedPng = path.join(buildDir, 'icon.png');

fs.mkdirSync(iconsetDir, { recursive: true });

execFileSync('sips', [
  '--padToHeightWidth',
  '1024',
  '1024',
  sourceLogo,
  '--out',
  paddedPng,
], { stdio: 'inherit' });

const sizes = [
  ['16', 'icon_16x16.png'],
  ['32', 'icon_16x16@2x.png'],
  ['32', 'icon_32x32.png'],
  ['64', 'icon_32x32@2x.png'],
  ['128', 'icon_128x128.png'],
  ['256', 'icon_128x128@2x.png'],
  ['256', 'icon_256x256.png'],
  ['512', 'icon_256x256@2x.png'],
  ['512', 'icon_512x512.png'],
  ['1024', 'icon_512x512@2x.png'],
];

for (const [size, fileName] of sizes) {
  execFileSync('sips', [
    '-z',
    size,
    size,
    paddedPng,
    '--out',
    path.join(iconsetDir, fileName),
  ], { stdio: 'inherit' });
}

execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(buildDir, 'icon.icns')], {
  stdio: 'inherit',
});
```

- [ ] **Step 2: Run the script and verify generated files**

Run:

```bash
node scripts/generate-icons.mjs
file build/icon.png build/icon.icns
```

Expected: `build/icon.png` is a padded PNG and `build/icon.icns` is a valid Apple icon file.

- [ ] **Step 3: Attempt Windows `.ico` generation only if a clean local tool exists**

Run:

```bash
command -v magick || command -v convert
```

Expected: If neither command exists, skip `.ico` generation and note the gap in the final implementation summary. If one exists, generate `build/icon.ico` from `build/icon.png`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-icons.mjs build/icon.png build/mac build/icon.icns build/icon.ico
git commit -m "build: add generated app icons"
```

### Task 4: Wire Electron and Packaging Config to the Generated Icons

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron-builder.yml`

- [ ] **Step 1: Set the BrowserWindow icon**

Update `electron/main.ts` so the window uses the generated PNG where supported:

```ts
import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
```

```ts
async function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'build/icon.png');
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    icon: process.platform === 'darwin' ? undefined : nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron/electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
```

- [ ] **Step 2: Point electron-builder at the new assets**

Update `electron-builder.yml`:

```yml
appId: com.storyweaver.desktop
productName: Story Weaver
files:
  - dist/**
  - dist-electron/**
  - build/icon.png
mac:
  category: public.app-category.productivity
  icon: build/icon.icns
win:
  icon: build/icon.ico
directories:
  output: release
```

If `build/icon.ico` is not available, omit the `win` block and keep the rest unchanged.

- [ ] **Step 3: Run the build**

Run:

```bash
pnpm build
```

Expected: PASS with no missing-asset errors from Vite, TypeScript, or Electron compilation.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron-builder.yml
git commit -m "build: wire app logo into electron packaging"
```

### Task 5: Final Verification

**Files:**
- Test: `tests/renderer/app-shell.test.tsx`
- Test: `tests/renderer/renderer-entry.test.tsx`

- [ ] **Step 1: Run the final focused test suite**

Run:

```bash
pnpm test -- --run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Record the generated icon inventory**

Run:

```bash
find build -maxdepth 3 \\( -name 'icon.png' -o -name 'icon.icns' -o -name 'icon.ico' -o -path '*/StoryWeaver.iconset/*' \\) | sort
```

Expected: Printed list of generated assets for the final report.

- [ ] **Step 3: Commit**

```bash
git add build
git commit -m "chore: verify logo integration assets"
```
