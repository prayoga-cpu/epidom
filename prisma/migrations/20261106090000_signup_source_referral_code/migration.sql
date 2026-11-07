-- A partner code typed during setup (/onboarding) credits the account to that
-- partner, like opening their ?ref= link before signing up.
ALTER TYPE "SignupSource" ADD VALUE IF NOT EXISTS 'REFERRAL_CODE';
