import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { teacherService, StudentRosterItem, StudentSession } from '@/api/roleServices';
import { TeacherDashboardResponse, MLResultPayload } from '@/api/types';
import { formatPercentage, formatDateTime, formatDurationSeconds } from '@/lib/formatUtils';
import {
  GraduationCap,
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  X,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Info,
  UserPlus,
  BarChart3,
  BookOpen,
  Check,
  AlertCircle,
  RefreshCw,
  User,
} from 'lucide-react';

type NavTab = 'dashboard' | 'students' | 'progress' | 'sessions' | 'add-student' | 'profile';

export const TeacherDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [dashboardData, setDashboardData] = useState<TeacherDashboardResponse | null>(null);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Add student form state
  const [linkCode, setLinkCode] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string>('');
  const [linkErrorMsg, setLinkErrorMsg] = useState<string>('');

  // Selected student for session inspection
  const [inspectStudent, setInspectStudent] = useState<StudentRosterItem | null>(null);
  const [studentSessions, setStudentSessions] = useState<StudentSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      let dash: TeacherDashboardResponse | null = null;
      try {
        dash = await teacherService.getDashboard();
        setDashboardData(dash);
      } catch (dashErr) {
        console.warn('GET /api/teachers/me/dashboard not directly returned, calling getStudents()', dashErr);
      }

      let roster: StudentRosterItem[] = [];
      if (dash?.students && dash.students.length > 0) {
        roster = dash.students;
      } else {
        try {
          roster = await teacherService.getStudents();
        } catch (rErr) {
          console.warn('Failed to load roster directly', rErr);
        }
      }

      setStudents(roster);
    } catch (err: any) {
      console.error('Failed to load teacher dashboard', err);
      setErrorMsg('Unable to connect to teacher services. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleInspectStudent = async (student: StudentRosterItem) => {
    setInspectStudent(student);
    setIsSessionsLoading(true);
    try {
      const sess = await teacherService.getStudentSessions(student.studentId);
      setStudentSessions(sess);
    } catch (e) {
      console.error('Error fetching student sessions for teacher inspect', e);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkErrorMsg('');
    setLinkSuccessMsg('');

    const trimmedCode = linkCode.trim().toUpperCase();
    if (!trimmedCode) {
      setLinkErrorMsg('Please enter a valid student code (e.g., TEA-P4D8QN).');
      return;
    }

    setIsLinking(true);
    try {
      const res = await teacherService.linkStudent(trimmedCode);
      setLinkSuccessMsg(res.message || 'Student added successfully to your classroom roster!');
      setLinkCode('');
      await fetchDashboard();
      setTimeout(() => {
        setActiveTab('students');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to add student', err);
      const friendlyErr =
        err.response?.data?.message ||
        err.message ||
        'Unable to add student. Please verify the code and try again.';
      setLinkErrorMsg(friendlyErr);
    } finally {
      setIsLinking(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = filterGrade === 'ALL' || s.grade === filterGrade;
    return matchesSearch && matchesGrade;
  });

  const highRiskCount = students.filter((s) => s.latestClassification === 'HIGH').length;
  const moderateRiskCount = students.filter((s) => s.latestClassification === 'MODERATE').length;
  const lowRiskCount = students.filter((s) => s.latestClassification === 'LOW').length;
  const grades = Array.from(new Set(students.map((s) => s.grade).filter(Boolean)));

  const getRiskBadge = (classification?: 'LOW' | 'MODERATE' | 'HIGH') => {
    switch (classification) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            High Indicator
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Info className="w-3 h-3 text-amber-600" />
            Moderate Indicator
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Low Indicator
          </span>
        );
    }
  };

  const navItems: Array<{ id: NavTab; label: string; icon: any }> = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'progress', label: 'Progress', icon: Activity },
    { id: 'sessions', label: 'Sessions', icon: Clock },
    { id: 'add-student', label: 'Add Student', icon: UserPlus },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Header */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <GraduationCap className="w-3.5 h-3.5" />
                Educator Portal
              </div>
              <h1 className="text-3xl font-extrabold font-display tracking-tight text-foreground">
                Teacher Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Overview of student eye-tracking screening indicators, risk-score analytics, and classroom rosters.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setActiveTab('add-student')}
                className="h-10 px-4 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 shadow-sm flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Student
              </Button>

              <Button
                onClick={() => {
                  const csvContent =
                    "data:text/csv;charset=utf-8," +
                    ["Name,Email,Grade,RiskLevel,RiskScore,SessionsCompleted"]
                      .concat(
                        students.map(
                          (s) =>
                            `"${s.name}","${s.email || ''}","${s.grade || ''}","${
                              s.latestClassification || 'N/A'
                            }",${formatPercentage(s.latestRiskScore)},${s.totalSessionsCompleted || 0}`
                        )
                      )
                      .join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "Classroom_Dyslexia_Screening_Roster.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="h-10 px-4 rounded-xl font-bold text-sm bg-card border border-border text-foreground hover:bg-surface shadow-sm flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px text-sm font-medium">
            {navItems.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 font-semibold whitespace-nowrap ${
                    isActive
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {errorMsg && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button size="sm" variant="outline" onClick={fetchDashboard} className="text-amber-900 border-amber-300">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        )}

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            
            {/* Overview Metrics Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Students</span>
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="text-3xl font-extrabold text-foreground">
                  {dashboardData?.totalStudents ?? students.length}
                </div>
                <p className="text-xs text-muted-foreground">Enrolled on class roster</p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Students</span>
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-3xl font-extrabold text-emerald-600">
                  {dashboardData?.activeStudents ?? students.length}
                </div>
                <p className="text-xs text-muted-foreground">Active in reading modules</p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">High Risk Indicator</span>
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <div className="text-3xl font-extrabold text-rose-600">{highRiskCount}</div>
                <p className="text-xs text-muted-foreground">Require focused reading support</p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Moderate / Low Risk</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="text-3xl font-extrabold text-indigo-600">
                  {moderateRiskCount + lowRiskCount}
                </div>
                <p className="text-xs text-muted-foreground">Progressing as expected</p>
              </div>
            </section>

            {/* Student Roster Table Preview */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Classroom Roster & Screening State
                </h2>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('students')} className="rounded-xl">
                  View Full Roster →
                </Button>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface text-xs font-bold text-muted-foreground uppercase border-b border-border">
                      <tr>
                        <th className="px-6 py-3.5">Student Name</th>
                        <th className="px-6 py-3.5">Grade</th>
                        <th className="px-6 py-3.5">Sessions</th>
                        <th className="px-6 py-3.5">Screening Status</th>
                        <th className="px-6 py-3.5">Risk Score</th>
                        <th className="px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {students.slice(0, 5).map((student) => (
                        <tr key={student.studentId} className="hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.email || 'No email registered'}</div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-foreground">
                            {student.grade || 'Grade 3'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-foreground">
                            {student.totalSessionsCompleted || 0}
                          </td>
                          <td className="px-6 py-4">
                            {getRiskBadge(student.latestClassification)}
                          </td>
                          <td className="px-6 py-4 text-xs font-extrabold text-foreground">
                            {formatPercentage(student.latestRiskScore)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleInspectStudent(student)}
                              className="h-8 px-3 rounded-xl font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View Logs
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: ADD STUDENT FORM */}
        {activeTab === 'add-student' && (
          <section className="max-w-xl mx-auto space-y-6">
            <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold font-display text-foreground">Add Student to Roster</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the Teacher Code generated on your student's dashboard (e.g. TEA-P4D8QN).
                </p>
              </div>

              {linkSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-3 text-sm">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p>{linkSuccessMsg}</p>
                </div>
              )}

              {linkErrorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <p>{linkErrorMsg}</p>
                </div>
              )}

              <form onSubmit={handleAddStudentSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="teacherCodeInput" className="text-sm font-bold text-foreground">
                    Student Teacher Code
                  </label>
                  <Input
                    id="teacherCodeInput"
                    type="text"
                    required
                    placeholder="TEA-P4D8QN"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                    className="h-12 font-mono uppercase tracking-wider text-base rounded-xl bg-surface border-border focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ask your student to click "Generate Teacher Code" on their student dashboard.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLinking}
                  className="w-full h-12 rounded-xl font-bold text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {isLinking ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Linking Student to Roster...
                    </span>
                  ) : (
                    'Add Student to Roster'
                  )}
                </Button>
              </form>
            </div>
          </section>
        )}

        {/* TAB 3: STUDENTS & SESSIONS ROSTER */}
        {(activeTab === 'students' || activeTab === 'progress' || activeTab === 'sessions') && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Full Classroom Student Roster
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border font-medium text-xs text-foreground focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                {grades.length > 0 && (
                  <select
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-card border border-border font-bold text-xs text-foreground focus:ring-2 focus:ring-primary outline-none cursor-pointer w-full sm:w-auto"
                  >
                    <option value="ALL">All Grades</option>
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              {isLoading ? (
                <div className="p-10 text-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading classroom roster...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No students match your search criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface text-xs font-bold text-muted-foreground uppercase border-b border-border">
                      <tr>
                        <th className="px-6 py-3.5">Student Name</th>
                        <th className="px-6 py-3.5">Grade</th>
                        <th className="px-6 py-3.5">Sessions</th>
                        <th className="px-6 py-3.5">Screening Status</th>
                        <th className="px-6 py-3.5">Normalized Risk Score</th>
                        <th className="px-6 py-3.5">Last Active</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredStudents.map((student) => (
                        <tr key={student.studentId} className="hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.email || 'No email registered'}</div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-foreground">
                            {student.grade || 'Grade 3'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-foreground">
                            {student.totalSessionsCompleted || 0}
                          </td>
                          <td className="px-6 py-4">
                            {getRiskBadge(student.latestClassification)}
                          </td>
                          <td className="px-6 py-4 text-xs font-extrabold text-foreground">
                            {formatPercentage(student.latestRiskScore)}
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {formatDateTime(student.lastActive)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleInspectStudent(student)}
                              className="h-8 px-3 rounded-xl font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Inspect Logs
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <section className="max-w-2xl mx-auto bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold font-display text-foreground">Teacher Profile</h2>
              <p className="text-sm text-muted-foreground">
                Educator portal settings and connected classroom statistics.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-border text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Account Role</span>
                <span className="font-bold text-indigo-600">TEACHER</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Enrolled Students</span>
                <span className="font-bold text-foreground">{students.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Assessment Protocol</span>
                <span className="font-bold text-emerald-600 font-mono">Dyslexia-Shield-ML-v2</span>
              </div>
            </div>
          </section>
        )}

        {/* INSPECTION MODAL */}
        {inspectStudent && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden animate-fade-in-up space-y-4 p-6 relative">
              
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-xl font-extrabold font-display text-foreground">
                    {inspectStudent.name} — Session History & Progress
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Grade: {inspectStudent.grade || 'N/A'} • Email: {inspectStudent.email || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => setInspectStudent(null)}
                  className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sessions List */}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {isSessionsLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Fetching student session logs...
                  </div>
                ) : studentSessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No session logs recorded for this student yet.
                  </div>
                ) : (
                  studentSessions.map((sess) => (
                    <div
                      key={sess.sessionId}
                      className="p-4 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-foreground font-mono">{sess.sessionId}</div>
                        <div className="text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(sess.timestamp)}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-muted-foreground block">Duration</span>
                          <span className="font-bold text-foreground">{formatDurationSeconds(sess.durationMs)}</span>
                        </div>

                        <div>
                          <span className="text-muted-foreground block">Risk Score</span>
                          <span className="font-bold text-primary">{formatPercentage(sess.riskScore)}</span>
                        </div>

                        <div>{getRiskBadge(sess.riskClassification)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-border flex justify-end">
                <Button
                  onClick={() => setInspectStudent(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs"
                >
                  Close
                </Button>
              </div>

            </div>
          </div>
        )}

      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border mt-12">
        <p>🏫 Dyslexia Shield Teacher Portal • Supporting classroom reading success.</p>
      </footer>
    </div>
  );
};

export default TeacherDashboard;
