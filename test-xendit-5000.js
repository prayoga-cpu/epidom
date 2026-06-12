
const xenditApiKey = "xnd_development_6k0NzW17SkesSCaKL8ep61v70Ky8xx18uTGbnjCPb1FI26CHD0nzXk04gBkfw3J3";
async function run() {
  try {
    const res = await fetch("https://api.xendit.co/qr_codes", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(xenditApiKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: "test-" + Date.now(),
        type: "DYNAMIC",
        callback_url: "https://example.com",
        amount: 5000,
        currency: "IDR",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
    });
    console.log(res.status, await res.text());
  } catch (e) { console.error(e); }
}
run();

