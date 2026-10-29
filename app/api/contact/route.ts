const contactAddress = "leonardo@vectorintelligence.dev";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host || new URL(origin).host !== host) {
    return new Response(null, { status: 403 });
  }

  const subject = encodeURIComponent("Let's talk about a project");
  const href = `mailto:${contactAddress}?subject=${subject}`;

  return Response.json(
    { href },
    { headers: { "Cache-Control": "no-store" } },
  );
}
