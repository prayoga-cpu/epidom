"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, AlertCircle, Eye, EyeOff, Users, Mail } from "lucide-react";

type Lead = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Subscriber = {
  id: string;
  email: string;
};

export function NewsletterBroadcastView() {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [broadcastId, setBroadcastId] = useState("");

  // Recipient toggles
  const [useAudience, setUseAudience] = useState(true);
  const [useLeads, setUseLeads] = useState(false);
  const [useSubscribers, setUseSubscribers] = useState(false);

  // Loaded contacts for individual selection
  const [leads, setLeads] = useState<Lead[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!useLeads && !useSubscribers) return;
    setLoadingContacts(true);
    fetch("/api/admin/leads")
      .then((r) => r.json())
      .then((json) => {
        setLeads(json.data?.salesLeads ?? []);
        setSubscribers(json.data?.subscribers ?? []);
        if (useLeads) {
          setSelectedLeads(new Set((json.data?.salesLeads ?? []).map((l: Lead) => l.email)));
        }
        if (useSubscribers) {
          setSelectedSubs(new Set((json.data?.subscribers ?? []).map((s: Subscriber) => s.email)));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLeads, useSubscribers]);

  const toggleLead = (email: string) =>
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });

  const toggleSub = (email: string) =>
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });

  const customEmails = (): string[] => {
    const set = new Set<string>();
    if (useLeads) leads.filter((l) => selectedLeads.has(l.email)).forEach((l) => set.add(l.email));
    if (useSubscribers) subscribers.filter((s) => selectedSubs.has(s.email)).forEach((s) => set.add(s.email));
    return Array.from(set);
  };

  const isCustom = useLeads || useSubscribers;
  const recipientCount = isCustom ? customEmails().length : null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !html.trim()) return;
    if (!useAudience && !isCustom) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const body: Record<string, unknown> = { subject: subject.trim(), html: html.trim() };
      if (isCustom) {
        const emails = customEmails();
        if (emails.length === 0) {
          setErrorMsg("No recipients selected.");
          setStatus("error");
          return;
        }
        body.recipients = emails;
      }

      const res = await fetch("/api/admin/newsletter/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message ?? "Send failed");
        setStatus("error");
        return;
      }
      setBroadcastId(json.data?.id ?? "");
      setStatus("sent");
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold">Newsletter Broadcast</h1>
        </div>
        <Alert className="border-green-500/30 bg-green-500/10">
          <CheckCircle className="size-4 text-green-500" />
          <AlertDescription className="text-green-600">
            Broadcast sent successfully!{broadcastId && ` (ID: ${broadcastId})`}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            setStatus("idle");
            setSubject("");
            setHtml("");
            setBroadcastId("");
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Newsletter Broadcast</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compose and send an email to your subscribers.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-6">
        {/* Compose */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your monthly update from Epidom"
                required
                disabled={status === "sending"}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="html">
                  HTML body{" "}
                  <span className="text-muted-foreground font-normal">(plain HTML)</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setPreview((v) => !v)}
                >
                  {preview ? (
                    <>
                      <EyeOff className="size-3.5" /> Edit
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" /> Preview
                    </>
                  )}
                </Button>
              </div>
              {preview ? (
                <div
                  className="border-border min-h-64 rounded-md border p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: html || "<em>Nothing to preview</em>" }}
                />
              ) : (
                <Textarea
                  id="html"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder="<p>Hi,</p><p>Here's what's new…</p>"
                  required
                  disabled={status === "sending"}
                  rows={12}
                  className="font-mono text-sm"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={useAudience}
                  onCheckedChange={(v) => setUseAudience(!!v)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Resend audience</p>
                  <p className="text-muted-foreground text-xs">
                    All contacts synced to your Resend newsletter audience
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={useLeads}
                  onCheckedChange={(v) => setUseLeads(!!v)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">
                    Popup leads
                    {leads.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {leads.length}
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Contacts from the sales page lead capture form
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={useSubscribers}
                  onCheckedChange={(v) => setUseSubscribers(!!v)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">
                    Newsletter subscribers
                    {subscribers.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {subscribers.length}
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Contacts subscribed via footer or sales page
                  </p>
                </div>
              </label>
            </div>

            {/* Individual selectors */}
            {loadingContacts && (
              <p className="text-muted-foreground text-xs">Loading contacts…</p>
            )}

            {useLeads && !loadingContacts && leads.length > 0 && (
              <div className="border-border rounded-md border">
                <div className="border-border flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs font-medium">Popup leads</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => setSelectedLeads(new Set(leads.map((l) => l.email)))}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => setSelectedLeads(new Set())}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {leads.map((l) => (
                    <label
                      key={l.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 px-3 py-2"
                    >
                      <Checkbox
                        checked={selectedLeads.has(l.email)}
                        onCheckedChange={() => toggleLead(l.email)}
                      />
                      <Mail className="text-muted-foreground size-3" />
                      <span className="text-sm">
                        {l.firstName} {l.lastName}
                      </span>
                      <span className="text-muted-foreground ml-auto text-xs">{l.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {useSubscribers && !loadingContacts && subscribers.length > 0 && (
              <div className="border-border rounded-md border">
                <div className="border-border flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs font-medium">Newsletter subscribers</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => setSelectedSubs(new Set(subscribers.map((s) => s.email)))}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={() => setSelectedSubs(new Set())}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {subscribers.map((s) => (
                    <label
                      key={s.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 px-3 py-2"
                    >
                      <Checkbox
                        checked={selectedSubs.has(s.email)}
                        onCheckedChange={() => toggleSub(s.email)}
                      />
                      <Mail className="text-muted-foreground size-3" />
                      <span className="text-sm">{s.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isCustom && !loadingContacts && (
              <p className="text-muted-foreground text-xs">
                {recipientCount} recipient{recipientCount !== 1 ? "s" : ""} selected
              </p>
            )}
          </CardContent>
        </Card>

        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={
            status === "sending" ||
            !subject.trim() ||
            !html.trim() ||
            (!useAudience && !isCustom)
          }
          className="w-full sm:w-auto"
        >
          {status === "sending"
            ? "Sending…"
            : isCustom && recipientCount !== null
            ? `Send to ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}`
            : "Send broadcast"}
        </Button>
      </form>
    </div>
  );
}
