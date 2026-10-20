"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";

export function NewsletterBroadcastView() {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [broadcastId, setBroadcastId] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !html.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/newsletter/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), html: html.trim() }),
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Newsletter Broadcast</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compose and send an email broadcast to all newsletter subscribers via Resend.
        </p>
      </div>

      {status === "sent" ? (
        <Alert className="border-green-500/30 bg-green-500/10">
          <CheckCircle className="size-4 text-green-500" />
          <AlertDescription className="text-green-600">
            Broadcast sent successfully!{broadcastId && ` (ID: ${broadcastId})`}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
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
                <Label htmlFor="html">
                  HTML body{" "}
                  <span className="text-muted-foreground font-normal">(plain HTML)</span>
                </Label>
                <Textarea
                  id="html"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder="<p>Hi,</p><p>Here's what's new…</p>"
                  required
                  disabled={status === "sending"}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              {status === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={status === "sending"} className="w-full sm:w-auto">
                {status === "sending" ? "Sending…" : "Send broadcast"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {status === "sent" && (
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
      )}
    </div>
  );
}
