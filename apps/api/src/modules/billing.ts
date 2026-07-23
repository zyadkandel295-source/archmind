import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";

export function billingRouter(env: Env, store: MemoryStore) {
  const router = Router();

  router.post(
    "/billing/checkout",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const plan = req.body?.plan === "team" ? "team" : "pro";

      if (!env.stripeSecretKey) {
        return res.json({
          mode: "demo",
          checkoutUrl: `${env.appUrl}/settings/billing?plan=${plan}&demo=true`,
          message: "Set STRIPE_SECRET_KEY to create real Stripe checkout sessions."
        });
      }

      return res.status(501).json({
        error: {
          code: "STRIPE_ADAPTER_TODO",
          message: "Stripe key is configured. Wire stripe.checkout.sessions.create in this adapter."
        }
      });
    })
  );

  router.post(
    "/webhooks/stripe",
    asyncHandler(async (_req, res) => {
      res.json({
        received: true,
        mode: env.stripeWebhookSecret ? "configured" : "demo"
      });
    })
  );

  return router;
}
