export interface FonnteMessageRequest {
  to: string;
  message: string;
}

export interface FonnteMessageResponse {
  status: boolean;
  target: string;
  id: string;
}

function getFonnteToken(): string | null {
  return process.env.FONNTE_API_TOKEN ?? null;
}

export async function sendFonnteWhatsApp(
  req: FonnteMessageRequest
): Promise<FonnteMessageResponse> {
  const token = getFonnteToken();
  if (!token) {
    throw new Error("FONNTE_API_TOKEN is not configured");
  }

  const phone = req.to.replace(/\D/g, "").replace(/^0/, "62");

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: phone,
      message: req.message,
      typing: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fonnte API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<FonnteMessageResponse>;
}

export function isFonnteAvailable(): boolean {
  return !!getFonnteToken();
}
