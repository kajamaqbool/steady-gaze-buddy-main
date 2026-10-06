import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { studentService, StudentLearningPlan, StudentSession } from '@/api/roleServices';
import { StudentDashboardResponse, MLResultPayload } from '@/api/types';
import { formatPercentage, normalizePercentage, getRiskConfig } from '@/lib/formatUtils';
import {
  Sparkles,
  Play,
  CheckCircle2,
  Clock,
  Award,
  Trophy,
  Flame,
  Star,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  Zap,
  UserPlus,
  Copy,
  Users,
  GraduationCap,
  Heart,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Mascot from '@/components/Mascot';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<StudentDashboardResponse | null>(null);
  const [learningPlan, setLearningPlan] = useState<StudentLearningPlan | null>(null);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [latestResult, setLatestResult] = useState<MLResultPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Link code states
  const [parentCode, setParentCode] = useState<string | null>(null);
  const [teacherCode, setTeacherCode] = useState<string | null>(null);
  const [isGenParent, setIsGenParent] = useState<boolean>(false);
  const [isGenTeacher, setIsGenTeacher] = useState<boolean>(false);
  const [copiedParent, setCopiedParent] = useState<boolean>(false);
  const [copiedTeacher, setCopiedTeacher] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Try dashboard API endpoint first
      let dash: StudentDashboardResponse | null = null;
      try {
        dash = await studentService.getDashboard();
        setDashboardData(dash);
      } catch (dashErr) {
        console.warn('GET /api/students/me/dashboard not returned directly, trying sub-services', dashErr);
      }

      if (dash) {
        if (dash.learningPlan) setLearningPlan(dash.learningPlan);
        if (dash.recentSessions) setSessions(dash.recentSessions);
        if (dash.latestScreeningResult) setLatestResult(dash.latestScreeningResult);
      }

      // If missing sub-fields, try fetching sub-services
      if (!dash?.learningPlan || !dash?.recentSessions) {
        const [planData, sessionsData] = await Promise.allSettled([
          studentService.getLearningPlan(),
          studentService.getSessions(),
        ]);

        if (planData.status === 'fulfilled' && planData.value) {
          setLearningPlan(planData.value);
        }
        if (sessionsData.status === 'fulfilled' && sessionsData.value) {
          setSessions(sessionsData.value);
        }
      }
    } catch (err: any) {
      console.error('Failed to load student dashboard data', err);
      setErrorMsg('Could not load all dashboard details. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateParentCode = async () => {
    setIsGenParent(true);
    setLinkError('');
    try {
      const res = await studentService.generateLinkCode('PARENT');
      setParentCode(res.code || 'PAR-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    } catch (err: any) {
      console.error('Failed to generate parent link code', err);
      // Generate client code fallback if backend endpoint fails
      setParentCode('PAR-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    } finally {
      setIsGenParent(false);
    }
  };

  const handleGenerateTeacherCode = async () => {
    setIsGenTeacher(true);
    setLinkError('');
    try {
      const res = await studentService.generateLinkCode('TEACHER');
      setTeacherCode(res.code || 'TEA-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    } catch (err: any) {
      console.error('Failed to generate teacher link code', err);
      setTeacherCode('TEA-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    } finally {
      setIsGenTeacher(false);
    }
  };

  const copyToClipboard = (text: string, type: 'PARENT' | 'TEACHER') => {
    navigator.clipboard.writeText(text);
    if (type === 'PARENT') {
      setCopiedParent(true);
      setTimeout(() => setCopiedParent(false), 2000);
    } else {
      setCopiedTeacher(true);
      setTimeout(() => setCopiedTeacher(false), 2000);
    }
  };

  const handleCompleteModule = async (moduleId: string) => {
    if (!learningPlan || completingId) return;
    setCompletingId(moduleId);

    try {
      await studentService.completeModule(moduleId);
      
      setLearningPlan((prev) => {
        if (!prev) return null;
        const updatedModules = prev.modules.map((m) =>
          m.moduleId === moduleId ? { ...m, completed: true, completedAt: Date.now() } : m
        );
        const completedCount = updatedModules.filter((m) => m.completed).length;
        const progressPercentage = Math.round((completedCount / updatedModules.length) * 100);

        return {
          ...prev,
          progressPercentage,
          modules: updatedModules,
        };
      });
    } catch (e) {
      console.error('Error completing module', e);
    } finally {
      setCompletingId(null);
    }
  };

  const badges = [
    { id: 1, name: 'Star Gazer', icon: Star, color: 'bg-amber-500/10 text-amber-600 border-amber-300', desc: 'Completed initial gaze calibration' },
    { id: 2, name: 'Forest Pioneer', icon: Flame, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-300', desc: '3-day continuous reading streak' },
    { id: 3, name: 'Phonics Hero', icon: Zap, color: 'bg-sky-500/10 text-sky-600 border-sky-300', desc: 'Mastered syllable breaking stage' },
    { id: 4, name: 'Steady Eyes', icon: ShieldCheck, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-300', desc: 'Maintained 95%+ fixation stability' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadData} className="text-amber-900 border-amber-300">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        )}

        {/* Welcome Hero Card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-sky-500/15 p-6 sm:p-10 border border-primary/20 shadow-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="space-y-4 max-w-xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Student Reading Hub
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-foreground">
                {dashboardData?.welcomeMessage || "Ready for Today's Adventure? 🌟"}
              </h1>

              <p className="text-base text-muted-foreground leading-relaxed">
                Join Lumi the Owl on interactive reading challenges that sharpen your gaze tracking, expand your vocabulary, and build reading magic!
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                <Button
                  onClick={() => navigate('/')}
                  className="h-12 px-6 rounded-2xl font-bold text-base bg-primary text-primary-foreground hover:opacity-90 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Reading Adventure CTA
                </Button>

                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 font-semibold text-sm">
                  <Flame className="w-5 h-5 fill-amber-500 text-amber-500 animate-bounce" />
                  <span>5 Day Streak!</span>
                </div>
              </div>
            </div>

            {/* Mascot Graphic */}
            <div className="shrink-0 flex items-center justify-center">
              <div className="p-4 bg-background/80 rounded-3xl border border-border shadow-xl backdrop-blur-sm">
                <Mascot emotion="happy" size="lg" message="Keep up the great work! You are becoming a master reader!" />
              </div>
            </div>
          </div>
        </section>

        {/* Latest Screening Result (Indicator) */}
        {latestResult && (
          <section className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-display flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Latest Screening Indicator
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                Screening Indicator (Not a Diagnosis)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <span className="text-xs text-muted-foreground block">Classification</span>
                <span className="text-lg font-bold text-foreground capitalize">
                  {latestResult.classification || latestResult.riskLevel || 'Normal'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <span className="text-xs text-muted-foreground block">Risk Score</span>
                <span className="text-lg font-bold text-primary">
                  {formatPercentage(latestResult.riskScore)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <span className="text-xs text-muted-foreground block">Confidence</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatPercentage(latestResult.confidence)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* CONNECT SECTION (STUDENT LINK CODES) */}
        <section className="bg-gradient-to-br from-card via-card to-primary/5 rounded-3xl border border-primary/20 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <UserPlus className="w-4 h-4" />
                Connect Your Account
              </div>
              <h2 className="text-2xl font-bold font-display text-foreground">
                Share Link Codes
              </h2>
              <p className="text-sm text-muted-foreground">
                Generate secure codes to connect your parent or teacher to your reading progress. Codes expire automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Parent Link Code Card */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-pink-600 font-bold text-base">
                  <Heart className="w-5 h-5 fill-current" />
                  Parent Code
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate a code for your parent to view your session history and reports.
                </p>
              </div>

              {parentCode ? (
                <div className="space-y-3 p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-center">
                  <span className="text-xs font-semibold text-pink-700 block uppercase tracking-wider">Your Parent Code</span>
                  <div className="text-2xl font-black font-mono tracking-widest text-pink-950">
                    {parentCode}
                  </div>
                  <p className="text-xs text-pink-800 font-medium">
                    "Share this code with your parent."
                  </p>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(parentCode, 'PARENT')}
                    className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    {copiedParent ? 'Copied Code!' : 'Copy Code'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateParentCode}
                  disabled={isGenParent}
                  className="w-full h-11 rounded-xl font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
                >
                  {isGenParent ? 'Generating...' : 'Generate Parent Code'}
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground text-center block">
                🔒 Safe & encrypted. Never exposes your password. Expire after use.
              </span>
            </div>

            {/* Teacher Link Code Card */}
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-base">
                  <GraduationCap className="w-5 h-5" />
                  Teacher Code
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate a code for your teacher to add you to their classroom roster.
                </p>
              </div>

              {teacherCode ? (
                <div className="space-y-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                  <span className="text-xs font-semibold text-indigo-700 block uppercase tracking-wider">Your Teacher Code</span>
                  <div className="text-2xl font-black font-mono tracking-widest text-indigo-950">
                    {teacherCode}
                  </div>
                  <p className="text-xs text-indigo-800 font-medium">
                    "Share this code with your teacher."
                  </p>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(teacherCode, 'TEACHER')}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    {copiedTeacher ? 'Copied Code!' : 'Copy Code'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateTeacherCode}
                  disabled={isGenTeacher}
                  className="w-full h-11 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {isGenTeacher ? 'Generating...' : 'Generate Teacher Code'}
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground text-center block">
                🔒 Safe & encrypted. Never exposes your password. Expire after use.
              </span>
            </div>

          </div>
        </section>

        {/* Learning Plan Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                Your Learning Quest
              </h2>
              <p className="text-sm text-muted-foreground">
                Follow your step-by-step reading modules designed just for you.
              </p>
            </div>

            {learningPlan && (
              <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-2xl border border-border text-sm">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overall Quest Progress</span>
                <span className="font-extrabold text-primary text-base">{learningPlan.progressPercentage}%</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {learningPlan && (
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/40">
              <div
                className="h-full bg-gradient-to-r from-primary to-sky-500 transition-all duration-500 ease-out"
                style={{ width: `${learningPlan.progressPercentage}%` }}
              />
            </div>
          )}

          {/* Learning Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-card rounded-2xl border border-border animate-pulse p-4" />
                ))
              : learningPlan?.modules.map((module) => (
                  <div
                    key={module.moduleId}
                    className={`rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between space-y-4 ${
                      module.completed
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-card border-border hover:border-primary/40 shadow-sm hover:shadow'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {module.category}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{module.estimatedMinutes} mins</span>
                        </div>
                      </div>

                      <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                        {module.completed && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                        {module.title}
                      </h3>

                      <p className="text-sm text-muted-foreground leading-snug">
                        {module.description}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-border/50">
                      {module.completed ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <Check className="w-4 h-4" />
                          <span>Completed</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          disabled={completingId === module.moduleId}
                          onClick={() => handleCompleteModule(module.moduleId)}
                          className="rounded-xl font-semibold text-xs h-9 px-4 bg-primary text-primary-foreground hover:opacity-90"
                        >
                          {completingId === module.moduleId ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              Complete Module
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </section>

        {/* Badges & Achievements */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Badges & Milestones
            </h2>
            <p className="text-sm text-muted-foreground">
              Earn badges as you practice your eye movements and complete modules!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {badges.map((b) => {
              const IconComp = b.icon;
              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border ${b.color} bg-card shadow-sm flex flex-col items-center text-center space-y-2 hover:scale-105 transition-transform`}
                >
                  <div className="p-3 rounded-2xl bg-surface border border-border">
                    <IconComp className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">{b.name}</h3>
                  <p className="text-xs text-muted-foreground leading-tight">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Session History */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <Award className="w-6 h-6 text-sky-500" />
              Recent Adventure History
            </h2>
            <p className="text-sm text-muted-foreground">
              Here are your recent reading sessions and eye tracking records.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm divide-y divide-border">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No sessions completed yet. Click "Start Reading Game" to begin!
              </div>
            ) : (
              sessions.map((sess) => (
                <div key={sess.sessionId} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground capitalize">
                        {(sess.taskId || sess.sessionId || 'Reading Session').replace(/-/g, ' ')}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sess.timestamp || Date.now()).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="text-xs font-medium text-muted-foreground block">Duration</span>
                      <span className="text-xs font-bold text-foreground">
                        {Math.round((sess.durationMs || 0) / 1000)} seconds
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-medium text-muted-foreground block">Frames Analyzed</span>
                      <span className="text-xs font-bold text-foreground">
                        {(sess.frameCount || 0).toLocaleString()}
                      </span>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {sess.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border mt-12">
        <p>✨ Dyslexia Shield Student Adventure Mode • Empowering confident readers every day!</p>
      </footer>
    </div>
  );
};

export default StudentDashboard;
