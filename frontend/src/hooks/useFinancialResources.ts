/**
 * Financial Resources Hooks
 * Comprehensive hooks for managing all financial-related FHIR resources
 * Includes Coverage, Claim, ExplanationOfBenefit, and Account resources
 * 
 * Migrated to TypeScript with comprehensive type safety using FHIR R4 types.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { usePatientResourceType, ResourceHookResult } from './useFHIRResources';

/**
 * Type definitions for financial resources
 */
export interface FinancialSummary {
  coverage: {
    total: number;
    active: number;
    primary: number;
  };
  claims: {
    total: number;
    recent: number;
    byStatus: Record<string, number>;
  };
  explanationOfBenefits: {
    total: number;
    byStatus: Record<string, number>;
    totalPayments: number;
  };
  accounts: {
    total: number;
    active: number;
    totalBalance: number;
  };
  adjudications: {
    totalCharged: number;
    totalPaid: number;
    totalPatientResponsibility: number;
    totalOutstanding: number;
  };
}

export interface FinancialResourcesHookResult {
  // Resources
  coverage: ResourceHookResult<R4.ICoverage>;
  claims: ResourceHookResult<R4.IClaim>;
  explanationOfBenefits: ResourceHookResult<R4.IExplanationOfBenefit>;
  accounts: ResourceHookResult<R4.IAccount>;
  
  // Analysis
  activeCoverage: R4.ICoverage[];
  primaryCoverage: R4.ICoverage | undefined;
  claimsByStatus: Record<string, R4.IClaim[]>;
  recentClaims: R4.IClaim[];
  eobsByStatus: Record<string, R4.IExplanationOfBenefit[]>;
  totalPayments: number;
  totalAdjudications: {
    totalCharged: number;
    totalPaid: number;
    totalPatientResponsibility: number;
    totalOutstanding: number;
  };
  activeAccounts: R4.IAccount[];
  accountBalances: number;
  financialSummary: FinancialSummary | null;
  
  // State
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isEmpty: boolean;
}

export interface CoverageHookResult extends ResourceHookResult<R4.ICoverage> {
  coverage: R4.ICoverage[];
  activeCoverage: R4.ICoverage[];
  primaryCoverage: R4.ICoverage | undefined;
  coverageByPayer: Record<string, R4.ICoverage[]>;
}

/**
 * Hook for managing all financial-related FHIR resources
 * Includes Coverage, Claim, ExplanationOfBenefit, and Account resources
 */
export function useFinancialResources(patientId: string | null, autoLoad: boolean = true): FinancialResourcesHookResult {
  const coverage = usePatientResourceType<R4.ICoverage>(patientId, 'Coverage', autoLoad);
  const claims = usePatientResourceType<R4.IClaim>(patientId, 'Claim', autoLoad);
  const explanationOfBenefits = usePatientResourceType<R4.IExplanationOfBenefit>(patientId, 'ExplanationOfBenefit', autoLoad);
  const accounts = usePatientResourceType<R4.IAccount>(patientId, 'Account', autoLoad);

  const loading = coverage.loading || claims.loading || explanationOfBenefits.loading || accounts.loading;
  const error = coverage.error || claims.error || explanationOfBenefits.error || accounts.error;

  // Coverage analysis
  const activeCoverage = useMemo((): R4.ICoverage[] => {
    const now = new Date();
    return coverage.resources.filter(cov => {
      if (cov.status !== 'active') return false;
      
      if (cov.period) {
        const start = cov.period.start ? new Date(cov.period.start) : null;
        const end = cov.period.end ? new Date(cov.period.end) : null;
        
        if (start && now < start) return false;
        if (end && now > end) return false;
      }
      
      return true;
    });
  }, [coverage.resources]);

  const primaryCoverage = useMemo((): R4.ICoverage | undefined => {
    return activeCoverage.find(cov => cov.order === 1) || activeCoverage[0];
  }, [activeCoverage]);

  // Claims analysis
  const claimsByStatus = useMemo((): Record<string, R4.IClaim[]> => {
    const grouped: Record<string, R4.IClaim[]> = {};
    claims.resources.forEach(claim => {
      const status = claim.status || 'unknown';
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(claim);
    });
    return grouped;
  }, [claims.resources]);

  const recentClaims = useMemo((): R4.IClaim[] => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return claims.resources.filter(claim => {
      const claimDate = new Date(claim.created || claim.meta?.lastUpdated || '1970-01-01');
      return claimDate >= sixMonthsAgo;
    }).sort((a, b) => {
      const dateA = new Date(a.created || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.created || b.meta?.lastUpdated || '1970-01-01');
      return dateB.getTime() - dateA.getTime();
    });
  }, [claims.resources]);

  // EOB analysis
  const eobsByStatus = useMemo((): Record<string, R4.IExplanationOfBenefit[]> => {
    const grouped: Record<string, R4.IExplanationOfBenefit[]> = {};
    explanationOfBenefits.resources.forEach(eob => {
      const status = eob.status || 'unknown';
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(eob);
    });
    return grouped;
  }, [explanationOfBenefits.resources]);

  const totalPayments = useMemo((): number => {
    return explanationOfBenefits.resources.reduce((total, eob) => {
      const payment = eob.payment?.amount?.value || 0;
      return total + payment;
    }, 0);
  }, [explanationOfBenefits.resources]);

  const totalAdjudications = useMemo(() => {
    let totalCharged = 0;
    let totalPaid = 0;
    let totalPatientResponsibility = 0;

    explanationOfBenefits.resources.forEach(eob => {
      eob.item?.forEach(item => {
        // Sum up adjudications
        item.adjudication?.forEach(adj => {
          const category = adj.category?.coding?.[0]?.code;
          const amount = adj.amount?.value || 0;
          
          switch (category) {
            case 'submitted':
            case 'eligible':
              totalCharged += amount;
              break;
            case 'benefit':
            case 'paid':
              totalPaid += amount;
              break;
            case 'deductible':
            case 'copay':
            case 'coinsurance':
              totalPatientResponsibility += amount;
              break;
          }
        });
      });
    });

    return {
      totalCharged,
      totalPaid,
      totalPatientResponsibility,
      totalOutstanding: totalCharged - totalPaid - totalPatientResponsibility
    };
  }, [explanationOfBenefits.resources]);

  // Account analysis
  const activeAccounts = useMemo((): R4.IAccount[] => {
    return accounts.resources.filter(account => account.status === 'active');
  }, [accounts.resources]);

  const accountBalances = useMemo((): number => {
    return accounts.resources.reduce((total, account) => {
      const balance = account.balance?.[0]?.amount?.value || 0;
      return total + balance;
    }, 0);
  }, [accounts.resources]);

  // Financial summary
  const financialSummary = useMemo((): FinancialSummary | null => {
    if (loading) return null;

    return {
      coverage: {
        total: coverage.resources.length,
        active: activeCoverage.length,
        primary: primaryCoverage ? 1 : 0
      },
      claims: {
        total: claims.resources.length,
        recent: recentClaims.length,
        byStatus: Object.keys(claimsByStatus).reduce((acc, status) => {
          acc[status] = claimsByStatus[status].length;
          return acc;
        }, {} as Record<string, number>)
      },
      explanationOfBenefits: {
        total: explanationOfBenefits.resources.length,
        byStatus: Object.keys(eobsByStatus).reduce((acc, status) => {
          acc[status] = eobsByStatus[status].length;
          return acc;
        }, {} as Record<string, number>),
        totalPayments
      },
      accounts: {
        total: accounts.resources.length,
        active: activeAccounts.length,
        totalBalance: accountBalances
      },
      adjudications: totalAdjudications
    };
  }, [
    loading, coverage.resources.length, activeCoverage.length, primaryCoverage,
    claims.resources.length, recentClaims.length, claimsByStatus,
    explanationOfBenefits.resources.length, eobsByStatus, totalPayments,
    accounts.resources.length, activeAccounts.length, accountBalances,
    totalAdjudications
  ]);

  // Refresh all financial resources
  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      coverage.refresh(),
      claims.refresh(),
      explanationOfBenefits.refresh(),
      accounts.refresh()
    ]);
  }, [coverage.refresh, claims.refresh, explanationOfBenefits.refresh, accounts.refresh]);

  return {
    // Resources
    coverage,
    claims,
    explanationOfBenefits,
    accounts,
    
    // Analysis
    activeCoverage,
    primaryCoverage,
    claimsByStatus,
    recentClaims,
    eobsByStatus,
    totalPayments,
    totalAdjudications,
    activeAccounts,
    accountBalances,
    financialSummary,
    
    // State
    loading,
    error,
    refresh,
    isEmpty: !loading && coverage.resources.length === 0 && claims.resources.length === 0 && 
             explanationOfBenefits.resources.length === 0 && accounts.resources.length === 0
  };
}

/**
 * Hook for managing coverage/insurance specifically
 */
export function useCoverage(patientId: string | null, autoLoad: boolean = true): CoverageHookResult {
  const baseHook = usePatientResourceType<R4.ICoverage>(patientId, 'Coverage', autoLoad);
  
  const coverage = useMemo((): R4.ICoverage[] => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.period?.start || b.meta?.lastUpdated || '1970-01-01');
      return dateB.getTime() - dateA.getTime();
    });
  }, [baseHook.resources]);

  const activeCoverage = useMemo((): R4.ICoverage[] => {
    const now = new Date();
    return coverage.filter(cov => {
      if (cov.status !== 'active') return false;
      
      if (cov.period) {
        const start = cov.period.start ? new Date(cov.period.start) : null;
        const end = cov.period.end ? new Date(cov.period.end) : null;
        
        if (start && now < start) return false;
        if (end && now > end) return false;
      }
      
      return true;
    });
  }, [coverage]);

  const primaryCoverage = useMemo((): R4.ICoverage | undefined => {
    return activeCoverage.find(cov => cov.order === 1) || activeCoverage[0];
  }, [activeCoverage]);

  const coverageByPayer = useMemo((): Record<string, R4.ICoverage[]> => {
    const grouped: Record<string, R4.ICoverage[]> = {};
    coverage.forEach(cov => {
      const payer = cov.payor?.[0]?.display || 'Unknown Payer';
      if (!grouped[payer]) grouped[payer] = [];
      grouped[payer].push(cov);
    });
    return grouped;
  }, [coverage]);

  return {
    ...baseHook,
    coverage,
    activeCoverage,
    primaryCoverage,
    coverageByPayer
  };
}

export default useFinancialResources;