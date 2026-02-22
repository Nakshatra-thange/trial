import { Hono } from "hono";

const app = new Hono();

const PINATA_URL = "https://api.pinata.cloud/pinning";

interface PinataResponse {
  IpfsHash?: string;
  PinSize?: number;
  Timestamp?: string;
  error?: unknown;
}

// ───── Upload Image ─────
app.post("/upload", async (c) => {
  const formData = await c.req.formData();

  const res = await fetch(`${PINATA_URL}/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: formData,
  });

  const data = await res.json() as PinataResponse;

  if (!data.IpfsHash) {
    return c.json({ error: "Pinata upload failed", details: data }, 500);
  }

  return c.json(data);
});

// ───── Upload Metadata JSON ─────
app.post("/upload-json", async (c) => {
  const body = await c.req.json();

  const res = await fetch(`${PINATA_URL}/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as PinataResponse;

  if (!data.IpfsHash) {
    return c.json({ error: "Pinata upload failed", details: data }, 500);
  }

  return c.json(data);
});

export default app;