import { axiosInstance } from './authService';
import {
  StudentDashboardResponse,
  ParentDashboardResponse,
  TeacherDashboardResponse,
  LinkCodeResponse,
  MLResultPayload,
} from './types';

// ============ STUDENT TYPES ============

export interface StudentSession {
  sessionId: string;
  taskId: string;
  timestamp: number;
  durationMs: number;
  frameCount: number;
  status: 'COMPLETED' | 'IN_PROGRESS';
  riskClassification?: 'LOW' | 'MODERATE' | 'HIGH';
  riskScore?: number;
}

export interface LearningModule {
  moduleId: string;
  title: string;
  description: string;
  category: 'Phonical Awareness' | 'Saccade Training' | 'Word Recognition' | 'Reading Pace';
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: number;
}

export interface StudentLearningPlan {
  planId: string;
  title: string;
  description: string;
  progressPercentage: number;
  modules: LearningModule[];
}

// ============ PARENT TYPES ============

export interface ChildProfile {
  studentId: string;
  name: string;
  avatar?: string;
  age?: number;
  grade?: string;
  totalSessions?: number;
  lastScreeningDate?: number;
  latestClassification?: 'LOW' | 'MODERATE' | 'HIGH';
  latestRiskScore?: number;
}

// ============ TEACHER TYPES ============

export interface StudentRosterItem {
  studentId: string;
  name: string;
  email?: string;
  grade?: string;
  latestClassification?: 'LOW' | 'MODERATE' | 'HIGH';
  latestRiskScore?: number;
  lastActive?: number;
  totalSessionsCompleted?: number;
}

// ============ STUDENT SERVICE ============

export const studentService = {
  /**
   * GET /api/students/me/dashboard
   */
  async getDashboard(): Promise<StudentDashboardResponse> {
    const response = await axiosInstance.get<StudentDashboardResponse>('/api/students/me/dashboard');
    return response.data;
  },

  /**
   * POST /api/students/me/link-codes
   * Body: { type: "PARENT" | "TEACHER" }
   */
  async generateLinkCode(type: 'PARENT' | 'TEACHER'): Promise<LinkCodeResponse> {
    const response = await axiosInstance.post<LinkCodeResponse>('/api/students/me/link-codes', { type });
    return response.data;
  },

  /**
   * GET /api/students/me/sessions
   */
  async getSessions(): Promise<StudentSession[]> {
    const response = await axiosInstance.get<StudentSession[]>('/api/students/me/sessions');
    return response.data || [];
  },

  /**
   * GET /api/students/me/learning-plan
   */
  async getLearningPlan(): Promise<StudentLearningPlan> {
    const response = await axiosInstance.get<StudentLearningPlan>('/api/students/me/learning-plan');
    return response.data;
  },

  /**
   * POST /api/students/me/learning-plan/{moduleId}/complete
   */
  async completeModule(moduleId: string): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.post<{ success: boolean; message: string }>(
      `/api/students/me/learning-plan/${moduleId}/complete`
    );
    return response.data;
  },
};

// ============ PARENT SERVICE ============

export const parentService = {
  /**
   * GET /api/parents/me/dashboard
   */
  async getDashboard(): Promise<ParentDashboardResponse> {
    const response = await axiosInstance.get<ParentDashboardResponse>('/api/parents/me/dashboard');
    return response.data;
  },

  /**
   * POST /api/parents/me/link-child
   * Body: { code: "PAR-X7K92M" }
   */
  async linkChild(code: string): Promise<{ success: boolean; message?: string; child?: ChildProfile }> {
    const response = await axiosInstance.post('/api/parents/me/link-child', { code });
    return response.data;
  },

  /**
   * GET /api/parents/me/children
   */
  async getChildren(): Promise<ChildProfile[]> {
    const response = await axiosInstance.get<ChildProfile[]>('/api/parents/me/children');
    return response.data || [];
  },

  /**
   * GET /api/parents/me/children/{studentId}/sessions
   */
  async getChildSessions(studentId: string): Promise<StudentSession[]> {
    const response = await axiosInstance.get<StudentSession[]>(
      `/api/parents/me/children/${studentId}/sessions`
    );
    return response.data || [];
  },

  /**
   * GET /api/parents/me/children/{studentId}/report.pdf
   */
  async downloadChildReportPdf(studentId: string, studentName: string): Promise<void> {
    const response = await axiosInstance.get(
      `/api/parents/me/children/${studentId}/report.pdf`,
      { responseType: 'blob' }
    );
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dyslexia_Shield_Report_${(studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

// ============ TEACHER SERVICE ============

export const teacherService = {
  /**
   * GET /api/teachers/me/dashboard
   */
  async getDashboard(): Promise<TeacherDashboardResponse> {
    const response = await axiosInstance.get<TeacherDashboardResponse>('/api/teachers/me/dashboard');
    return response.data;
  },

  /**
   * POST /api/teachers/me/link-student
   * Body: { code: "TEA-P4D8QN" }
   */
  async linkStudent(code: string): Promise<{ success: boolean; message?: string; student?: StudentRosterItem }> {
    const response = await axiosInstance.post('/api/teachers/me/link-student', { code });
    return response.data;
  },

  /**
   * GET /api/teachers/me/students
   */
  async getStudents(): Promise<StudentRosterItem[]> {
    const response = await axiosInstance.get<StudentRosterItem[]>('/api/teachers/me/students');
    return response.data || [];
  },

  /**
   * GET /api/teachers/me/students/{studentId}/sessions
   */
  async getStudentSessions(studentId: string): Promise<StudentSession[]> {
    const response = await axiosInstance.get<StudentSession[]>(
      `/api/teachers/me/students/${studentId}/sessions`
    );
    return response.data || [];
  },
};
