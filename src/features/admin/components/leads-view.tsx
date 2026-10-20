"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SalesLead = {
  id: string;
  page: string;
  locale: string;
  source: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  createdAt: string;
};

type Subscriber = {
  id: string;
  email: string;
  source: string;
  page: string | null;
  locale: string;
  createdAt: string;
};

type Tab = "all" | "sales" | "newsletter";

export function LeadsView() {
  const [tab, setTab] = useState<Tab>("all");
  const [salesLeads, setSalesLeads] = useState<SalesLead[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const typeParam = tab === "all" ? "" : tab === "sales" ? "?type=sales" : "?type=newsletter";
      const res = await fetch(`/api/admin/leads${typeParam}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const json = await res.json();
      setSalesLeads(json.data?.salesLeads ?? []);
      setSubscribers(json.data?.subscribers ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sales leads (popup form) and newsletter subscribers.
        </p>
      </div>

      <div className="flex gap-2">
        {(["all", "sales", "newsletter"] as Tab[]).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t)}
          >
            {t === "all" ? "All" : t === "sales" ? "Sales leads" : "Newsletter"}
          </Button>
        ))}
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!loading && !error && (tab === "all" || tab === "sales") && salesLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Sales Leads{" "}
              <Badge variant="secondary" className="ml-2">{salesLeads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 text-left font-medium">Name</th>
                  <th className="py-2 pr-4 text-left font-medium">Email</th>
                  <th className="py-2 pr-4 text-left font-medium">Phone</th>
                  <th className="py-2 pr-4 text-left font-medium">Page</th>
                  <th className="py-2 pr-4 text-left font-medium">Source</th>
                  <th className="py-2 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {salesLeads.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{l.firstName} {l.lastName}</td>
                    <td className="py-2 pr-4">{l.email}</td>
                    <td className="py-2 pr-4">{l.phone}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-xs">{l.page}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{l.source}</td>
                    <td className="py-2 text-muted-foreground text-xs">{fmt(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (tab === "all" || tab === "newsletter") && subscribers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Newsletter Subscribers{" "}
              <Badge variant="secondary" className="ml-2">{subscribers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 text-left font-medium">Email</th>
                  <th className="py-2 pr-4 text-left font-medium">Source</th>
                  <th className="py-2 pr-4 text-left font-medium">Page</th>
                  <th className="py-2 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{s.email}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{s.source}</td>
                    <td className="py-2 pr-4">
                      {s.page && <Badge variant="outline" className="text-xs">{s.page}</Badge>}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">{fmt(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {!loading && !error && salesLeads.length === 0 && subscribers.length === 0 && (
        <p className="text-muted-foreground text-sm">No leads yet.</p>
      )}
    </div>
  );
}
