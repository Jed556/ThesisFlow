import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './App';
import ErrorBoundary from './layouts/ErrorBoundary';
import { buildRoutes } from './utils/navBuilder';
import { attachDevUtilsToWindow, setCurrentRoutes, setCurrentRouter } from './utils/devUtils';
import { SpeedInsights } from '@vercel/speed-insights/react';

attachDevUtilsToWindow(); // Attach dev utilities to window for console access

function AppWithRouter() {
    const [router, setRouter] = React.useState<ReturnType<typeof createBrowserRouter> | null>(null);

    React.useEffect(() => {
        async function initializeRouter() {
            try {
                const routes = await buildRoutes();

                // Store routes for dev utils
                setCurrentRoutes(routes);

                const createdRouter = createBrowserRouter([
                    {
                        path: '/',
                        Component: App,
                        errorElement: <ErrorBoundary />,
                        children: routes,
                    },
                ]);

                // Store router for dev utils
                setCurrentRouter(createdRouter);
                setRouter(createdRouter);
            } catch (error) {
                console.error('Failed to build routes:', error);
            }
        }

        initializeRouter();
    }, []);

    if (!router) {
        return <></>;
    }

    return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <SpeedInsights />
        <AppWithRouter />
    </React.StrictMode>,
);
