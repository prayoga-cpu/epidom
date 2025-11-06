/**
 * Application Configuration
 *
 * Centralized application settings and constants.
 */

/**
 * Application metadata
 */
export const appConfig = {
  name: "Epidom Dashboard",
  description: "Open-source ERP system for small food manufacturers",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  version: "1.0.0",
} as const;

/**
 * Feature flags
 */
export const features = {
  enableSubscriptions: false, // Stripe subscriptions
  enableMultiStore: true, // Multi-store support
  enableEmailVerification: false, // Email verification on signup
  enablePasswordReset: false, // Password reset flow
  enableOAuth: false, // OAuth providers (Google, GitHub, etc.)
  enableNotifications: true, // Real-time notifications
  enableAnalytics: true, // Vercel Analytics
} as const;

/**
 * Supported locales
 */
export const locales = ["en", "fr", "id"] as const;
export type Locale = (typeof locales)[number];

/**
 * Default locale
 */
export const defaultLocale: Locale = "en";

/**
 * Supported currencies
 * Note: All prices are stored in EUR (base currency) and converted for display
 */
export const currencies = ["EUR", "USD"] as const;
export type Currency = (typeof currencies)[number];

/**
 * Default currency
 */
export const defaultCurrency: Currency = "EUR";

/**
 * Pagination defaults
 */
export const pagination = {
  defaultPageSize: 20,
  maxPageSize: 100,
  pageSizeOptions: [10, 20, 50, 100],
} as const;

/**
 * File upload limits
 */
export const fileUpload = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  allowedDocumentTypes: ["application/pdf", "text/csv"],
} as const;

/**
 * Date format settings
 */
export const dateFormats = {
  display: "MMM d, yyyy", // Jan 1, 2024
  displayWithTime: "MMM d, yyyy h:mm a", // Jan 1, 2024 3:30 PM
  input: "yyyy-MM-dd", // 2024-01-01
  iso: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", // ISO 8601
} as const;

/**
 * Contact information
 */
export const contact = {
  email: "support@epidom.com",
  phone: "+1 (555) 123-4567",
  address: "123 Main St, City, Country",
} as const;

/**
 * Social media links
 */
export const socialLinks = {
  twitter: "https://twitter.com/epidom",
  github: "https://github.com/epidom/epidom",
  linkedin: "https://linkedin.com/company/epidom",
} as const;
