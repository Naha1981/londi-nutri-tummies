// PayFast signature tests: checkout field generation + ITN verification.
// Run: bun scripts/test-payfast.ts

export {}; // module scope (avoids TS2393 clash with other scripts' main())

process.env.PAYFAST_MERCHANT_ID = "10000100";
process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";

async function main() {
  const { buildPayfastCheckout, verifyPayfastSignature, payfastSignatureFor } = await import("../src/lib/payments");

  // 1. checkout form: correct sandbox URL, expected fields, and a valid signature
  const { actionUrl, fields } = buildPayfastCheckout({
    order: { id: "order_123", amountCents: 7900, planLabel: "Family Premium (monthly)" },
    user: { email: "test@example.co.za", name: "Nomsai Dlamini" },
    baseUrl: "https://nutritummies.co.za",
  });

  const fieldMap: Record<string, string> = {};
  for (const f of fields) fieldMap[f.name] = f.value;

  const urlOk = actionUrl === "https://sandbox.payfast.co.za/eng/process";
  console.log("sandbox action url:", urlOk ? "PASS ✓" : `FAIL ✗ (${actionUrl})`);
  const fieldsOk =
    fieldMap.merchant_id === "10000100" &&
    fieldMap.m_payment_id === "order_123" &&
    fieldMap.amount === "79.00" &&
    fieldMap.notify_url === "https://nutritummies.co.za/api/billing/notify" &&
    fieldMap.return_url.includes("billing=return") &&
    !!fieldMap.signature;
  console.log("checkout fields:", fieldsOk ? "PASS ✓" : "FAIL ✗", `(${fields.length} fields)`);

  const checkoutSig = fieldMap.signature;
  const checkoutVerify = verifyPayfastSignature({ ...fieldMap, signature: checkoutSig });
  console.log("checkout signature self-verifies:", checkoutVerify ? "PASS ✓" : "FAIL ✗");

  // 2. simulated ITN: PayFast posts checkout fields + ITN fields, signed over ALL of them
  const itn: Record<string, string> = {
    merchant_id: "10000100",
    m_payment_id: "order_123",
    amount: "79.00",
    amount_gross: "79.00",
    amount_fee: "-2.20",
    amount_net: "76.80",
    payment_status: "COMPLETE",
    pf_payment_id: "PF12345",
    item_name: "Nutri Tummies Family Premium (monthly)",
    email_address: "test@example.co.za",
  };
  const itnSig = payfastSignatureFor(itn);
  const itnVerify = verifyPayfastSignature({ ...itn, signature: itnSig });
  console.log("ITN signature verifies:", itnVerify ? "PASS ✓" : "FAIL ✗");

  // 3. tampered amount must be rejected
  const tampered = verifyPayfastSignature({ ...itn, amount_gross: "1.00", signature: itnSig });
  console.log("tampered amount rejected:", !tampered ? "PASS ✓" : "FAIL ✗ (accepted tampered payload!)");

  // 4. wrong passphrase must be rejected
  process.env.PAYFAST_PASSPHRASE = "different";
  const wrongPhrase = verifyPayfastSignature({ ...itn, signature: itnSig });
  console.log("wrong passphrase rejected:", !wrongPhrase ? "PASS ✓" : "FAIL ✗");
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";

  const allPass = urlOk && fieldsOk && checkoutVerify && itnVerify && !tampered && !wrongPhrase;
  console.log(allPass ? "\nPayFast integration logic: ALL PASS" : "\nPayFast integration logic: FAILURES");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
