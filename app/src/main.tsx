import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import LinearProgress from '@mui/material/LinearProgress';
import App from './App';
import ErrorBoundary from './layouts/ErrorBoundary';
import { buildRoutes } from './utils/navBuilder';

// Create a component to handle async router creation
function AppWithRouter() {
  const [router, setRouter] = React.useState<ReturnType<typeof createBrowserRouter> | null>(null);

  React.useEffect(() => {
    async function initializeRouter() {
      try {
        const routes = await buildRoutes();
        if (process.env.NODE_ENV === 'development') {
          console.log('Built routes:', routes); // Debug log
        }
        const createdRouter = createBrowserRouter([
          {
            path: '/',
            Component: App,
            errorElement: <ErrorBoundary />,
            children: routes,
          },
        ]);
        setRouter(createdRouter);
      } catch (error) {
        console.error('Failed to build routes:', error);
      }
    }

    initializeRouter();
  }, []);

  if (!router) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LinearProgress style={{ width: '50%' }} />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithRouter />
  </React.StrictMode>,
);
