import { NextRequest, NextResponse } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/billing/stripe";
import { getDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getPlanById, getCreditPackById } from "@/lib/billing/plans";
import { addCredits } from "@/lib/billing/quota";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, getWebhookSecret());
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspaceId;
        if (!workspaceId) break;

        if (session.metadata?.type === "credit_topup") {
          const packId = session.metadata.creditPackId;
          const pack = packId ? getCreditPackById(packId) : null;
          if (pack) {
            await addCredits(workspaceId, pack.credits);
            console.log(`Workspace ${workspaceId} topped up ${pack.credits} credits (${pack.id})`);
          } else {
            console.warn(`Unknown credit pack "${packId}" for workspace ${workspaceId}`);
          }
        } else {
          await getDb()
            .collection("workspaces")
            .doc(workspaceId)
            .update({
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              plan: "starter",
              quotaLimit: getPlanById("starter")!.credits,
              quotaUsed: 0,
              updatedAt: FieldValue.serverTimestamp(),
            });

          console.log(`Workspace ${workspaceId} upgraded to starter plan`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const workspaceSnap = await getDb()
          .collection("workspaces")
          .where("stripeSubscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (workspaceSnap.empty) break;

        const wsDoc = workspaceSnap.docs[0];
        const isActive = ["active", "trialing"].includes(
          subscription.status,
        );

        if (!isActive) {
          await wsDoc.ref.update({
            plan: "free",
            quotaLimit: getPlanById("free")!.credits,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Workspace ${wsDoc.id} downgraded to free (subscription ${subscription.status})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const workspaceSnap = await getDb()
          .collection("workspaces")
          .where("stripeSubscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (workspaceSnap.empty) break;

        const wsDoc = workspaceSnap.docs[0];
        await wsDoc.ref.update({
          plan: "free",
          quotaLimit: getPlanById("free")!.credits,
          stripeSubscriptionId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`Workspace ${wsDoc.id} subscription cancelled, reverted to free`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason === "subscription_cycle") {
          const workspaceSnap = await getDb()
            .collection("workspaces")
            .where("stripeCustomerId", "==", invoice.customer)
            .limit(1)
            .get();

          if (!workspaceSnap.empty) {
            await workspaceSnap.docs[0].ref.update({
              quotaUsed: 0,
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`Quota reset for workspace ${workspaceSnap.docs[0].id} (billing cycle)`);
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
