/**
 * PHASE 6: ErrorHandler Component
 * Display server errors and warnings from /user/queue/errors
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, X, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorPayload } from '../api/types';

export interface ErrorDisplayItem extends ErrorPayload {
  id: string;
  displayedAt: number;
}

const ERROR_AUTO_DISMISS_MS = 8000;

const SeverityConfig = {
  WARNING: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'border-yellow-300 bg-yellow-50',
    textColor: 'text-yellow-800',
    titleColor: 'text-yellow-900',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  ERROR: {
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'border-red-300 bg-red-50',
    textColor: 'text-red-800',
    titleColor: 'text-red-900',
    badge: 'bg-red-100 text-red-800',
  },
  FATAL: {
    icon: <AlertCircle className="w-5 h-5 animate-pulse" />,
    color: 'border-red-400 bg-red-100',
    textColor: 'text-red-900',
    titleColor: 'text-red-900 font-bold',
    badge: 'bg-red-200 text-red-900',
  },
};

interface ErrorHandlerProps {
  errors?: ErrorPayload[];
  onDismiss?: (errorId: string) => void;
  maxVisibleErrors?: number;
  autoDismiss?: boolean;
}

/**
 * ErrorHandler - Display and manage server errors
 */
export function ErrorHandler({
  errors = [],
  onDismiss,
  maxVisibleErrors = 3,
  autoDismiss = true,
}: ErrorHandlerProps) {
  const [displayedErrors, setDisplayedErrors] = useState<ErrorDisplayItem[]>([]);

  /**
   * Add new error to display
   */
  useEffect(() => {
    if (errors.length === 0) return;

    const latestError = errors[errors.length - 1];
    const errorId = `${latestError.errorCode}-${latestError.timestamp}`;

    // Check if error already displayed
    if (displayedErrors.some(e => e.id === errorId)) {
      return;
    }

    const displayItem: ErrorDisplayItem = {
      ...latestError,
      id: errorId,
      displayedAt: Date.now(),
    };

    setDisplayedErrors(prev => {
      const updated = [...prev, displayItem];
      // Keep only most recent errors
      return updated.slice(-maxVisibleErrors);
    });

    // Auto-dismiss if enabled
    if (autoDismiss && latestError.severity !== 'FATAL') {
      const timer = setTimeout(() => {
        handleDismiss(errorId);
      }, ERROR_AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    }
  }, [errors, maxVisibleErrors, autoDismiss, displayedErrors]);

  /**
   * Dismiss error
   */
  const handleDismiss = (errorId: string) => {
    setDisplayedErrors(prev => prev.filter(e => e.id !== errorId));
    onDismiss?.(errorId);
  };

  if (displayedErrors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
      {displayedErrors.map(error => {
        const config = SeverityConfig[error.severity];

        return (
          <Card
            key={error.id}
            className={`border-l-4 ${config.color} animate-in slide-in-from-right duration-300`}
          >
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={config.textColor}>{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold ${config.titleColor}`}>
                      {error.errorCode}
                    </h3>
                    <p className={`text-sm ${config.textColor} mt-1 break-words`}>
                      {error.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(error.id)}
                  className="flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Additional Info */}
              {error.sessionId && (
                <div className="text-xs text-gray-600 ml-8">
                  Session: <code className="bg-black bg-opacity-5 px-1 rounded">{error.sessionId.substring(0, 8)}</code>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs text-gray-500 ml-8">
                {new Date(error.timestamp).toLocaleTimeString()}
              </div>

              {/* Action Button for FATAL errors */}
              {error.severity === 'FATAL' && (
                <div className="flex gap-2 mt-3 ml-8">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDismiss(error.id)}
                    className="text-xs"
                  >
                    Acknowledge
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * useErrorHandler Hook
 * Manage errors from server
 */
export function useErrorHandler() {
  const [errors, setErrors] = useState<ErrorPayload[]>([]);

  const addError = (error: ErrorPayload) => {
    setErrors(prev => [...prev, error]);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const dismissError = (errorCode: string) => {
    setErrors(prev => prev.filter(e => e.errorCode !== errorCode));
  };

  const getLatestError = (): ErrorPayload | null => {
    return errors.length > 0 ? errors[errors.length - 1] : null;
  };

  const getFatalErrors = (): ErrorPayload[] => {
    return errors.filter(e => e.severity === 'FATAL');
  };

  const hasErrors = (): boolean => {
    return errors.length > 0;
  };

  const hasFatalErrors = (): boolean => {
    return errors.some(e => e.severity === 'FATAL');
  };

  return {
    errors,
    addError,
    clearErrors,
    dismissError,
    getLatestError,
    getFatalErrors,
    hasErrors,
    hasFatalErrors,
  };
}

export default ErrorHandler;
