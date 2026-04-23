import { Toaster as SonnerToaster } from 'sonner';

export function AppToaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-slate-200 bg-white text-gray-900 shadow-lg dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100',
          title: 'font-semibold',
          description: 'text-sm text-gray-600 dark:text-gray-300',
        },
      }}
    />
  );
}
