/**
 * React Query Hook for AI Import
 *
 * Provides all mutations and queries for the Smart Import feature.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportAnalysisResult } from "@/lib/ai/import/types";

// ============================================================================
// Types
// ============================================================================

export interface AnalyzeResponse {
  success: boolean;
  sessionId: string;
  analysis: ImportAnalysisResult;
  parsedData: Array<Record<string, string>>;
  headers: string[];
  metrics: {
    aiCallCount: number;
    totalTokens: number;
    estimatedCost: number;
    processingTimeMs: number;
  };
}

export interface ExecuteResponse {
  success: boolean;
  sessionId: string;
  summary: {
    suppliers: { attempted: number; succeeded: number };
    materials: { attempted: number; succeeded: number };
    recipes: { attempted: number; succeeded: number };
    products: { attempted: number; succeeded: number };
    totalSucceeded: number;
  };
  error?: string;
}

export interface ImportSession {
  id: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  entityType: string | null;
  status: string;
  aiCallCount: number;
  totalTokens: number;
  processingTimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionsResponse {
  sessions: ImportSession[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    totalRowsImported: number;
    totalTokensUsed: number;
  };
}

// ============================================================================
// Query Keys
// ============================================================================

export const aiImportKeys = {
  all: ["ai-import"] as const,
  sessions: (storeId: string) => [...aiImportKeys.all, "sessions", storeId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to analyze CSV with AI
 */
export function useAnalyzeImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      storeId: string;
      csvContent: string;
      entityType?: "material" | "product" | "supplier" | "recipe";
      fileName?: string;
    }): Promise<AnalyzeResponse> => {
      const response = await fetch("/api/ai/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Analysis failed");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate sessions to show new session
      queryClient.invalidateQueries({
        queryKey: aiImportKeys.sessions(variables.storeId),
      });
    },
  });
}

/**
 * Hook to execute the import with decisions
 */
export function useExecuteImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      storeId: string;
      entityType: "material" | "product" | "supplier" | "recipe";
      data: Array<Record<string, unknown>>;
      decisions?: Array<{
        rowIndex: number;
        action: "IMPORT" | "SKIP" | "UPDATE" | "MERGE";
        targetId?: string;
        overrides?: Record<string, unknown>;
      }>;
      mappingCorrections?: Array<{
        sourceColumn: string;
        originalMapping: string;
        correctedMapping: string;
      }>;
    }): Promise<ExecuteResponse> => {
      const response = await fetch("/api/ai/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }

      return response.json();
    },
    onSuccess: async (_, variables) => {
      const { storeId } = variables;

      // Invalidate entity data with specific store keys for reliability
      // refetchType: "all" forces background refresh even for inactive tabs (like Products)
      // preventing the "stale data on tab switch" issue caused by refetchOnMount: false
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["materials", storeId], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["products", storeId], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["suppliers", storeId], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["recipes", storeId], refetchType: "all" }),
        // Invalidate sessions
        queryClient.invalidateQueries({ queryKey: aiImportKeys.sessions(storeId) }),
      ]);
    },
  });
}

/**
 * Hook to save user feedback/corrections
 */
export function useSaveFeedback() {
  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      storeId: string;
      entityType: "material" | "product" | "supplier" | "recipe";
      feedback: Array<{
        type:
          | "FIELD_MAPPING"
          | "TYPO_CORRECTION"
          | "CATEGORY_NORMALIZATION"
          | "UNIT_NORMALIZATION"
          | "SUPPLIER_ALIAS"
          | "MATERIAL_ALIAS";
        sourcePattern: string;
        aiSuggestion?: string;
        userCorrection: string;
        wasCorrect: boolean;
        memoryId?: string;
      }>;
    }) => {
      const response = await fetch("/api/ai/import/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save feedback");
      }

      return response.json();
    },
  });
}

/**
 * Hook to fetch import sessions history
 */
export function useImportSessions(storeId: string, options?: { limit?: number }) {
  return useQuery({
    queryKey: aiImportKeys.sessions(storeId),
    queryFn: async (): Promise<SessionsResponse> => {
      const params = new URLSearchParams({ storeId });
      if (options?.limit) {
        params.append("limit", String(options.limit));
      }

      const response = await fetch(`/api/ai/import/sessions?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch sessions");
      }

      return response.json();
    },
    enabled: !!storeId,
  });
}
