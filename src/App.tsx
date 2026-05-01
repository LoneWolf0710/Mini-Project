import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppShell from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import VehicleDetail from "./pages/VehicleDetail";
import MapPage from "./pages/MapPage";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import Maintenance from "./pages/Maintenance";
import Reports from "./pages/Reports";
import AdminUsers from "./pages/AdminUsers";
import AdminSimulator from "./pages/AdminSimulator";
import AdminAlertRules from "./pages/AdminAlertRules";
import IotDocs from "./pages/IotDocs";
import Predictions from "./pages/Predictions";
import Drivers from "./pages/Drivers";
import TripReplay from "./pages/TripReplay";
import Scheduler from "./pages/Scheduler";
import FuelLogs from "./pages/FuelLogs";
import RoutesPage from "./pages/Routes";
import MyVehicle from "./pages/MyVehicle";
import AdminWebhooks from "./pages/AdminWebhooks";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="map" element={<MapPage />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="vehicles/:id" element={<VehicleDetail />} />
            <Route path="predictions" element={<Predictions />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="me" element={<MyVehicle />} />
            <Route path="replay/:vehicleId" element={<TripReplay />} />
            <Route path="replay" element={<TripReplay />} />
            <Route path="analytics" element={<ProtectedRoute requireStaff><Analytics /></ProtectedRoute>} />
            <Route path="maintenance" element={<ProtectedRoute requireStaff><Maintenance /></ProtectedRoute>} />
            <Route path="scheduler" element={<ProtectedRoute requireStaff><Scheduler /></ProtectedRoute>} />
            <Route path="fuel" element={<ProtectedRoute requireStaff><FuelLogs /></ProtectedRoute>} />
            <Route path="routes" element={<ProtectedRoute requireStaff><RoutesPage /></ProtectedRoute>} />
            <Route path="drivers" element={<ProtectedRoute requireStaff><Drivers /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute requireStaff><Reports /></ProtectedRoute>} />
            <Route path="admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="admin/rules" element={<ProtectedRoute requireAdmin><AdminAlertRules /></ProtectedRoute>} />
            <Route path="admin/simulator" element={<ProtectedRoute requireAdmin><AdminSimulator /></ProtectedRoute>} />
            <Route path="admin/webhooks" element={<ProtectedRoute requireAdmin><AdminWebhooks /></ProtectedRoute>} />
            <Route path="docs/iot" element={<IotDocs />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
