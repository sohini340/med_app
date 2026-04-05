import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';

export const ThemeToggle = () => {
  const { isDark, toggle } = useThemeStore();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full">
      {isDark ? <Sun className="h-5 w-5 text-warning" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
};
