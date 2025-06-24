import React from 'react';
import Head from 'next/head';
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, KeyIcon, UserIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingDots } from "@/components/LoadingDots";

interface InstantSettingsPageProps {
  activeTab: 'api-keys' | 'account';
  onNavigateToWelcome: () => void;
  onSwitchToAccountTab: () => void;
  onSwitchToApiKeysTab: () => void;
  children?: React.ReactNode;
  isDataLoading?: boolean;
}

export const InstantSettingsPage: React.FC<InstantSettingsPageProps> = ({
  activeTab,
  onNavigateToWelcome,
  onSwitchToAccountTab,
  onSwitchToApiKeysTab,
  children,
  isDataLoading = false
}) => {
  return (
    <>
      <Head>
        <title>Settings - lll.chat</title>
        <meta name="description" content="lll.chat settings - Manage your API keys and preferences" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      
      <div className="flex h-screen bg-background">
        {/* Mobile Header - visible only on mobile - INSTANT RENDER */}
        <div className="sm:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToWelcome}
                className="rounded-xl hover:bg-white dark:hover:bg-muted p-2"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            </div>
          </div>
          
          {/* Mobile Tab Navigation - INSTANT RENDER */}
          <div className="px-4 pb-3">
            <nav className="flex gap-2">
              <button
                onClick={onSwitchToAccountTab}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === 'account'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-muted'
                }`}
                style={{ borderRadius: '12px' }}
              >
                <UserIcon className="h-4 w-4" />
                Account
              </button>
              <button
                onClick={onSwitchToApiKeysTab}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === 'api-keys'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-muted'
                }`}
                style={{ borderRadius: '12px' }}
              >
                <KeyIcon className="h-4 w-4" />
                API Keys
              </button>
            </nav>
          </div>
        </div>

        {/* Desktop Sidebar - INSTANT RENDER with floating design */}
        <div className="hidden sm:flex flex-shrink-0 w-72 p-4">
          <div className="flex flex-col h-full w-full bg-gray-100 dark:bg-card border border-border shadow-lg" style={{ borderRadius: '16px' }}>
            {/* Sidebar Header - INSTANT RENDER */}
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToWelcome}
                className="rounded-xl hover:bg-white dark:hover:bg-muted p-2"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Settings</h1>
                <p className="text-xs text-muted-foreground">
                  Manage your preferences
                </p>
              </div>
            </div>

            {/* Navigation Tabs - INSTANT RENDER */}
            <div className="flex-1 p-4">
              <nav className="space-y-2">
                <button
                  onClick={onSwitchToAccountTab}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                    activeTab === 'account'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-muted'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <UserIcon className="h-4 w-4" />
                  Account
                </button>
                <button
                  onClick={onSwitchToApiKeysTab}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                    activeTab === 'api-keys'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-muted'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <KeyIcon className="h-4 w-4" />
                  API Keys
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Content loads while navigation is instant */}
          <div className="flex-1 min-h-0 pt-32 sm:pt-0">
            <div className="h-full overflow-y-auto">
              <main className="bg-background">
                <div className="px-4 sm:px-8 py-4 sm:py-8 pb-16">
                  <div className="max-w-4xl">
                    <div className="p-3 sm:p-6">
                      {/* Show loading state if data is still loading */}
                      {isDataLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <LoadingDots text="Loading settings" size="lg" />
                        </div>
                      ) : (
                        // Static content section shows immediately
                        <div className="space-y-6">
                          {activeTab === 'account' ? (
                            <div className="space-y-4">
                              {/* Account header - instant */}
                              <div>
                                <h2 className="text-lg font-medium text-foreground">Account Settings</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Manage your account settings and preferences
                                </p>
                              </div>
                              
                              {/* Theme toggle - works immediately */}
                              <div className="pt-6 border-t border-border">
                                <ThemeToggle />
                              </div>
                              
                              {/* Dynamic content loads here */}
                              {children}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* API Keys header - instant */}
                              <div>
                                <h2 className="text-lg font-medium text-foreground">API Keys</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Configure your API keys for different AI providers
                                </p>
                              </div>
                              
                              {/* Dynamic content loads here */}
                              {children}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}; 