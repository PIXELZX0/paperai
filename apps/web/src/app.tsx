import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthPage } from "./routes/auth-page.js";
import { DashboardPage } from "./routes/dashboard-page.js";

const router = createBrowserRouter([
  { path: "/", element: <AuthPage /> },
  { path: "/app", element: <DashboardPage /> },
]);

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
