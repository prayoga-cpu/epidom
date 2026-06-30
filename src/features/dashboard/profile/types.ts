export interface ProfileData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  phone: string | null;
  locale: "en" | "fr" | "id" | undefined;
  timezone: string;
  currency: string;
  defaultLanding: string;
  createdAt: Date;
  business: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  } | null;
  subscription: {
    plan: string;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}
