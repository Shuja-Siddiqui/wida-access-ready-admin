import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminDistricts from "@/pages/admin-districts";
import AdminUsers from "@/pages/admin-users";
import AdminSubscriptions from "@/pages/admin-subscriptions";
import AdminPricing from "@/pages/admin-pricing";
import AdminRateLimit from "@/pages/admin-rate-limit";
import AdminDistrictDetail from "@/pages/admin-district-detail";
import AdminLibrary from "@/pages/admin-library";
import AdminThemes  from "@/pages/admin-themes";
import AdminImageFactory from "@/pages/admin-image-factory";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={AdminLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/" component={AdminDashboard} />
      <Route path="/districts/:districtId" component={AdminDistrictDetail} />
      <Route path="/districts" component={AdminDistricts} />
      <Route path="/users" component={AdminUsers} />
      <Route path="/subscriptions" component={AdminSubscriptions} />
      <Route path="/pricing" component={AdminPricing} />
      <Route path="/rate-limit" component={AdminRateLimit} />
      <Route path="/library" component={AdminLibrary} />
      <Route path="/library/catalog" component={AdminThemes} />
      <Route path="/images/factory" component={AdminImageFactory} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
