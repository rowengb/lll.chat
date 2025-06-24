import React from "react";
import { examplePrompts } from "../../constants/welcomePrompts";
import { sharedLayoutClasses, sharedGridClasses, chatboxLayoutClasses, chatboxGridClasses } from "../../constants/chatLayout";
import { ApiKeyWarningBanner } from "../ApiKeyWarningBanner";
import { MobileMenuButton } from "./MobileMenuButton";
import { Chatbox } from "../Chatbox";
import { UploadedFile } from "../FileUpload";
import { smartFocus } from "../../utils/chatHelpers";

interface WelcomeScreenProps {
  // Layout props
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
  
  // Banner props
  shouldShowBanner: boolean;
  shouldShakeBanner: boolean;
  onNavigateToSettings: () => void;
  
  // Input props
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  
  // Model props
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  
  // Search grounding props
  searchGroundingEnabled: boolean;
  onSearchGroundingChange: (enabled: boolean) => void;
  onModelSelectorClick: () => void;
  onTextareaFocus?: () => void;
  onTextareaBlur?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  sidebarCollapsed,
  sidebarWidth,
  onToggleSidebar,
  onOpenSearch,
  shouldShowBanner,
  shouldShakeBanner,
  onNavigateToSettings,
  input,
  onInputChange,
  onSubmit,
  uploadedFiles,
  onFilesChange,
  selectedModel,
  onModelChange,
  isLoading,
  isStreaming,
  onStop,
  inputRef,
  searchGroundingEnabled,
  onSearchGroundingChange,
  onModelSelectorClick,
  onTextareaFocus,
  onTextareaBlur
}) => {
  // T3.chat style: Show welcome elements dynamically based on input content
  const showWelcomeElements = input.trim() === "";

  const handleExampleClick = (prompt: string) => {
    onInputChange(prompt);
    smartFocus(inputRef, { reason: 'example-click' });
  };

  return (
    <div 
      className="sm:fixed sm:top-0 sm:right-0 sm:bottom-0 mobile-simple-container sm:min-h-screen-mobile flex flex-col bg-white dark:bg-slate-900 sm:left-auto"
      style={{ 
        left: window.innerWidth >= 640 ? (sidebarCollapsed ? '0px' : `${sidebarWidth}px`) : '0px',
        transition: window.innerWidth >= 640 ? 'left 0.3s ease-out' : 'none'
      }}
    >
      {/* API Key Warning Banner */}
      {shouldShowBanner && (
        <ApiKeyWarningBanner
          onNavigateToSettings={onNavigateToSettings}
          isDismissible={false}
          shouldShake={shouldShakeBanner}
        />
      )}
      
      {/* Mobile Menu Button */}
      <MobileMenuButton 
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
        onOpenSearch={onOpenSearch}
      />

      {/* Welcome Content Area with natural scrolling */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto">
          <div className={`${sharedGridClasses} min-h-full flex items-center justify-center pb-24 sm:pb-32`}>
            <div></div>
            <div className="w-full">
              <div className={sharedLayoutClasses}>
                {/* Welcome elements that hide/show based on input - T3.chat style */}
                <div className={`text-center transition-all duration-300 ${showWelcomeElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                  {/* Welcome Header */}
                  <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-normal text-foreground mb-3 sm:mb-4">
                      Welcome to <span className="font-bold">lll</span><span className="font-normal">.chat</span>
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
                      Start a conversation with AI. Choose from the examples below or type your own message.
                    </p>
                  </div>

                  {/* Example Prompts Carousel */}
                  <div className="mb-6 sm:mb-8">
                    {/* Desktop: Grid layout */}
                    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {examplePrompts.map((example, index) => {
                        const IconComponent = example.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => handleExampleClick(example.prompt)}
                              className="group text-left p-3 bg-gradient-to-br from-card/80 to-muted/60 dark:from-slate-800/80 dark:to-slate-700/60 backdrop-blur-sm hover:from-muted/90 hover:to-muted/70 dark:hover:from-slate-700/90 dark:hover:to-slate-600/70 rounded-2xl border border-border/60 hover:border-border/80 shadow-lg shadow-muted/20 hover:shadow-xl hover:shadow-muted/30 transition-all duration-300 hover:-translate-y-1 backdrop-saturate-150"
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                                <IconComponent className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-medium text-foreground mb-2 group-hover:text-primary transition-colors">
                                  {example.title}
                                </h3>
                                <p className="text-sm text-muted-foreground group-hover:text-foreground line-clamp-3 transition-colors">
                                  {example.prompt}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Mobile: Horizontal scrolling carousel */}
                    <div className="md:hidden relative">
                      <div className="overflow-x-auto scrollbar-hide w-screen relative" style={{ left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
                        <div className="flex gap-4 pb-2 pl-4 pr-4" style={{ width: 'max-content' }}>
                          {examplePrompts.map((example, index) => {
                            const IconComponent = example.icon;
                            return (
                              <button
                                key={index}
                                onClick={() => handleExampleClick(example.prompt)}
                                className="group text-left p-3 bg-gradient-to-br from-card/80 to-muted/60 dark:from-slate-800/80 dark:to-slate-700/60 backdrop-blur-sm hover:from-muted/90 hover:to-muted/70 dark:hover:from-slate-700/90 dark:hover:to-slate-600/70 rounded-2xl border border-border/60 hover:border-border/80 shadow-lg shadow-muted/20 hover:shadow-xl hover:shadow-muted/30 transition-all duration-300 hover:-translate-y-1 backdrop-saturate-150"
                                style={{ width: '240px', flexShrink: 0 }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                                    <IconComponent className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-medium text-foreground mb-2 group-hover:text-primary transition-colors">
                                      {example.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground group-hover:text-foreground line-clamp-3 transition-colors">
                                      {example.prompt}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Left fade gradient */}
                      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none z-10" style={{ left: '50%', marginLeft: '-50vw' }}></div>
                      
                      {/* Right fade gradient */}
                      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-10" style={{ right: '50%', marginRight: '-50vw' }}></div>
                    </div>
                  </div>


                </div>
              </div>
            </div>
            <div></div>
          </div>
        </div>
        
        {/* Chatbox - Using shared component with floating margins */}
        <div className="fixed sm:absolute bottom-5 left-0 z-20 right-4 sm:left-0 sm:right-4">
          <div className="px-3 sm:hidden">
            {/* Mobile: Center middle chatbox */}
            <div className="max-w-[85%] w-full mx-auto">
              <Chatbox
                input={input}
                onInputChange={onInputChange}
                onSubmit={onSubmit}
                uploadedFiles={uploadedFiles}
                onFilesChange={onFilesChange}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onStop={onStop}
                inputRef={inputRef}
                searchGroundingEnabled={searchGroundingEnabled}
                onSearchGroundingChange={onSearchGroundingChange}
                onModelSelectorClick={onModelSelectorClick}
                onTextareaFocus={onTextareaFocus}
                onTextareaBlur={onTextareaBlur}
              />
            </div>
          </div>
          <div className={`hidden sm:block ${chatboxGridClasses}`} style={{ paddingLeft: '16px' }}>
            {/* Desktop: Original layout */}
            <div></div>
            <div className="w-full">
              <div className={chatboxLayoutClasses}>
                <Chatbox
                  input={input}
                  onInputChange={onInputChange}
                  onSubmit={onSubmit}
                  uploadedFiles={uploadedFiles}
                  onFilesChange={onFilesChange}
                  selectedModel={selectedModel}
                  onModelChange={onModelChange}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  onStop={onStop}
                  inputRef={inputRef}
                  searchGroundingEnabled={searchGroundingEnabled}
                  onSearchGroundingChange={onSearchGroundingChange}
                  onModelSelectorClick={onModelSelectorClick}
                  onTextareaFocus={onTextareaFocus}
                  onTextareaBlur={onTextareaBlur}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 