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
          <p className="text-xs text-sidebar-foreground/70">
            长篇写作工作台
          </p>
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
