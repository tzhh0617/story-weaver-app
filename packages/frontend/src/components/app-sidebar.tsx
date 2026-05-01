import logoImage from '@/assets/story-weaver-logo-white.png';
import { BookOpen, ScrollText, Settings2, type LucideIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export type AppView = 'library' | 'book-detail' | 'new-book' | 'logs' | 'settings';

const navigationItems: Array<{
  label: string;
  view: Exclude<AppView, 'book-detail' | 'new-book'>;
  Icon: LucideIcon;
}> = [
  { label: '作品', view: 'library', Icon: BookOpen },
  { label: '写作动态', view: 'logs', Icon: ScrollText },
  { label: '设置', view: 'settings', Icon: Settings2 },
];

export function AppSidebar({
  currentView,
  onSelectView,
}: {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
}) {
  const isLibraryView =
    currentView === 'library' ||
    currentView === 'book-detail' ||
    currentView === 'new-book';

  return (
    <Sidebar
      collapsible="none"
      className="relative h-svh shrink-0 border-r border-sidebar-border bg-[linear-gradient(90deg,hsl(32_24%_13%/0.36)_1px,transparent_1px),linear-gradient(180deg,hsl(35_30%_22%),hsl(31_34%_13%))] bg-[length:18px_18px,auto] pt-[var(--app-titlebar-height)] shadow-[inset_-1px_0_0_hsl(42_38%_91%/0.08),inset_0_1px_0_hsl(42_38%_91%/0.06)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-sidebar-primary/55 to-transparent"
      />
      <SidebarHeader className="border-b border-sidebar-border/70 p-3 pb-3.5">
        <div
          role="group"
          aria-label="Story Weaver brand"
          className="relative overflow-hidden rounded-lg border border-sidebar-primary/35 bg-[linear-gradient(180deg,hsl(42_46%_88%),hsl(38_38%_79%))] px-3 py-3 text-center text-sidebar-primary-foreground shadow-[0_14px_30px_hsl(28_30%_8%/0.2),inset_0_1px_0_hsl(42_52%_97%/0.58)]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-2 rounded-md border border-[hsl(28_34%_16%/0.16)]"
          />
          <div
            aria-hidden="true"
            className="absolute left-4 right-4 top-3 h-px bg-[linear-gradient(90deg,transparent,hsl(28_34%_16%/0.28),transparent)]"
          />
          <div className="relative mx-auto grid size-14 place-items-center rounded-md border border-[hsl(42_54%_82%/0.2)] bg-[linear-gradient(145deg,hsl(30_34%_14%),hsl(35_28%_22%))] shadow-[inset_0_1px_0_hsl(42_38%_91%/0.12)]">
            <img
              src={logoImage}
              alt="Story Weaver logo"
              className="h-11 w-11 object-contain drop-shadow-[0_8px_16px_hsl(28_30%_8%/0.28)]"
            />
          </div>
          <div className="relative mt-2.5 space-y-0.5">
            <p className="font-serif text-[0.95rem] font-semibold leading-5 text-[hsl(28_34%_16%)]">
              Story Weaver
            </p>
            <p className="text-[0.68rem] font-medium leading-4 text-[hsl(28_34%_16%/0.68)]">
              藏书工坊
            </p>
          </div>
          <div
            aria-hidden="true"
            className="absolute bottom-3 left-4 right-4 h-px bg-[linear-gradient(90deg,transparent,hsl(28_34%_16%/0.24),transparent)]"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarGroup className="rounded-lg border border-sidebar-foreground/10 bg-[hsl(31_30%_16%/0.72)] p-1.5 shadow-[inset_0_1px_0_hsl(42_38%_91%/0.06),0_16px_32px_hsl(28_30%_8%/0.12)]">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigationItems.map((item) => {
                const isActive =
                  item.view === 'library'
                    ? isLibraryView
                    : currentView === item.view;

                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      aria-label={item.label}
                      isActive={isActive}
                      className={cn(
                        'group/nav relative h-11 rounded-md border border-transparent px-2 text-sm font-medium text-sidebar-foreground/72 transition-all duration-200 hover:border-sidebar-foreground/12 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground',
                        'data-[active=true]:border-sidebar-primary/40 data-[active=true]:bg-[linear-gradient(180deg,hsl(42_50%_86%),hsl(38_42%_77%))] data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[0_10px_22px_hsl(28_30%_8%/0.18),inset_0_1px_0_hsl(42_52%_97%/0.46)]'
                      )}
                      onClick={() => onSelectView(item.view)}
                    >
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[hsl(23_48%_34%)]"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid size-7 place-items-center rounded-md border border-sidebar-foreground/10 bg-sidebar-foreground/5 text-sidebar-foreground/62 transition-colors',
                          isActive &&
                            'border-sidebar-primary-foreground/20 bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground'
                        )}
                      >
                        <item.Icon className="size-4" />
                      </span>
                      <span className="truncate">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
