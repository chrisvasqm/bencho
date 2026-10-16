import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { App } from './App.tsx';
import { useTheme } from './features/theme/theme.ts';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

// Sonner reads these to match the Bencho tokens in light and dark.
const toasterStyle = {
  '--normal-bg': 'var(--surface)',
  '--normal-text': 'var(--fg)',
  '--normal-border': 'var(--line)',
  '--success-bg': 'var(--success-soft)',
  '--success-text': 'var(--success)',
  '--success-border': 'var(--line)',
  '--error-bg': 'var(--danger-soft)',
  '--error-text': 'var(--danger)',
  '--error-border': 'var(--line)',
  '--warning-bg': 'var(--warning-soft)',
  '--warning-text': 'var(--warning)',
  '--warning-border': 'var(--line)',
  '--info-bg': 'var(--accent-soft)',
  '--info-text': 'var(--accent-strong)',
  '--info-border': 'var(--line)',
  fontFamily: 'var(--font-sans)',
} as CSSProperties;

function Root() {
  const [theme] = useTheme();
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="bottom-center"
          theme={theme}
          richColors
          closeButton
          style={toasterStyle}
        />
      </QueryClientProvider>
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
