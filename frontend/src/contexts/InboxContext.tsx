/**
 * Inbox Context Provider - TypeScript Migration
 * Manages clinical inbox messages using FHIR Communication resources
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical messaging,
 * FHIR Communication resource management, and real-time inbox functionality.
 */
import * as React from 'react';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useAuth } from './AuthContext';
import { Communication } from '../types/fhir';

/**
 * Message priority levels for clinical communications
 */
export type MessagePriority = 'routine' | 'urgent' | 'asap' | 'stat';

/**
 * Message category types for classification
 */
export type MessageCategory = 'notification' | 'alert' | 'reminder' | 'instruction';

/**
 * Message status types
 */
export type MessageStatus = 'preparation' | 'in-progress' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped';

/**
 * Message payload interface
 */
export interface MessagePayload {
  content?: string;
  attachment?: any;
}

/**
 * Message reference interface for basedOn relationships
 */
export interface MessageReference {
  type?: string;
  id?: string;
}

/**
 * Transformed message interface for UI display
 */
export interface TransformedMessage {
  id: string;
  status: MessageStatus;
  priority: MessagePriority;
  category: MessageCategory;
  subject?: string;
  topic: string;
  sender?: string;
  senderType?: string;
  recipient?: string;
  recipientType?: string;
  sent?: string;
  received?: string;
  payload: MessagePayload[];
  note?: string;
  isRead: boolean;
  encounter?: string;
  basedOn: MessageReference[];
}

/**
 * Inbox filter interface for message queries
 */
export interface InboxFilters {
  status?: string;
  priority?: MessagePriority;
  category?: MessageCategory;
  unread?: boolean;
  patient_id?: string;
  sent_after?: string;
  sent_before?: string;
  limit?: number;
}

/**
 * Inbox statistics interface
 */
export interface InboxStats {
  total: number;
  unread: number;
  priority: Record<MessagePriority, number>;
  category: Record<MessageCategory, number>;
}

/**
 * Message creation data interface
 */
export interface MessageCreationData {
  priority?: MessagePriority;
  category?: MessageCategory;
  subject?: string;
  topic?: string;
  content?: string;
  recipients?: string[];
  patientId?: string;
  encounterId?: string;
  reason?: string;
}

/**
 * Inbox context interface
 */
export interface InboxContextType {
  // Current state
  messages: TransformedMessage[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  stats: InboxStats;

  // Actions
  loadInboxItems: (filters?: InboxFilters) => Promise<void>;
  loadInboxStats: () => Promise<void>;
  markInboxItemRead: (messageId: string) => Promise<void>;
  acknowledgeInboxItems: (messageIds: string[]) => Promise<void>;
  forwardInboxItems: (messageIds: string[], recipients: string[]) => Promise<void>;
  createMessage: (messageData: MessageCreationData) => Promise<any>;
}

/**
 * Create inbox context with proper typing
 */
const InboxContext = createContext<InboxContextType | undefined>(undefined);

/**
 * Custom hook to use inbox context with type safety
 */
export const useInbox = (): InboxContextType => {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return context;
};

/**
 * Inbox provider props interface
 */
export interface InboxProviderProps {
  children: ReactNode;
}

/**
 * Inbox provider component with comprehensive type safety
 */
export const InboxProvider: React.FC<InboxProviderProps> = ({ children }) => {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  
  const [messages, setMessages] = useState<TransformedMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<InboxStats>({
    total: 0,
    unread: 0,
    priority: {
      routine: 0,
      urgent: 0,
      asap: 0,
      stat: 0
    },
    category: {
      notification: 0,
      alert: 0,
      reminder: 0,
      instruction: 0
    }
  });

  /**
   * Transform FHIR Communication to internal message format
   */
  const transformFHIRCommunication = (communication: Communication): TransformedMessage => {
    return {
      id: communication.id,
      status: communication.status as MessageStatus,
      priority: (communication.priority || 'routine') as MessagePriority,
      category: (communication.category?.[0]?.coding?.[0]?.code || 'notification') as MessageCategory,
      subject: communication.subject?.reference?.split('/')[1], // Patient ID
      topic: communication.topic?.text || communication.reasonCode?.[0]?.text || 'Clinical Message',
      sender: communication.sender?.reference?.split('/')[1],
      senderType: communication.sender?.reference?.split('/')[0],
      recipient: communication.recipient?.[0]?.reference?.split('/')[1],
      recipientType: communication.recipient?.[0]?.reference?.split('/')[0],
      sent: communication.sent,
      received: communication.received,
      payload: communication.payload?.map((p: any) => ({
        content: p.contentString || p.contentReference?.display,
        attachment: p.contentAttachment
      })) || [],
      note: communication.note?.[0]?.text,
      isRead: communication.status === 'completed',
      encounter: communication.encounter?.reference?.split('/')[1],
      basedOn: communication.basedOn?.map((ref: any) => ({
        type: ref.reference?.split('/')[0],
        id: ref.reference?.split('/')[1]
      })) || []
    };
  };

  /**
   * Load inbox messages with optional filtering
   */
  const loadInboxItems = useCallback(async (filters: InboxFilters = {}): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const searchParams: Record<string, any> = {
        recipient: `Practitioner/${user?.id || (user as any)?.practitioner_id}`,
        _sort: '-sent',
        _count: filters.limit || 50
      };

      // Apply filters
      if (filters.status) {
        searchParams.status = filters.status;
      }
      if (filters.priority) {
        searchParams.priority = filters.priority;
      }
      if (filters.category) {
        searchParams.category = filters.category;
      }
      if (filters.unread) {
        searchParams.status = 'preparation,in-progress';
      }
      if (filters.patient_id) {
        searchParams.subject = `Patient/${filters.patient_id}`;
      }
      if (filters.sent_after) {
        searchParams.sent = `ge${filters.sent_after}`;
      }
      if (filters.sent_before) {
        searchParams.sent = `le${filters.sent_before}`;
      }

      const result = await fhirClient.search('Communication' as any, searchParams);
      const transformedMessages = result.resources.map((comm: any) => transformFHIRCommunication(comm as Communication));
      
      setMessages(transformedMessages);
      updateInboxStats(transformedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load inbox items';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Update inbox statistics from messages
   */
  const updateInboxStats = (msgs: TransformedMessage[]): void => {
    const newStats: InboxStats = {
      total: msgs.length,
      unread: 0,
      priority: {
        routine: 0,
        urgent: 0,
        asap: 0,
        stat: 0
      },
      category: {
        notification: 0,
        alert: 0,
        reminder: 0,
        instruction: 0
      }
    };

    msgs.forEach(msg => {
      // Count unread
      if (!msg.isRead) {
        newStats.unread++;
      }

      // Count by priority
      const priority = msg.priority || 'routine';
      if (newStats.priority[priority] !== undefined) {
        newStats.priority[priority]++;
      }

      // Count by category
      const category = msg.category || 'notification';
      if (newStats.category[category] !== undefined) {
        newStats.category[category]++;
      }
    });

    setStats(newStats);
    setUnreadCount(newStats.unread);
  };

  /**
   * Load inbox stats only (for performance)
   */
  const loadInboxStats = useCallback(async (): Promise<void> => {
    try {
      // Get counts for different statuses
      const searchParams = {
        recipient: `Practitioner/${user?.id || (user as any)?.practitioner_id}`,
        _summary: 'count'
      };

      const [totalResult, unreadResult] = await Promise.all([
        fhirClient.search('Communication' as any, searchParams),
        fhirClient.search('Communication' as any, {
          ...searchParams,
          status: 'preparation,in-progress'
        })
      ]);

      setStats(prev => ({
        ...prev,
        total: totalResult.total || 0,
        unread: unreadResult.total || 0
      }));
      setUnreadCount(unreadResult.total || 0);
    } catch (err) {
      // Silent error for stats loading
    }
  }, [user]);

  /**
   * Mark message as read
   */
  const markInboxItemRead = useCallback(async (messageId: string): Promise<void> => {
    try {
      // Get the communication resource
      const communication = await fhirClient.read('Communication' as any, messageId) as any;
      
      // Update status to completed (read)
      communication.status = 'completed';
      communication.received = communication.received || new Date().toISOString();
      
      // Update the resource
      await fhirClient.update('Communication' as any, messageId, communication);
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'completed', isRead: true, received: communication.received }
          : msg
      ));
      
      // Update stats
      setUnreadCount(prev => Math.max(0, prev - 1));
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark message as read';
      setError(errorMessage);
    }
  }, []);

  /**
   * Acknowledge multiple messages
   */
  const acknowledgeInboxItems = useCallback(async (messageIds: string[]): Promise<void> => {
    try {
      const promises = messageIds.map(id => markInboxItemRead(id));
      await Promise.all(promises);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge messages';
      setError(errorMessage);
    }
  }, [markInboxItemRead]);

  /**
   * Forward messages to other recipients
   */
  const forwardInboxItems = useCallback(async (messageIds: string[], recipients: string[]): Promise<void> => {
    try {
      for (const messageId of messageIds) {
        const originalMessage = messages.find(m => m.id === messageId);
        if (!originalMessage) continue;

        // Create forwarded message
        const forwardedMessage: Omit<Communication, 'id' | 'meta'> = {
          resourceType: 'Communication',
          status: 'preparation',
          priority: originalMessage.priority,
          category: [{
            coding: [{
              code: originalMessage.category
            }]
          }],
          subject: originalMessage.subject ? {
            reference: `Patient/${originalMessage.subject}`
          } : undefined,
          topic: {
            text: `Fwd: ${originalMessage.topic}`
          },
          sender: {
            reference: `Practitioner/${user?.id || (user as any)?.practitioner_id}`
          },
          recipient: recipients.map(r => ({
            reference: `Practitioner/${r}`
          })),
          sent: new Date().toISOString(),
          payload: originalMessage.payload.map(p => ({
            contentString: p.content
          })),
          basedOn: [{
            reference: `Communication/${messageId}`
          }]
        } as any;

        await fhirClient.create('Communication' as any, forwardedMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to forward messages';
      setError(errorMessage);
      throw err;
    }
  }, [messages, user]);

  /**
   * Create new message
   */
  const createMessage = useCallback(async (messageData: MessageCreationData): Promise<any> => {
    try {
      const communication: Omit<Communication, 'id' | 'meta'> = {
        resourceType: 'Communication',
        status: 'preparation',
        priority: messageData.priority || 'routine',
        category: messageData.category ? [{
          coding: [{
            code: messageData.category
          }]
        }] : undefined,
        subject: messageData.patientId ? {
          reference: `Patient/${messageData.patientId}`
        } : undefined,
        topic: {
          text: messageData.topic || messageData.subject
        },
        sender: {
          reference: `Practitioner/${user?.id || (user as any)?.practitioner_id}`
        },
        recipient: messageData.recipients?.map(r => ({
          reference: `Practitioner/${r}`
        })) || [],
        sent: new Date().toISOString(),
        payload: messageData.content ? [{
          contentString: messageData.content
        }] : [],
        encounter: messageData.encounterId ? {
          reference: `Encounter/${messageData.encounterId}`
        } : undefined,
        reasonCode: messageData.reason ? [{
          text: messageData.reason
        }] : undefined
      } as any;

      const result = await fhirClient.create('Communication' as any, communication);
      
      // Reload if the current user is a recipient
      if (messageData.recipients?.includes(user?.id || (user as any)?.practitioner_id)) {
        await loadInboxItems();
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create message';
      setError(errorMessage);
      throw err;
    }
  }, [user, loadInboxItems]);

  // Auto-load on mount and user change
  useEffect(() => {
    if (user) {
      loadInboxStats();
    }
  }, [user, loadInboxStats]);

  const value: InboxContextType = {
    messages,
    unreadCount,
    loading,
    error,
    stats,
    loadInboxItems,
    loadInboxStats,
    markInboxItemRead,
    acknowledgeInboxItems,
    forwardInboxItems,
    createMessage
  };

  return (
    <InboxContext.Provider value={value}>
      {children}
    </InboxContext.Provider>
  );
};

export default InboxProvider;