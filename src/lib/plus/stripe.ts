/** Stripe test Payment Links for HangTime Plus. */
export const PLUS_PRICE_CENTS = 1000;
export const STRIPE_TEST_MODE = true;
export const LIFETIME_PAYMENT_LINK =
  "https://buy.stripe.com/test_00w3cu12Oazu9JA0c693y00";
export const YEARLY_PAYMENT_LINK =
  "https://buy.stripe.com/test_00wcN4dPA0YU4pg4sm93y01";

export function plusCheckoutUrl(userId: string, plan: "lifetime" | "yearly"): string {
  const url = new URL(
    plan === "yearly" ? YEARLY_PAYMENT_LINK : LIFETIME_PAYMENT_LINK,
  );
  url.searchParams.set("client_reference_id", userId);
  return url.toString();
}
