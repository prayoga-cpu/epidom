"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import type {
  OnboardingCompleteResult,
  OnboardingGoal,
  OnboardingState,
} from "@/lib/onboarding/contracts";
import {
  onboardingApi,
  type SaveStoreStepBody,
  type SaveStorefrontStepBody,
} from "../lib/onboarding-api";

/**
 * One mutation per wizard step. Each resolves with what the server saved
 * (the new OnboardingState, or the publish result), which the wizard then
 * uses as its state, so a reload always resumes from the server's view.
 */

export function useSaveStoreStep() {
  const { locale } = useI18n();
  return useMutation<OnboardingState, Error, SaveStoreStepBody>({
    mutationKey: ["onboarding", "store"],
    mutationFn: (body) => onboardingApi.saveStore(body, locale),
  });
}

export function useSaveStorefrontStep() {
  return useMutation<OnboardingState, Error, Partial<SaveStorefrontStepBody>>({
    mutationKey: ["onboarding", "storefront"],
    mutationFn: (body) => onboardingApi.saveStorefront(body),
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<OnboardingCompleteResult, Error, OnboardingGoal[]>({
    mutationKey: ["onboarding", "complete"],
    mutationFn: (goals) => onboardingApi.complete(goals),
    // The account just gained a live store: whatever the session cached about
    // it (profile, stores, subscription) is stale for the pages that follow.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
