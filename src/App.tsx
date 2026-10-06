import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./context/AuthContext";
import { AuthGuard } from "./components/AuthGuard";
import { RoleGuard } from "./components/RoleGuard";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import NotFound from "./pages/NotFound.tsx";
import DesignSystem from "./pages/DesignSystem.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import ParentDashboard from "./pages/ParentDashboard.tsx";
import TeacherDashboard from "./pages/TeacherDashboard.tsx";
import OralReadingPage from "./pages/OralReading.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/design-system" element={<DesignSystem />} />
            
            <Route element={<AuthGuard />}>
              <Route path="/" element={<Index />} />
              <Route path="/oral-reading" element={<OralReadingPage />} />
              
              {/* Role-Protected Routes */}
              <Route element={<RoleGuard allowedRoles={['STUDENT']} />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/oral-reading" element={<OralReadingPage />} />
                <Route path="/student/*" element={<StudentDashboard />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={['PARENT']} />}>
                <Route path="/parent/dashboard" element={<ParentDashboard />} />
                <Route path="/parent/*" element={<ParentDashboard />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={['TEACHER']} />}>
                <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="/teacher/*" element={<TeacherDashboard />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
