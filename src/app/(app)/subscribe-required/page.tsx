"use client";

import { useUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { CreditCard, ArrowRight } from "lucide-react";

/**
 * Subscribe Required Page
 *
 * Shown when user tries to access protected features without an active subscription
 * Redirected from middleware for unauthenticated users or those without active subscriptions
 */
export default function SubscribeRequiredPage() {
  const { user } = useUser();

  return (
    <div className="from-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-b px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <CreditCard className="text-primary h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Subscription Required</h1>
          <p className="text-muted-foreground text-lg">
            You need an active subscription to access this feature.
          </p>
        </div>

        {/* Content Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Plans Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>€29</span>
                <span className="text-muted-foreground text-base font-normal">/month</span>
              </CardTitle>
              <CardDescription>Starter Plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />1 Store
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                  Full Access
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                  Email Support
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>€79</span>
                <span className="text-muted-foreground text-base font-normal">/month</span>
              </CardTitle>
              <CardDescription>Pro Plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                  Unlimited Stores
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                  Advanced Features
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                  Priority Support
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="border-primary/20 bg-primary/5 space-y-4 rounded-lg border p-6 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            {user
              ? "Choose a plan to get started with your store"
              : "Sign in to subscribe and manage your store"}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {!user && (
              <Link href="/login" className="flex-1 sm:flex-auto">
                <Button variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
            )}
            <Link href="/your-plan" className="flex-1 sm:flex-auto">
              <Button className="w-full gap-2">
                View Plans
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Text */}
        <div className="text-muted-foreground space-y-2 text-center text-sm">
          <p>Have questions about our pricing?</p>
          <Link href="/contact" className="text-primary font-medium hover:underline">
            Get in touch with our sales team
          </Link>
        </div>
      </div>
    </div>
  );
}
