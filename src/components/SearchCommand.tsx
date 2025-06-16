import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { 
  SearchIcon, 
  MessageSquareIcon, 
  BotIcon, 
  SettingsIcon, 
  PlusIcon,
  StarIcon,
  UserIcon,
  PinIcon
} from 'lucide-react';
import { trpc } from '@/utils/trpc';

interface SearchCommandProps {
  isOpen: boolean;
  onClose: () => void;
  onThreadSelect: (threadId: string) => void;
  onNewChat: () => void;
  onNavigateToSettings: () => void;
  onNavigateToAccount: () => void;
  onModelChange?: (modelId: string) => void;
  currentThreadId?: string | null;
}

export const SearchCommand: React.FC<SearchCommandProps> = ({
  isOpen,
  onClose,
  onThreadSelect,
  onNewChat,
  onNavigateToSettings,
  onNavigateToAccount,
  onModelChange,
  currentThreadId
}) => {
  const [search, setSearch] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Fetch data
  const { data: threads = [] } = trpc.chat.getThreads.useQuery();
  const { data: allModels = [] } = trpc.models.getModels.useQuery();
  const { data: favoriteModels = [] } = trpc.models.getFavoriteModels.useQuery();

  // Handle modal visibility with animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready before starting animation
      const timer = setTimeout(() => setIsVisible(true), 5);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setShouldRender(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const handleSelect = (value: string) => {
    const [type, id] = value.split(':');
    
    switch (type) {
      case 'thread':
        onThreadSelect(id);
        break;
      case 'model':
        onModelChange?.(id);
        break;
      case 'action':
        switch (id) {
          case 'new-chat':
            onNewChat();
            break;
          case 'settings':
            onNavigateToSettings();
            break;
          case 'account':
            onNavigateToAccount();
            break;
        }
        break;
    }
    
    onClose();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 backdrop-blur-md transition-opacity duration-150 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl mx-4 transition-all duration-150 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <Command 
          className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
          shouldFilter={false}
        >
          <div className="flex items-center border-b border-border px-4">
            <SearchIcon className="h-5 w-5 text-muted-foreground mr-3" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search threads, models, or actions..."
              className="flex-1 bg-transparent border-0 py-4 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              autoFocus
            />
            <div className="text-xs text-muted-foreground ml-3">
              ESC to close
            </div>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Actions">
              <Command.Item
                value="action:new-chat"
                onSelect={handleSelect}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <PlusIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">New Chat</div>
                  <div className="text-sm text-muted-foreground">Start a new conversation</div>
                </div>
              </Command.Item>

              <Command.Item
                value="action:settings"
                onSelect={handleSelect}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                  <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Settings</div>
                  <div className="text-sm text-muted-foreground">Configure API keys and preferences</div>
                </div>
              </Command.Item>

              <Command.Item
                value="action:account"
                onSelect={handleSelect}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Account</div>
                  <div className="text-sm text-muted-foreground">Manage your account settings</div>
                </div>
              </Command.Item>
            </Command.Group>

            {/* Recent Threads */}
            {threads.length > 0 && (
              <Command.Group heading="Recent Threads">
                {threads
                  .filter(thread => 
                    !search || 
                    (thread.title && thread.title.toLowerCase().includes(search.toLowerCase())) ||
                    (thread.model && thread.model.toLowerCase().includes(search.toLowerCase()))
                  )
                  .slice(0, 8)
                  .map(thread => (
                    <Command.Item
                      key={thread.id}
                      value={`thread:${thread.id}`}
                      onSelect={handleSelect}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                        {(thread as any).pinned ? (
                          <PinIcon className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {thread.title || `${thread.model || 'Unknown'} conversation`}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{thread.model || 'Unknown'}</span>
                          <span>•</span>
                          <span>{formatDate((thread as any)._creationTime)}</span>
                        </div>
                      </div>
                      {thread.id === currentThreadId && (
                        <div className="text-xs text-primary font-medium">Current</div>
                      )}
                    </Command.Item>
                  ))}
              </Command.Group>
            )}

            {/* Models */}
            {onModelChange && allModels.length > 0 && (
              <Command.Group heading="Models">
                {allModels
                  .filter(model => 
                    !search || 
                    (model.name && model.name.toLowerCase().includes(search.toLowerCase())) ||
                    (model.provider && model.provider.toLowerCase().includes(search.toLowerCase()))
                  )
                  .slice(0, 6)
                  .map(model => (
                    <Command.Item
                      key={model.id}
                      value={`model:${model.id}`}
                      onSelect={handleSelect}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                        {favoriteModels.some(fav => fav.id === model.id) ? (
                          <StarIcon className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <BotIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-muted-foreground">{model.provider}</div>
                      </div>
                    </Command.Item>
                  ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}; 