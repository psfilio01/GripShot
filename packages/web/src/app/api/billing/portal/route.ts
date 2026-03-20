import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getStripe } from "@/lib/billing/stripe";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const customerId = session.workspace.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const origin = req.headers.get("origin") ?? "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Portal session creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal creation failed" },
      { status: 500 },
    );
  }
}
