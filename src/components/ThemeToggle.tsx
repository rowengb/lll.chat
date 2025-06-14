import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themes = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'system', label: 'System', icon: MonitorIcon },
  ] as const;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Theme</h3>
        <p className="text-xs text-muted-foreground">
          Choose your preferred theme or follow your system setting
        </p>
      </div>
      
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        {themes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              theme === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      
      <div className="text-xs text-muted-foreground">
        Current: {resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode
      </div>
    </div>
  );
} 