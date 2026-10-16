import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/index.css';

/** Applies the theme toolbar choice the same way the app does: data-theme on <html>. */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as string;
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return (
    <div className="min-h-screen bg-canvas p-6 text-fg">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'system' },
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
};

export default preview;
