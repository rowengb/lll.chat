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
import { getProviderIcon } from '@/components/ModelSelector';

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
    const [type, ...rest] = value.split(':');
    const fullId = rest.join(':'); // Rejoin in case there are colons in the ID
    
    switch (type) {
      case 'thread':
        // Extract just the thread ID (first part before the space)
        const threadId = fullId.split(' ')[0];
        if (threadId) {
          onThreadSelect(threadId);
        }
        break;
      case 'model':
        // For models, extract just the model ID (first part before the space)
        const modelId = fullId.split(' ')[0];
        if (modelId && onModelChange) {
          onModelChange(modelId);
        }
        break;
      case 'action':
        switch (fullId) {
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
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl mx-3 sm:mx-4 md:mx-6 transition-all duration-150 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <Command 
          className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
          shouldFilter={true}
          value={search}
          onValueChange={setSearch}
        >
          <div className="flex items-center border-b border-border px-3 sm:px-4 md:px-6">
            <SearchIcon className="h-5 w-5 text-muted-foreground mr-2 sm:mr-3" />
            <Command.Input
              placeholder="Search threads, models, or actions..."
              className="flex-1 bg-transparent border-0 py-3 sm:py-4 text-sm sm:text-base placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              autoFocus
            />
            <div className="text-xs text-muted-foreground ml-2 sm:ml-3 hidden sm:block">
              ESC to close
            </div>
          </div>

          <Command.List className="max-h-72 sm:max-h-96 md:max-h-[28rem] overflow-y-auto p-2 sm:p-3">
            <Command.Empty className="py-8 text-center text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide">
              <Command.Item
                value="action:new-chat"
                onSelect={handleSelect}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
              >
                <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-primary/10">
                  <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">New Chat</div>
                  <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Start a new conversation</div>
                </div>
              </Command.Item>

              <Command.Item
                value="action:settings"
                onSelect={handleSelect}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
              >
                <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-muted">
                  <SettingsIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Settings</div>
                  <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Configure API keys and preferences</div>
                </div>
              </Command.Item>

              <Command.Item
                value="action:account"
                onSelect={handleSelect}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
              >
                <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-muted">
                  <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Account</div>
                  <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your account settings</div>
                </div>
              </Command.Item>
            </Command.Group>

            {/* Recent Threads */}
            {threads.length > 0 && (
              <Command.Group heading="Conversations" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide">
                {threads
                  .map(thread => {
                    const threadModel = (thread as any).model || 'Unknown';
                    const threadTitle = thread.title || `${threadModel} conversation`;
                    const searchValue = `thread:${thread.id} ${threadTitle} ${threadModel} conversation chat thread`;
                    return (
                    <Command.Item
                      key={thread.id}
                      value={searchValue}
                      onSelect={handleSelect}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
                    >
                      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-muted">
                        {(thread as any).pinned ? (
                          <PinIcon className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                        ) : (
                          <MessageSquareIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base truncate">
                          {thread.title || `${thread.model || 'Unknown'} conversation`}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                          <span>{thread.model || 'Unknown'}</span>
                          <span>•</span>
                          <span>{formatDate((thread as any)._creationTime)}</span>
                        </div>
                      </div>
                      {thread.id === currentThreadId && (
                        <div className="text-xs text-primary font-medium">Current</div>
                      )}
                    </Command.Item>
                  );
                  })}
              </Command.Group>
            )}

            {/* Models */}
            {onModelChange && allModels.length > 0 && (
              <Command.Group heading="Models" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide">
                {allModels
                  .map(model => (
                    <Command.Item
                      key={model.id}
                      value={`model:${model.id} ${model.name} ${model.provider} ${model.description || ''} ai model llm`}
                      onSelect={handleSelect}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-muted/50 data-[selected=true]:bg-muted"
                    >
                      <div className="relative flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-muted">
                        <div className="text-sm sm:text-base">
                          {getProviderIcon(model.provider || 'openai', model.name, 'sm')}
                        </div>
                        {favoriteModels.some(fav => fav.id === model.id) && (
                          <StarIcon className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-500 bg-background rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base">{model.name}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">{model.provider}</div>
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