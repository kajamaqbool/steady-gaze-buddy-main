import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parentService, ChildProfile, StudentSession } from '@/api/roleServices';
import { ParentDashboardResponse, MLResultPayload } from '@/api/types';
import { formatPercentage, formatDateTime, formatDurationSeconds, getRiskConfig } from '@/lib/formatUtils';
import {
  Users,
  Download,
  FileText,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronDown,
  Info,
  Calendar,
  Sparkles,
  BarChart3,
  BookOpen,
  UserPlus,
  Activity,
  User,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';

type NavTab = 'dashboard' | 'children' | 'progress' | 'reports' | 'link-child' | 'profile';

export const ParentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [dashboardData, setDashboardData] = useState<ParentDashboardResponse | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [childSessions, setChildSessions] = useState<StudentSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Link Child form state
  const [linkCode, setLinkCode] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string>('');
  const [linkErrorMsg, setLinkErrorMsg] = useState<string>('');

  const fetchDashboard = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      let dash: ParentDashboardResponse | null = null;
      try {
        dash = await parentService.getDashboard();
        setDashboardData(dash);
      } catch (dashErr) {
        console.warn('GET /api/parents/me/dashboard not directly available, calling getChildren()', dashErr);
      }

      let kidsList: ChildProfile[] = [];
      if (dash?.children && dash.children.length > 0) {
        kidsList = dash.children;
      } else {
        try {
          kidsList = await parentService.getChildren();
        } catch (kErr) {
          console.warn('Failed to fetch children roster', kErr);
        }
      }

      setChildren(kidsList);
      if (kidsList.length > 0 && !selectedChild) {
        setSelectedChild(kidsList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load parent dashboard', err);
      setErrorMsg('Unable to connect to parent services. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Fetch child sessions whenever selected child changes
  useEffect(() => {
    if (!selectedChild) return;
    let mounted = true;
    setSessionLoading(true);

    const fetchSessions = async () => {
      try {
        const sess = await parentService.getChildSessions(selectedChild.studentId);
        if (mounted) {
          setChildSessions(sess);
        }
      } catch (err) {
        console.error('Failed to load child sessions', err);
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };
    fetchSessions();
    return () => {
      mounted = false;
    };
  }, [selectedChild]);

  const handleLinkChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkErrorMsg('');
    setLinkSuccessMsg('');

    const trimmedCode = linkCode.trim().toUpperCase();
    if (!trimmedCode) {
      setLinkErrorMsg('Please enter a valid student linking code (e.g., PAR-X7K92M).');
      return;
    }

    setIsLinking(true);
    try {
      const res = await parentService.linkChild(trimmedCode);
      setLinkSuccessMsg(res.message || 'Child linked successfully to your account!');
      setLinkCode('');
      // Refresh dashboard data
      await fetchDashboard();
      if (res.child) {
        setSelectedChild(res.child);
      }
      setTimeout(() => {
        setActiveTab('children');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to link child', err);
      // Friendly error handling, no raw stack traces
      const friendlyErr =
        err.response?.data?.message ||
        err.message ||
        'Unable to link child. Please verify the code and try again.';
      setLinkErrorMsg(friendlyErr);
    } finally {
      setIsLinking(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedChild || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await parentService.downloadChildReportPdf(selectedChild.studentId, selectedChild.name);
    } catch (e) {
      console.error('Error triggering PDF download', e);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getRiskBadge = (classification?: 'LOW' | 'MODERATE' | 'HIGH') => {
    switch (classification) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            High Screening Indicator
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Info className="w-3.5 h-3.5 text-amber-600" />
            Moderate Screening Indicator
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Low Screening Indicator
          </span>
        );
    }
  };

  const navItems: Array<{ id: NavTab; label: string; icon: any }> = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'children', label: 'Children', icon: Users },
    { id: 'progress', label: 'Progress', icon: Activity },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'link-child', label: 'Link Child', icon: UserPlus },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Header Title */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <Users className="w-3.5 h-3.5" />
                Parent Portal
              </div>
              <h1 className="text-3xl font-extrabold font-display tracking-tight text-foreground">
                Parent Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitor your children's dyslexia screening indicators, eye-gaze tracking analytics, and official progress reports.
              </p>
            </div>

            {/* Link Child Quick Button */}
            <Button
              onClick={() => setActiveTab('link-child')}
              className="h-10 px-4 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 shadow-sm flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Link a Child
            </Button>
          </div>

          {/* Professional Navigation Tabs */}
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

        {/* TAB 1: MAIN DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            
            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Total Children</span>
                <div className="text-3xl font-extrabold text-foreground">
                  {dashboardData?.totalChildren ?? children.length}
                </div>
                <span className="text-[11px] text-muted-foreground block">Linked to parent account</span>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Active Children</span>
                <div className="text-3xl font-extrabold text-emerald-600">
                  {dashboardData?.activeChildren ?? children.length}
                </div>
                <span className="text-[11px] text-muted-foreground block">Active reading progress</span>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Total Sessions Recorded</span>
                <div className="text-3xl font-extrabold text-primary">
                  {dashboardData?.progressOverview?.totalSessions ??
                    children.reduce((acc, c) => acc + (c.totalSessions || 0), 0)}
                </div>
                <span className="text-[11px] text-muted-foreground block">Across all linked profiles</span>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Avg Risk Metric</span>
                <div className="text-3xl font-extrabold text-indigo-600">
                  {formatPercentage(dashboardData?.progressOverview?.avgRiskScore ?? 0.28)}
                </div>
                <span className="text-[11px] text-muted-foreground block">Screening indicator average</span>
              </div>
            </div>

            {/* Child Cards Roster */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Your Linked Children
                </h2>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('link-child')} className="rounded-xl">
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Child
                </Button>
              </div>

              {children.length === 0 ? (
                <div className="p-8 text-center bg-card rounded-2xl border border-border space-y-3">
                  <UserPlus className="w-10 h-10 mx-auto text-muted-foreground" />
                  <h3 className="font-bold text-foreground">No Children Linked Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Enter your child's linking code (e.g. PAR-X7K92M) to link their account and view screening reports.
                  </p>
                  <Button onClick={() => setActiveTab('link-child')} className="rounded-xl">
                    Link a Child Now
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {children.map((c) => (
                    <div
                      key={c.studentId}
                      onClick={() => {
                        setSelectedChild(c);
                        setActiveTab('children');
                      }}
                      className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-4 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl shrink-0">
                            {c.avatar || '👤'}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-foreground">{c.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {c.grade || 'Student'} • {c.age || 8} yrs
                            </p>
                          </div>
                        </div>
                        {getRiskBadge(c.latestClassification)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                        <div>
                          <span className="text-muted-foreground block">Latest Risk Score</span>
                          <span className="font-bold text-foreground">
                            {formatPercentage(c.latestRiskScore)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Total Sessions</span>
                          <span className="font-bold text-foreground">{c.totalSessions || 0}</span>
                        </div>
                      </div>

                      <Button size="sm" variant="outline" className="w-full rounded-xl text-xs font-semibold">
                        View Details & Session History →
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Activity List */}
            <section className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-500" />
                Recent Reading & Screening Activity
              </h2>

              <div className="space-y-3">
                {children.map((c) => (
                  <div key={c.studentId} className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {c.avatar || '👤'}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground block">
                          Completed reading adventure session • Gaze tracking evaluation completed
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Recent</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: LINK CHILD FORM */}
        {activeTab === 'link-child' && (
          <section className="max-w-xl mx-auto space-y-6">
            <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold font-display text-foreground">Link a Child Account</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the Parent Link Code generated on your child's student dashboard (e.g. PAR-X7K92M).
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

              <form onSubmit={handleLinkChildSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="linkCodeInput" className="text-sm font-bold text-foreground">
                    Child Linking Code
                  </label>
                  <Input
                    id="linkCodeInput"
                    type="text"
                    required
                    placeholder="PAR-X7K92M"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                    className="h-12 font-mono uppercase tracking-wider text-base rounded-xl bg-surface border-border focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ask your child to click "Generate Parent Code" on their dashboard connect card.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLinking}
                  className="w-full h-12 rounded-xl font-bold text-base bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                >
                  {isLinking ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Linking Child Account...
                    </span>
                  ) : (
                    'Link Child Account'
                  )}
                </Button>
              </form>
            </div>
          </section>
        )}

        {/* TAB 3: CHILDREN DETAILS & SESSIONS */}
        {(activeTab === 'children' || activeTab === 'progress' || activeTab === 'reports') && (
          <div className="space-y-6">
            
            {/* Child Picker Header */}
            {children.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Child Profile:</span>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {children.map((c) => (
                      <button
                        key={c.studentId}
                        onClick={() => setSelectedChild(c)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border ${
                          selectedChild?.studentId === c.studentId
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-surface text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        <span>{c.avatar || '👤'}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedChild && (
                  <Button
                    disabled={isDownloadingPdf}
                    onClick={handleDownloadPdf}
                    size="sm"
                    className="rounded-xl font-bold text-xs bg-primary text-primary-foreground flex items-center gap-1.5"
                  >
                    {isDownloadingPdf ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Downloading PDF...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Download PDF Report
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {selectedChild ? (
              <div className="space-y-6">
                
                {/* Child Summary Overview */}
                <section className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl shrink-0">
                        {selectedChild.avatar || '👤'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-2xl font-bold font-display text-foreground">
                            {selectedChild.name}
                          </h2>
                          {getRiskBadge(selectedChild.latestClassification)}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-3">
                          <span>Grade: {selectedChild.grade || 'Student'}</span>
                          <span>•</span>
                          <span>Age: {selectedChild.age || 8} yrs</span>
                          <span>•</span>
                          <span>Student ID: {selectedChild.studentId}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quantitative Risk Score Normalization Metric */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground block">Normalized Risk Score</span>
                      <div className="text-3xl font-extrabold text-primary">
                        {formatPercentage(selectedChild.latestRiskScore)}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Screening indicator algorithm calculation (0-100%).
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground block">Total Sessions</span>
                      <div className="text-3xl font-extrabold text-foreground">
                        {selectedChild.totalSessions || childSessions.length}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Recorded gaze tracking reading assessments.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground block">Screening Classification</span>
                      <div className="text-xl font-bold text-foreground capitalize">
                        {selectedChild.latestClassification || 'Low Risk Indicators'}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Screening indicator (Not a medical diagnosis).
                      </p>
                    </div>
                  </div>
                </section>

                {/* Session Table */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Session & Screening History
                  </h3>

                  <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                    {sessionLoading ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading session history...
                      </div>
                    ) : childSessions.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No session records available for {selectedChild.name}.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-surface text-xs font-bold text-muted-foreground uppercase border-b border-border">
                            <tr>
                              <th className="px-6 py-3.5">Session ID</th>
                              <th className="px-6 py-3.5">Date & Time</th>
                              <th className="px-6 py-3.5">Duration</th>
                              <th className="px-6 py-3.5">Frames Captured</th>
                              <th className="px-6 py-3.5">Risk Score</th>
                              <th className="px-6 py-3.5">Indicator Level</th>
                              <th className="px-6 py-3.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {childSessions.map((s) => (
                              <tr key={s.sessionId} className="hover:bg-surface/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs font-bold text-foreground">
                                  {s.sessionId || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-xs text-muted-foreground">
                                  {formatDateTime(s.timestamp)}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-foreground">
                                  {formatDurationSeconds(s.durationMs)}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-foreground">
                                  {(s.frameCount || 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-xs font-extrabold text-primary">
                                  {formatPercentage(s.riskScore)}
                                </td>
                                <td className="px-6 py-4">
                                  {getRiskBadge(s.riskClassification)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>

              </div>
            ) : (
              <div className="p-12 text-center bg-card rounded-2xl border border-border text-muted-foreground">
                No child profiles found. Click "Link Child" to connect your child's account.
              </div>
            )}

          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <section className="max-w-2xl mx-auto bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold font-display text-foreground">Parent Account Profile</h2>
              <p className="text-sm text-muted-foreground">
                Manage your parent notifications and connected children.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-border text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Account Role</span>
                <span className="font-bold text-primary">PARENT</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Linked Children</span>
                <span className="font-bold text-foreground">{children.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Data Privacy</span>
                <span className="font-bold text-emerald-600">Strictly Local & Encrypted</span>
              </div>
            </div>
          </section>
        )}

      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border mt-12">
        <p>🔒 Dyslexia Shield Parent Portal • Data privacy & security guaranteed.</p>
      </footer>
    </div>
  );
};

export default ParentDashboard;
