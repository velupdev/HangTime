/** Live Stripe Payment Link for HangTime Plus ($10 lifetime). */
export const PLUS_PRICE_CENTS = 1000;
export const STRIPE_TEST_MODE = false;
export const LIFETIME_PAYMENT_LINK =
  "https://buy.stripe.com/aFa6oJ8aC1yYd9L0GJcV200";
export const YEARLY_PAYMENT_LINK =
  "https://buy.stripe.com/aFa6oJ8aC1yYd9L0GJcV200";

export function plusCheckoutUrl(userId: string, _plan: "lifetime" | "yearly" = "lifetime"): string {
  const url = new URL(LIFETIME_PAYMENT_LINK);
  url.searchParams.set("client_reference_id", userId);
  return url.toString();
}
