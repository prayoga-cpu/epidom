import type { NewsletterAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NEWSLETTER_AUDIENCES, type NewsletterLanguage } from "@/lib/newsletter/constants";
import { newsletterLocale } from "@/lib/newsletter/render";
import { signupPlanStatus } from "@/lib/services/sales-page.service";

/**
 * Who a newsletter reaches. Worked out when a campaign starts sending (and
 * for the editor's live counts), never stored ahead, so a newsletter written
 * for next month reaches whoever is free, on trial or paying on the day.
 */

type CustomerGroup = Extract<NewsletterAudience, "FREE" | "TRIAL" | "PAID">;

/**
 * Pure: an account's customer group. Overdue payers and admin-granted plans
 * count as paid (they have a paid plan); an unpaid checkout or a canceled
 * plan counts as free.
 */
export function customerGroupOf(
  subscription: Parameters<typeof signupPlanStatus>[0],
  now: Date = new Date()
): CustomerGroup {
  switch (signupPlanStatus(subscription, now)) {
    case "TRIAL":
      return "TRIAL";
    case "ACTIVE":
    case "GRANTED":
    case "PAST_DUE":
      return "PAID";
    default:
      return "FREE";
  }
}

export interface NewsletterContact {
  /** Lowercased. */
  email: string;
  locale: string;
  groups: NewsletterAudience[];
}

interface ContactSources {
  users: { email: string; locale: string; group: CustomerGroup }[];
  subscribers: { email: string; locale: string }[];
  leads: { email: string; locale: string }[];
  /** Lowercased addresses that unsubscribed. */
  unsubscribed: Set<string>;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pure: one contact per address across every list, minus unsubscribes. An
 * account's language wins over the one a form recorded.
 */
export function mergeNewsletterContacts(sources: ContactSources): NewsletterContact[] {
  const byEmail = new Map<string, NewsletterContact>();
  const add = (rawEmail: string, locale: string, group: NewsletterAudience) => {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(email) || sources.unsubscribed.has(email)) return;
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, { email, locale, groups: [group] });
    } else if (!existing.groups.includes(group)) {
      existing.groups.push(group);
    }
  };
  for (const user of sources.users) add(user.email, user.locale, user.group);
  for (const subscriber of sources.subscribers)
    add(subscriber.email, subscriber.locale, "SUBSCRIBERS");
  for (const lead of sources.leads) add(lead.email, lead.locale, "LEADS");
  return [...byEmail.values()];
}

function matchesLanguage(contact: NewsletterContact, language: NewsletterLanguage): boolean {
  return language === "all" || newsletterLocale(contact.locale) === language;
}

/** Pure: the contacts a campaign with these audiences and language goes to. */
export function selectRecipients(
  contacts: NewsletterContact[],
  audiences: readonly NewsletterAudience[],
  language: NewsletterLanguage
): NewsletterContact[] {
  return contacts.filter(
    (contact) =>
      contact.groups.some((group) => audiences.includes(group)) &&
      matchesLanguage(contact, language)
  );
}

/** Pure: how many contacts each audience holds in this language (an address can be in two). */
export function countByAudience(
  contacts: NewsletterContact[],
  language: NewsletterLanguage
): Record<NewsletterAudience, number> {
  const counts = Object.fromEntries(NEWSLETTER_AUDIENCES.map((a) => [a, 0])) as Record<
    NewsletterAudience,
    number
  >;
  for (const contact of contacts) {
    if (!matchesLanguage(contact, language)) continue;
    for (const group of contact.groups) counts[group] += 1;
  }
  return counts;
}

/**
 * Every reachable contact, from the database. Accounts must be verified and
 * not deactivated; a staff-only login (no business of its own) is not a
 * customer and is left out.
 */
export async function loadNewsletterContacts(now: Date = new Date()): Promise<NewsletterContact[]> {
  const [users, subscribers, leads, unsubscribes] = await Promise.all([
    prisma.user.findMany({
      where: { emailVerified: true, deactivatedAt: null },
      select: {
        email: true,
        locale: true,
        business: { select: { id: true } },
        staffMember: { select: { role: true } },
        subscription: {
          select: { plan: true, status: true, trialEndsAt: true, stripeSubscriptionId: true },
        },
      },
    }),
    prisma.newsletterSubscriber.findMany({ select: { email: true, locale: true } }),
    // Newest first, so a lead who filled the form twice keeps their latest language.
    prisma.salesLead.findMany({
      select: { email: true, locale: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.newsletterUnsubscribe.findMany({ select: { email: true } }),
  ]);

  // A login made for a staff invite, current or former, with no business of
  // its own: never a customer. (The OWNER row belongs to an owner.)
  const isStaffOnly = (user: (typeof users)[number]) =>
    !user.business && !!user.staffMember && user.staffMember.role !== "OWNER";

  return mergeNewsletterContacts({
    users: users
      .filter((user) => !isStaffOnly(user))
      .map((user) => ({
        email: user.email,
        locale: user.locale,
        group: customerGroupOf(user.subscription, now),
      })),
    subscribers,
    leads,
    unsubscribed: new Set(unsubscribes.map((u) => u.email.toLowerCase())),
  });
}
