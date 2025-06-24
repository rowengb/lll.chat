import React from "react";
import { SearchIcon, PanelLeftIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileMenuButtonProps {
  sidebarCollapsed: boolean;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
}

export const MobileMenuButton: React.FC<MobileMenuButtonProps> = ({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch
}) => {
  if (!sidebarCollapsed) return null;

  return (
    <div className="sm:hidden fixed z-50 block">
      <div 
        className="absolute"
        style={{
          top: '24px',
          left: '0px'
        }}
      >
        <div 
          className="bg-muted border border-border" 
          style={{ 
            borderRadius: '0 20px 20px 0',
            padding: '4px'
          }}
        >
          <div className="flex flex-col gap-1">
            <Button
              onClick={onOpenSearch}
              size="sm"
              variant="ghost"
              title="Search (Ctrl+K)"
              className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
            <Button
              onClick={onToggleSidebar}
              size="sm"
              variant="ghost"
              title="Expand Sidebar"
              className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
            >
              <PanelLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                // Instant navigation to unified chat route
                window.location.href = '/chat/new';
              }}
              size="sm"
              variant="ghost"
              title="New Chat"
              className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
            >
              <PlusIcon className="h-4.25 w-4.25" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 