/**
 * CDS Hook Manager
 * Manages CDS hooks firing at different workflow points with appropriate presentation modes
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS Hooks integration.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import CDSPresentation, { PRESENTATION_MODES } from './CDSPresentation';
import { cdsLogger } from '../../../config/logging';

/**
 * Type definitions for CDSHookManager component
 */
export type HookType = 
  | 'patient-view' 
  | 'medication-prescribe' 
  | 'order-sign' 
  | 'order-select' 
  | 'encounter-start' 
  | 'encounter-discharge';

export type WorkflowTrigger = 
  | 'PATIENT_OPENED' 
  | 'MEDICATION_PRESCRIBING' 
  | 'ORDER_SIGNING' 
  | 'ORDER_SELECTING' 
  | 'ENCOUNTER_STARTING' 
  | 'ENCOUNTER_DISCHARGE' 
  | 'LAB_REVIEW' 
  | 'VITAL_ENTRY';

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export type PresentationPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface HookPresentationConfig {
  mode: string;
  position: PresentationPosition;
  autoHide: boolean;
  maxAlerts: number;
  priority: AlertPriority;
}

export interface CDSCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CDSSuggestion[];
  links?: CDSLink[];
  serviceId?: string;
  serviceTitle?: string;
}

export interface CDSSuggestion {
  uuid: string;
  label: string;
  actions?: CDSAction[];
}

export interface CDSAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: any;
}

export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

export interface HookRequest {
  hook: HookType;
  hookInstance: string;
  context: {
    patientId: string;
    userId: string;
    encounterId?: string | null;
    [key: string]: any;
  };
}

export interface HookResponse {
  cards?: CDSCard[];
  systemActions?: any[];
}

export interface CDSService {
  id: string;
  hook: HookType;
  title: string;
  description: string;
  prefetch?: Record<string, string>;
}

export interface AlertsByMode {
  [mode: string]: CDSCard[];
}

export interface ActiveAlerts {
  [hookType: string]: AlertsByMode;
}

export interface CDSHookManagerProps {
  patientId: string;
  userId?: string;
  encounterId?: string | null;
  currentHook?: HookType;
  context?: Record<string, any>;
  onHookFired?: (hookType: HookType, alerts: CDSCard[]) => void;
  onAlertAction?: (alert: CDSCard, action: string, suggestion?: CDSSuggestion) => void;
  disabled?: boolean;
  debugMode?: boolean;
}

export interface CDSHookManagerAPI {
  triggerHook: (trigger: WorkflowTrigger, contextData?: Record<string, any>) => Promise<void>;
  clearAlerts: (hookType: HookType) => void;
  fireHooks: (hookType: HookType, hookContext?: Record<string, any>) => Promise<void>;
  getActiveAlerts: () => ActiveAlerts;
  isLoading: boolean;
  error: string | null;
  WORKFLOW_TRIGGERS: Record<WorkflowTrigger, HookType>;
  PRESENTATION_MODES: any;
}

export interface FeedbackEntry {
  card: string;
  outcome: 'accepted' | 'overridden' | 'ignored';
  acceptedSuggestions?: Array<{ id: string }>;
  overrideReasons?: Array<{ reason: { code: string; display: string } }>;
}

export interface CDSFeedback {
  feedback: FeedbackEntry[];
}

/**
 * Hook types and their recommended presentation modes according to CDS Hooks best practices
 */
export const HOOK_PRESENTATION_CONFIG: Record<HookType, HookPresentationConfig> = {
  'patient-view': {
    mode: PRESENTATION_MODES.INLINE,
    position: 'top',
    autoHide: false,
    maxAlerts: 5,
    priority: 'medium'
  },
  'medication-prescribe': {
    mode: PRESENTATION_MODES.POPUP,
    position: 'center',
    autoHide: false,
    maxAlerts: 10,
    priority: 'high'
  },
  'order-sign': {
    mode: PRESENTATION_MODES.BANNER,
    position: 'top',
    autoHide: false,
    maxAlerts: 3,
    priority: 'critical'
  },
  'order-select': {
    mode: PRESENTATION_MODES.SIDEBAR,
    position: 'right',
    autoHide: false,
    maxAlerts: 5,
    priority: 'medium'
  },
  'encounter-start': {
    mode: PRESENTATION_MODES.DRAWER,
    position: 'right',
    autoHide: false,
    maxAlerts: 7,
    priority: 'medium'
  },
  'encounter-discharge': {
    mode: PRESENTATION_MODES.POPUP,
    position: 'center',
    autoHide: false,
    maxAlerts: 5,
    priority: 'high'
  }
};

/**
 * Workflow trigger points where hooks should fire
 */
export const WORKFLOW_TRIGGERS: Record<WorkflowTrigger, HookType> = {
  PATIENT_OPENED: 'patient-view',
  MEDICATION_PRESCRIBING: 'medication-prescribe', 
  ORDER_SIGNING: 'order-sign',
  ORDER_SELECTING: 'order-select',
  ENCOUNTER_STARTING: 'encounter-start',
  ENCOUNTER_DISCHARGE: 'encounter-discharge',
  LAB_REVIEW: 'patient-view', // Can reuse patient-view for lab review
  VITAL_ENTRY: 'patient-view'  // Can reuse patient-view for vital entry
};

/**
 * Helper functions
 */
const createContextKey = (hookType: HookType, patientId: string, hookContext: Record<string, any>): string => {
  return JSON.stringify({ hookType, patientId, hookContext });
};

const createHookRequest = (
  hookType: HookType, 
  serviceId: string, 
  patientId: string, 
  userId: string, 
  encounterId?: string | null, 
  hookContext: Record<string, any> = {}
): HookRequest => {
  return {
    hook: hookType,
    hookInstance: `${serviceId}-${Date.now()}`,
    context: {
      patientId,
      userId,
      encounterId,
      ...hookContext
    }
  };
};

const createFeedback = (
  alert: CDSCard, 
  action: string, 
  suggestion?: CDSSuggestion
): CDSFeedback => {
  const feedbackEntry: FeedbackEntry = {
    card: alert.uuid,
    outcome: action === 'accept' ? 'accepted' : action === 'reject' ? 'overridden' : 'ignored'
  };

  if (action === 'accept' && suggestion) {
    feedbackEntry.acceptedSuggestions = [{ id: suggestion.uuid }];
  }

  if (action === 'reject') {
    feedbackEntry.overrideReasons = [{ 
      reason: { 
        code: 'user-preference', 
        display: 'User preference' 
      } 
    }];
  }

  return { feedback: [feedbackEntry] };
};

/**
 * CDSHookManager Component
 */
const CDSHookManager: React.FC<CDSHookManagerProps> = ({ 
  patientId,
  userId = 'current-user',
  encounterId = null,
  currentHook = 'patient-view',
  context = {},
  onHookFired = null,
  onAlertAction = null,
  disabled = false,
  debugMode = false
}) => {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlerts>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastContextRef = useRef<string | null>(null);
  const hookTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced hook firing to prevent excessive calls
  const fireHooksDebounced = useCallback(async (
    hookType: HookType, 
    hookContext: Record<string, any>, 
    delay: number = 500
  ): Promise<void> => {
    if (hookTimeoutRef.current) {
      clearTimeout(hookTimeoutRef.current);
    }

    hookTimeoutRef.current = setTimeout(async () => {
      await fireHooks(hookType, hookContext);
    }, delay);
  }, []);

  const fireHooks = useCallback(async (
    hookType: HookType, 
    hookContext: Record<string, any> = {}
  ): Promise<void> => {
    if (disabled || !patientId) {
      cdsLogger.debug('CDS hooks disabled or no patient ID');
      return;
    }

    const contextKey = createContextKey(hookType, patientId, hookContext);
    if (lastContextRef.current === contextKey) {
      cdsLogger.debug('Same context, skipping hook fire');
      return;
    }
    lastContextRef.current = contextKey;

    setLoading(true);
    setError(null);

    try {
      cdsLogger.info(`Firing CDS hooks for: ${hookType}`, {
        patientId,
        userId,
        encounterId,
        context: hookContext
      });

      let alerts: CDSCard[] = [];
      
      switch (hookType) {
        case 'patient-view':
          alerts = await cdsHooksClient.firePatientView(patientId, userId, encounterId);
          break;
          
        case 'medication-prescribe':
          alerts = await cdsHooksClient.fireMedicationPrescribe(
            patientId, 
            userId, 
            hookContext.medications || []
          );
          break;
          
        case 'order-sign':
          alerts = await cdsHooksClient.fireOrderSign(
            patientId,
            userId,
            hookContext.orders || []
          );
          break;
          
        default:
          // For other hook types, use generic execution
          const services: CDSService[] = await cdsHooksClient.discoverServices();
          const matchingServices = services.filter(s => s.hook === hookType);
          
          cdsLogger.debug(`Found ${matchingServices.length} services for ${hookType}`);
          
          const allCards: CDSCard[] = [];
          for (const service of matchingServices) {
            const hookRequest = createHookRequest(
              hookType, 
              service.id, 
              patientId, 
              userId, 
              encounterId, 
              hookContext
            );
            
            const result: HookResponse = await cdsHooksClient.executeHook(service.id, hookRequest);
            if (result.cards && result.cards.length > 0) {
              allCards.push(...result.cards.map(card => ({
                ...card,
                serviceId: service.id,
                serviceTitle: service.title
              })));
            }
          }
          alerts = allCards;
          break;
      }

      cdsLogger.info(`Received ${alerts.length} CDS alerts for ${hookType}`);
      cdsLogger.debug('CDS alerts details:', alerts);

      // Group alerts by presentation mode
      const alertsByMode: AlertsByMode = {};
      alerts.forEach(alert => {
        const config = HOOK_PRESENTATION_CONFIG[hookType] || HOOK_PRESENTATION_CONFIG['patient-view'];
        const mode = config.mode;
        
        if (!alertsByMode[mode]) {
          alertsByMode[mode] = [];
        }
        alertsByMode[mode].push(alert);
      });

      setActiveAlerts(prev => ({
        ...prev,
        [hookType]: alertsByMode
      }));

      if (onHookFired) {
        onHookFired(hookType, alerts);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      cdsLogger.error(`Error firing CDS hooks for ${hookType}:`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [patientId, userId, encounterId, disabled, onHookFired, debugMode]);

  // Fire hooks when dependencies change
  useEffect(() => {
    if (currentHook && patientId) {
      fireHooksDebounced(currentHook, context);
    }
  }, [currentHook, patientId, userId, encounterId, context, fireHooksDebounced]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hookTimeoutRef.current) {
        clearTimeout(hookTimeoutRef.current);
      }
    };
  }, []);

  // API for external components to trigger specific hooks
  const triggerHook = useCallback(async (
    trigger: WorkflowTrigger, 
    contextData: Record<string, any> = {}
  ): Promise<void> => {
    const hookType = WORKFLOW_TRIGGERS[trigger];
    if (hookType) {
      await fireHooks(hookType, contextData);
    } else {
      console.warn(`Unknown workflow trigger: ${trigger}`);
    }
  }, [fireHooks]);

  // Clear alerts for a specific hook
  const clearAlerts = useCallback((hookType: HookType): void => {
    setActiveAlerts(prev => {
      const newAlerts = { ...prev };
      delete newAlerts[hookType];
      return newAlerts;
    });
  }, []);

  // Handle alert actions with feedback to CDS services
  const handleAlertAction = useCallback(async (
    alert: CDSCard, 
    action: string, 
    suggestion?: CDSSuggestion
  ): Promise<void> => {
    cdsLogger.info('CDS Alert Action:', { 
      alertId: alert.uuid, 
      action, 
      suggestionId: suggestion?.uuid 
    });

    // Send feedback to CDS service if supported
    if (alert.serviceId && alert.serviceId !== 'unknown-service') {
      try {
        const feedback = createFeedback(alert, action, suggestion);

        await cdsHooksClient.httpClient.post(`/cds-services/${alert.serviceId}/feedback`, feedback);
        
        cdsLogger.debug('Feedback sent to CDS service:', feedback);
      } catch (err) {
        cdsLogger.warn('Failed to send CDS feedback:', err);
      }
    }

    if (onAlertAction) {
      onAlertAction(alert, action, suggestion);
    }
  }, [onAlertAction, debugMode]);

  // Render alerts for current hook
  const renderAlertsForHook = useCallback((hookType: HookType): React.ReactNode[] | null => {
    const hookAlerts = activeAlerts[hookType];
    if (!hookAlerts) return null;

    const config = HOOK_PRESENTATION_CONFIG[hookType] || HOOK_PRESENTATION_CONFIG['patient-view'];

    return Object.entries(hookAlerts).map(([mode, alerts]) => (
      <CDSPresentation
        key={`${hookType}-${mode}`}
        alerts={alerts}
        mode={mode}
        position={config.position}
        autoHide={config.autoHide}
        maxAlerts={config.maxAlerts}
        onAlertAction={handleAlertAction}
        allowInteraction={true}
        patientId={patientId}
      />
    ));
  }, [activeAlerts, handleAlertAction, patientId]);

  // Public API for external components
  const api: CDSHookManagerAPI = {
    triggerHook,
    clearAlerts,
    fireHooks,
    getActiveAlerts: () => activeAlerts,
    isLoading: loading,
    error: error,
    WORKFLOW_TRIGGERS,
    PRESENTATION_MODES
  };

  // Attach API to window for debugging
  useEffect(() => {
    if (debugMode && typeof window !== 'undefined') {
      (window as any).cdsHookManager = api;
    }
  }, [debugMode, api]);

  return (
    <>
      {/* Render alerts for current hook */}
      {renderAlertsForHook(currentHook)}
      
      {/* Render alerts for other active hooks */}
      {Object.keys(activeAlerts)
        .filter(hookType => hookType !== currentHook)
        .map(hookType => renderAlertsForHook(hookType as HookType))
      }
      
      {/* Error display */}
      {error && debugMode && (
        <div style={{ 
          position: 'fixed', 
          bottom: 10, 
          right: 10, 
          background: 'red', 
          color: 'white', 
          padding: '10px',
          borderRadius: '4px',
          zIndex: 9999
        }}>
          CDS Error: {error}
        </div>
      )}
    </>
  );
};

export default CDSHookManager;
export { WORKFLOW_TRIGGERS, HOOK_PRESENTATION_CONFIG };