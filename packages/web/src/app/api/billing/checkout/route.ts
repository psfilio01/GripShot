import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getStripe } from "@/lib/billing/stripe";
import { z } from "zod";

const RequestSchema = z.object({
  priceId: z.string().min(1),
  mode: z.enum(["subscription", "payment"]).default("subscription"),
  creditPackId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { priceId, mode, creditPackId } = RequestSchema.parse(body);

    const stripe = getStripe();
    const origin = req.headers.get("origin") ?? "http://localhost:3000";

    const metadata: Record<string, string> = {
      workspaceId: session.user.workspaceId,
      uid: session.user.uid,
    };

    if (mode === "payment" && creditPackId) {
      metadata.type = "credit_topup";
      metadata.creditPackId = creditPackId;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/settings?billing=success`,
      cancel_url: `${origin}/dashboard/settings?billing=cancelled`,
      client_reference_id: session.user.uid,
      metadata,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Checkout session creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
