"use client";

// Nutri Tummies — Legal documents (POPIA privacy policy + terms of use)
// Rendered as a full-screen overlay accessible from the landing footer,
// signup screen and Settings, from any app state.

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";

export function LegalView() {
  const { legalDoc, closeLegal } = useAppStore();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Escape closes the document
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLegal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLegal]);

  if (!legalDoc) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeLegal} aria-label="Back to app">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2.5 min-w-0">
            {legalDoc === "privacy" ? (
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-primary shrink-0" />
            )}
            <h1 className="font-[family-name:var(--font-nunito)] font-black text-lg truncate">
              {legalDoc === "privacy" ? "Privacy Policy (POPIA)" : "Terms of Use"}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        {legalDoc === "privacy" ? <Privacy /> : <Terms />}
      </main>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-[family-name:var(--font-nunito)] font-extrabold text-lg mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground space-y-3">{children}</div>
    </section>
  );
}

function Updated() {
  return <p className="text-xs text-muted-foreground">Last updated: 29 August 2026 · Effective from launch</p>;
}

const CONTACT = (
  <p>
    You can reach us at <span className="font-semibold text-foreground">hello@nutritummies.co.za</span> or via the
    contact details published on our website. We respond to privacy queries within a reasonable time.
  </p>
);

/* ---------- privacy policy ---------- */

function Privacy() {
  return (
    <article>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This policy explains how Nutri Tummies (Pty) Ltd (&quot;Nutri Tummies&quot;, &quot;we&quot;, &quot;us&quot;), a
        company registered in South Africa, collects and processes personal information when you use the Nutri
        Tummies app and website. We process your information in accordance with the Protection of Personal
        Information Act 4 of 2013 (POPIA) and treat your family&apos;s data with the care it deserves.
      </p>

      <Section title="1. Who is responsible for your information">
        <p>
          Nutri Tummies (Pty) Ltd, Johannesburg, South Africa, is the &quot;responsible party&quot; for the personal
          information described in this policy. Where required, we have appointed an Information Officer who
          oversees our compliance with POPIA and handles data subject requests.
        </p>
      </Section>

      <Section title="2. What we collect">
        <p>
          <span className="font-semibold text-foreground">Account information:</span> your name, email address and a
          cryptographically hashed password (we never store your actual password).
        </p>
        <p>
          <span className="font-semibold text-foreground">Child profiles:</span> the details you add about your
          children — first name, age, food allergies, likes and dislikes, and a weekly food budget. This information
          powers personalised meal plans.
        </p>
        <p>
          <span className="font-semibold text-foreground">Usage information:</span> meal plans you generate, food
          diary entries, shopping lists and conversations with Coach Nandi, our AI nutrition coach.
        </p>
        <p>
          <span className="font-semibold text-foreground">Payment information:</span> when you buy a subscription we
          create a payment record (amount, plan, status). Card details are processed by our payment providers
          (PayFast or Yoco) — <span className="font-semibold text-foreground">card numbers never touch our servers</span>.
        </p>
        <p>
          <span className="font-semibold text-foreground">Technical information:</span> a secure session cookie that
          keeps you signed in, and standard server logs (IP address, timestamps) used for security and troubleshooting.
        </p>
      </Section>

      <Section title="3. Why we process it (lawful basis)">
        <p>
          We process your information to provide the service you signed up for (meal planning, shopping lists,
          coaching) — this is processing necessary to perform a contract with you. We use aggregated, de-identified
          data to improve our recipes and features, which we pursue under our legitimate interest in making the
          product better. We send service emails (receipts, account notices) as part of our contractual obligations;
          marketing emails are only sent with your consent, and every one includes an unsubscribe link.
        </p>
      </Section>

      <Section title="4. AI processing">
        <p>
          Meal plans, recipes and coach answers are generated with the help of artificial intelligence. When you ask
          Coach Nandi a question or generate a plan, relevant context (for example your child&apos;s age band,
          allergies and your question) is sent to our AI service provider to generate a response. We do not send
          your password, payment details or email address to AI providers, and we instruct our providers not to use
          this data to train their models. AI answers are general guidance — they are not medical advice.
        </p>
      </Section>

      <Section title="5. Children's information (section 34 consent)">
        <p>
          Nutri Tummies is designed for parents and caregivers acting on behalf of their children. By creating a
          child profile you confirm that you are the parent or legal guardian of that child, or have their
          guardian&apos;s permission, and you consent to the processing of the child&apos;s information as described
          in this policy. Child profiles contain only first names and food preferences — we deliberately do not ask
          for children&apos;s surnames, identity numbers, schools or photos.
        </p>
      </Section>

      <Section title="6. Who we share it with">
        <p>
          We do not sell your personal information, ever. We share it only with: (a) payment providers (PayFast,
          Yoco) to process subscription payments; (b) our AI service provider, strictly to generate the features you
          request; (c) our hosting and database providers, who store the data on our behalf; and (d) authorities,
          where we are legally required to do so. All providers are bound by data processing agreements.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          We use a single essential cookie to keep you signed in. It is marked httpOnly (invisible to scripts) and
          expires after 30 days. We do not use advertising or third-party tracking cookies.
        </p>
      </Section>

      <Section title="8. How long we keep it">
        <p>
          Account and child profile data is kept while your account is active. If you delete a child profile, its
          meal plans and diary entries are deleted immediately. If you close your account, we delete or
          de-identify your personal information within 30 days, except records we must keep for tax or legal
          purposes (such as payment records, kept for 5 years as South African law requires).
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          Passwords are hashed with scrypt (never stored in plain text), all traffic is encrypted in transit with
          TLS, every API request checks that you only ever touch your own family&apos;s data, and access to
          production systems is restricted to the team members who need it. No system is perfectly secure — if a
          data breach ever affects you, POPIA requires us to notify you and the Information Regulator without
          delay.
        </p>
      </Section>

      <Section title="10. Your rights">
        <p>
          Under POPIA you have the right to: access the personal information we hold about you; correct or delete
          it; object to processing; withdraw consent for marketing; and complain to the Information Regulator of
          South Africa (POPIA complaints: <span className="font-semibold text-foreground">inforeg@justice.gov.za</span>).
          Most requests can be handled instantly in the app (children and diary entries are deletable from
          Settings); for anything else, email us and we will respond within a reasonable period.
        </p>
      </Section>

      <Section title="11. Changes to this policy">
        <p>
          If we make material changes we will notify you in the app or by email before they take effect. The current
          version is always available at this page.
        </p>
        {CONTACT}
        <div className="mt-4"><Updated /></div>
      </Section>
    </article>
  );
}

/* ---------- terms of use ---------- */

function Terms() {
  return (
    <article>
      <p className="text-sm leading-relaxed text-muted-foreground">
        These terms govern your use of the Nutri Tummies app and website. By creating an account you agree to them.
        If you do not agree, please do not use the service.
      </p>

      <Section title="1. The service">
        <p>
          Nutri Tummies provides AI-assisted meal planning, recipes, shopping lists and nutrition guidance for
          families, with pricing in South African Rand. We may add, change or remove features as the product
          evolves, and we will keep the core of what you subscribed to intact.
        </p>
      </Section>

      <Section title="2. Your account">
        <p>
          You must be at least 18 years old to create an account, and you are responsible for keeping your password
          confidential. You may only create one account per household email address. If you believe someone has
          accessed your account, tell us immediately.
        </p>
      </Section>

      <Section title="3. Trials and subscriptions">
        <p>
          New accounts receive a 14-day Premium trial at no cost — no card required. When the trial ends, your
          account moves to the free tier automatically unless you subscribe. Paid plans renew automatically
          (monthly or yearly, as chosen) until cancelled. You can cancel at any time from Settings or by emailing
          us; cancellation stops future renewals and your Premium features continue until the end of the period you
          already paid for.
        </p>
        <p>
          Payments are processed by PayFast or Yoco. Amounts are billed in ZAR and include VAT where applicable.
          As a South African consumer you retain the rights given to you by the Consumer Protection Act 68 of 2008,
          including — for some transactions — the right to cancel within 5 business days; contact us and we will
          assist.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>
          Please do not: share another person&apos;s (or child&apos;s) information without their guardian&apos;s
          consent; use the service to promote eating disorders or unsafe practices; attempt to break, overload or
          reverse-engineer the service or its AI components; or resell access. Accounts that abuse the service may
          be suspended.
        </p>
      </Section>

      <Section title="5. AI content and medical disclaimer">
        <p>
          Meal plans, recipes, cost estimates and coach answers are generated with AI and may contain mistakes.
          Cost estimates are approximations, not price guarantees. Most importantly: <span className="font-semibold text-foreground">Nutri
          Tummies is not a medical service and does not provide medical advice</span>. Allergy filtering reduces risk
          but always double-check ingredients yourself — if your child has a serious allergy, confirm every meal
          with a qualified professional. For medical concerns, consult a doctor, paediatrician or registered
          dietitian. Never delay medical advice because of something the coach said.
        </p>
      </Section>

      <Section title="6. Availability">
        <p>
          We aim for a reliable service but cannot promise uninterrupted access. AI features may occasionally
          degrade to offline fallbacks, and we may pause the service for maintenance. We do not offer refunds for
          short, unavoidable outages, but will make it right if an extended incident affects your paid period.
        </p>
      </Section>

      <Section title="7. Intellectual property">
        <p>
          The app, its branding, recipe library and generated content are owned by Nutri Tummies (Pty) Ltd and its
          licensors. Your own data — child profiles, diary entries, coach chats — remains yours. You may export or
          delete it at any time.
        </p>
      </Section>

      <Section title="8. Liability">
        <p>
          To the extent allowed by South African law, our total liability for claims related to the service is
          limited to the subscription fees you paid in the 3 months before the claim. Nothing in these terms
          excludes liability that cannot lawfully be excluded, including under the Consumer Protection Act.
        </p>
      </Section>

      <Section title="9. Governing law">
        <p>
          These terms are governed by the laws of the Republic of South Africa, and its courts have jurisdiction
          over disputes. Where the Consumer Protection Act grants you stronger rights, those rights prevail over
          any conflicting term here.
        </p>
      </Section>

      <Section title="10. Changes">
        <p>
          We may update these terms as the product grows. Material changes will be announced in the app or by
          email, and continued use after the effective date means you accept the update.
        </p>
        {CONTACT}
        <div className="mt-4"><Updated /></div>
      </Section>
    </article>
  );
}
