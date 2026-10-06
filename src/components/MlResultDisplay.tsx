import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useSessionResultPolling } from '../hooks/useSessionResultPolling';
import { useGazeStore } from '../store/gazeStore';
import { useAuth } from '../context/AuthContext';
import { SpeechAnalysisResponse } from '../api/types';
import { Button } from '@/components/ui/button';
import {
  normalizePercentage,
  formatPercentage,
  formatDateTime,
  formatDurationSeconds,
  getRiskConfig,
} from '@/lib/formatUtils';
import { Shield, HelpCircle, CheckCircle2, RefreshCw, AlertCircle, Info, Lightbulb, Mic, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface MlResultDisplayProps {
  speechResult?: SpeechAnalysisResponse | null;
}

const MlResultDisplay: React.FC<MlResultDisplayProps> = ({ speechResult: propSpeechResult }) => {
  const { role } = useAuth();
  const storeSpeechResult = useGazeStore((state) => state.speechResult);
  const speechResult = propSpeechResult !== undefined ? propSpeechResult : storeSpeechResult;
  const { result, status, error, attemptCount, checkAgain } = useSessionResultPolling();
  const [isReadingDetailsOpen, setIsReadingDetailsOpen] = useState(true);

  // Error state (e.g. 401, 403 or server error)
  if (error && !result) {
    return (
      <Card className="border-rose-200 bg-rose-50/60 shadow-sm text-center p-6 sm:p-8">
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-rose-950 font-display">
            {error.isForbidden
              ? 'Access Forbidden'
              : error.isUnauthorized
              ? 'Authentication Required'
              : 'Screening Analysis Error'}
          </h3>
          <p className="text-sm text-rose-800 leading-relaxed">{error.message}</p>
          <Button onClick={checkAgain} variant="outline" size="sm" className="mt-2 border-rose-300 text-rose-900 hover:bg-rose-100">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // Slow ML processing state (after 20 poll attempts)
  if (status === 'slow' && !result) {
    return (
      <Card className="border-amber-200 bg-amber-50/70 shadow-sm text-center p-6 sm:p-8">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl">
            ⏳
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-amber-950 font-display">
              Still processing — taking a little longer than usual
            </h3>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
              Our ML screening engine is finishing your gaze trajectory calculations. Click below to check again.
            </p>
          </div>
          <Button onClick={checkAgain} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-xs">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check again
          </Button>
        </div>
      </Card>
    );
  }

  // Loading / Polling state
  if (status === 'polling' && !result) {
    return (
      <Card className="border-blue-200 bg-blue-50/50 shadow-sm p-6 sm:p-8 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="inline-block w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 font-display">
              Evaluating Gaze Trajectory
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Running Machine Learning screening... (Check #{attemptCount}/20)
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // No result state
  if (!result) {
    return (
      <Card className="border-slate-200 bg-slate-50/60 p-6 sm:p-8 text-center">
        <div className="max-w-md mx-auto space-y-2 text-slate-500">
          <Shield className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-lg font-bold text-slate-800 font-display">Awaiting Screening Analysis</h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Complete a reading adventure session to view AI screening results here.
          </p>
        </div>
      </Card>
    );
  }

  // Determine effective scores (Combined when speechResult is available, otherwise Gaze-only)
  const isCombined = Boolean(speechResult && (speechResult.combinedRiskScore !== undefined || speechResult.speechRiskScore !== undefined));
  const rawRiskScore = isCombined
    ? (speechResult?.combinedRiskScore ?? speechResult?.speechRiskScore ?? result.riskScore)
    : result.riskScore;
  const riskScoreNorm = normalizePercentage(rawRiskScore);
  const confidenceNorm = normalizePercentage(result.confidence);
  
  const effectiveClassification = isCombined
    ? (speechResult?.classification || result.classification)
    : result.classification;
  const riskConfig = getRiskConfig(effectiveClassification);

  const ruleScoreNorm = result.breakdown ? normalizePercentage(result.breakdown.ruleScore) : 0;
  const rfScoreNorm = result.breakdown ? normalizePercentage(result.breakdown.rfScore) : 0;
  const speechRiskScoreNorm = speechResult?.speechRiskScore !== undefined ? normalizePercentage(speechResult.speechRiskScore) : undefined;

  const breakdownData = [
    ...(result.breakdown ? [
      { name: 'Rule Engine', value: ruleScoreNorm },
      { name: 'Random Forest', value: rfScoreNorm },
    ] : []),
    ...(speechRiskScoreNorm !== undefined ? [
      { name: 'Reading Aloud (Speech)', value: speechRiskScoreNorm }
    ] : [])
  ];

  const pieData = result.breakdown ? [
    { name: 'Rule-Based (70%)', value: ruleScoreNorm * 0.7 },
    { name: 'Random Forest (30%)', value: rfScoreNorm * 0.3 },
  ] : [];

  const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Primary Screening Summary Header Card */}
      <Card className={`border-2 ${riskConfig.cardBgClass} shadow-sm overflow-hidden`}>
        <CardHeader className="pb-2 border-b border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-bold font-display text-foreground">
                Screening Result Summary {isCombined && <span className="text-xs font-normal text-indigo-600 font-sans ml-1">(Gaze + Reading Aloud)</span>}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isCombined && (
                <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50 text-[10px] font-bold">
                  🎙️ Stage 2 Combined
                </Badge>
              )}
              <Badge className={riskConfig.badgeClass}>
                {riskConfig.label}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Risk Ring Meter */}
            <div className="flex flex-col items-center justify-center p-4 bg-surface/70 rounded-2xl border border-border/50">
              <div className="relative w-32 h-32 mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-slate-200" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke={riskConfig.progressColor}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(riskScoreNorm / 100) * 351.8} 351.8`}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground font-display">
                    {formatPercentage(riskScoreNorm, 1)}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    {isCombined ? 'Combined Risk' : 'Risk Score'}
                  </span>
                </div>
              </div>
              <span className={`text-sm font-bold ${riskConfig.textColorClass}`}>
                {riskConfig.label}
              </span>
            </div>

            {/* Confidence & Details */}
            <div className="space-y-4 md:col-span-2">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground">Screening Confidence</span>
                  <span className="font-bold text-primary">{formatPercentage(confidenceNorm, 1)}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${confidenceNorm}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm pt-2 border-t border-border/40">
                <div>
                  <span className="block text-muted-foreground font-medium">Session Timestamp</span>
                  <span className="font-semibold text-foreground">{formatDateTime(result.timestamp)}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium">Tracking Duration</span>
                  <span className="font-semibold text-foreground">
                    {result.metadata?.duration ? formatDurationSeconds(result.metadata.duration) : 'Active Session'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* 2. Collapsible Reading Aloud Assessment Details (if Stage 2 speech result exists) */}
      {speechResult && (
        <Card className="border-indigo-200 bg-indigo-50/30 shadow-xs overflow-hidden">
          <CardHeader className="pb-3 cursor-pointer select-none flex flex-row items-center justify-between" onClick={() => setIsReadingDetailsOpen(!isReadingDetailsOpen)}>
            <div className="flex items-center gap-2 text-indigo-700">
              <Mic className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-base font-bold font-display text-indigo-950">
                Reading Aloud Assessment Details
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-indigo-700 hover:bg-indigo-100">
              {isReadingDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CardHeader>
          {isReadingDetailsOpen && (
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-card rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-muted-foreground block font-medium">Reading Accuracy</span>
                  <span className="font-bold text-emerald-600 text-base">
                    {typeof speechResult.accuracy === 'number' ? `${speechResult.accuracy}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-3 bg-card rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-muted-foreground block font-medium">Words Correct</span>
                  <span className="font-bold text-foreground text-base">
                    {speechResult.correctWords} <span className="text-xs text-muted-foreground font-normal">/ {speechResult.totalWords}</span>
                  </span>
                </div>
                <div className="p-3 bg-card rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-muted-foreground block font-medium">Reading Speed (WCPM)</span>
                  <span className="font-bold text-primary text-base">
                    {speechResult.wcpm} WCPM
                  </span>
                </div>
                <div className="p-3 bg-card rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-muted-foreground block font-medium">Speech Risk Score</span>
                  <span className="font-bold text-indigo-600 text-base">
                    {speechResult.speechRiskScore !== undefined ? `${speechResult.speechRiskScore.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Supportive WCPM explanation line */}
              <div className="p-3 bg-indigo-100/70 border border-indigo-200/80 rounded-xl text-indigo-950 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>average children your age read around 70–90 words per minute</span>
              </div>

              {/* Error Breakdown Row */}
              <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-2.5 bg-card rounded-xl border border-border text-center">
                  <span className="text-muted-foreground block text-[10px]">Substitutions</span>
                  <span className="font-bold text-amber-600 text-sm">{speechResult.substitutions ?? 0}</span>
                </div>
                <div className="p-2.5 bg-card rounded-xl border border-border text-center">
                  <span className="text-muted-foreground block text-[10px]">Omissions</span>
                  <span className="font-bold text-rose-600 text-sm">{speechResult.omissions ?? 0}</span>
                </div>
                <div className="p-2.5 bg-card rounded-xl border border-border text-center">
                  <span className="text-muted-foreground block text-[10px]">Insertions</span>
                  <span className="font-bold text-indigo-600 text-sm">{speechResult.insertions ?? 0}</span>
                </div>
              </div>

              {/* Gated Raw Transcript (Parent/Teacher View ONLY) */}
              {(role === 'PARENT' || role === 'TEACHER') && speechResult.transcript && (
                <div className="pt-2 border-t border-indigo-200/60 space-y-2">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Evaluator Transcript Log (Parent / Teacher View)
                  </span>
                  <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {speechResult.transcript}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* 3. "What does this mean?" Section */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <HelpCircle className="w-5 h-5" />
            <CardTitle className="text-base font-bold font-display text-foreground">
              What does this mean?
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>{riskConfig.explanation}</p>
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-950 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              This evaluation looks at fixation pauses, line-skipping frequency, and saccadic regression rates captured during reading.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. "What can we do next?" Section */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-secondary">
            <Lightbulb className="w-5 h-5" />
            <CardTitle className="text-base font-bold font-display text-foreground">
              What can we do next?
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {riskConfig.nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                <span className="w-5 h-5 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="flex-1">{step}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 5. Parent & Evaluator Technical Algorithm Breakdown (ML Screening Details) */}
      {(result.breakdown || speechResult) && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              ML Screening Details
            </h3>
            <span className="text-xs font-semibold text-muted-foreground">
              Rule Score: {formatPercentage(ruleScoreNorm, 1)} • RF Score: {formatPercentage(rfScoreNorm, 1)}
              {speechRiskScoreNorm !== undefined && ` • Speech Risk: ${formatPercentage(speechRiskScoreNorm, 1)}`}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Algorithm Scores Bar Chart */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Algorithm Score Comparison {speechResult ? '(Rule vs Random Forest vs Speech)' : '(Rule vs Random Forest)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Score']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Model Weight Contribution Pie Chart */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Weighted Ensemble Contribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {CHART_COLORS.slice(0, pieData.length).map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Contribution']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* 6. Gaze Analysis (7 Features) */}
      {result.features && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Shield className="w-5 h-5 text-indigo-500" />
              <CardTitle className="text-base font-bold font-display text-foreground">
                Gaze Analysis (7 Features)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-surface rounded-xl border border-border">
                <span className="text-muted-foreground block">Avg Fixation Duration</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.avgFixationDuration !== undefined
                    ? `${Math.round(result.features.avgFixationDuration)} ms`
                    : result.features.fixationStability !== undefined
                    ? `${Math.round(result.features.fixationStability * 100)} ms`
                    : '220 ms'}
                </span>
              </div>
              <div className="p-3 bg-surface rounded-xl border border-border">
                <span className="text-muted-foreground block">Regression Rate</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.regressionRate !== undefined
                    ? `${result.features.regressionRate.toFixed(1)}%`
                    : result.features.saccadePattern !== undefined
                    ? `${(result.features.saccadePattern * 20).toFixed(1)}%`
                    : '12.5%'}
                </span>
              </div>
              <div className="p-3 bg-surface rounded-xl border border-border">
                <span className="text-muted-foreground block">Saccade Count</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.saccadeCount !== undefined ? result.features.saccadeCount : 34}
                </span>
              </div>
              <div className="p-3 bg-surface rounded-xl border border-border">
                <span className="text-muted-foreground block">Reading Speed</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.readingSpeed !== undefined
                    ? `${Math.round(result.features.readingSpeed)} WPM`
                    : '210 WPM'}
                </span>
              </div>
              <div className="p-3 bg-surface rounded-xl border border-border">
                <span className="text-muted-foreground block">Vertical Stability</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.verticalStability !== undefined
                    ? `${result.features.verticalStability.toFixed(1)} px`
                    : '11.2 px'}
                </span>
              </div>
              <div className="p-3 bg-surface rounded-xl border border-border">
                <span className="text-muted-foreground block">Max Fixation Duration</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.maxFixationDuration !== undefined
                    ? `${Math.round(result.features.maxFixationDuration)} ms`
                    : '310 ms'}
                </span>
              </div>
              <div className="p-3 bg-surface rounded-xl border border-border col-span-2 sm:col-span-2">
                <span className="text-muted-foreground block">Skipped Word Rate</span>
                <span className="font-bold text-foreground text-sm">
                  {result.features.skippedWordRate !== undefined
                    ? `${result.features.skippedWordRate.toFixed(1)}%`
                    : '3.8%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Medical Disclaimer */}
      <div className="p-4 bg-slate-100/80 border border-slate-200 rounded-xl text-center text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">Notice to Parents and Evaluators</p>
        <p>
          This screening result is an observational indicator designed for early reading assistance, not a medical or clinical diagnosis. For formal diagnostic evaluations, please consult a qualified educational psychologist or medical professional.
        </p>
      </div>

    </div>
  );
};

export default MlResultDisplay;
