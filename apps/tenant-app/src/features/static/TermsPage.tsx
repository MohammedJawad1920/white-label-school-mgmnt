/**
 * TermsPage — Terms of Service
 * Freeze §Static Screen: Terms of Service
 * Public route — no auth required.
 */

const EFFECTIVE_DATE = "1 March 2026";
const COMPANY_NAME = "SchoolApp Technologies Pvt. Ltd.";
const COMPANY_ADDRESS = "123, Tech Park, Bengaluru, Karnataka – 560001, India";
const CONTACT_EMAIL = "legal@schoolapp.in";
const GOVERNING_LAW = "India";
const JURISDICTION = "Bengaluru, Karnataka";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-6">
      <h2 className="text-lg font-semibold mb-3 text-foreground">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const TOC = [
  ["#acceptance", "1. Acceptance of Terms"],
  ["#services", "2. Description of Services"],
  ["#accounts", "3. Accounts and Access"],
  ["#acceptable-use", "4. Acceptable Use"],
  ["#data", "5. Data and Privacy"],
  ["#ip", "6. Intellectual Property"],
  ["#payment", "7. Subscription and Payment"],
  ["#sla", "8. Service Availability"],
  ["#liability", "9. Limitation of Liability"],
  ["#termination", "10. Termination"],
  ["#changes", "11. Changes to Terms"],
  ["#governing-law", "12. Governing Law"],
  ["#contact", "13. Contact"],
] as const;

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Effective date: {EFFECTIVE_DATE}
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            Please read these Terms of Service ("Terms") carefully before using
            the SchoolApp platform operated by {COMPANY_NAME} ("Company", "we",
            "us", or "our"). By accessing or using the Platform, you agree to be
            bound by these Terms.
          </p>
        </div>

        {/* Table of contents */}
        <nav
          aria-label="Table of contents"
          className="rounded-lg border bg-muted/30 p-4 mb-8"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Contents
          </p>
          <ol className="space-y-1">
            {TOC.map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-sm text-primary hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="acceptance" title="1. Acceptance of Terms">
          <p>
            By creating an account, logging in, or using any feature of the
            SchoolApp platform ("Platform"), you confirm that you have read,
            understood, and agree to these Terms and our{" "}
            <a
              href="/privacy"
              className="text-primary underline underline-offset-2"
            >
              Privacy Policy
            </a>
            .
          </p>
          <p>
            If you are entering into these Terms on behalf of a school,
            institution, or organisation ("School"), you represent that you have
            authority to bind that School to these Terms. In that case, "you"
            refers to the School.
          </p>
          <p>
            If you do not agree to these Terms, you must not access or use the
            Platform.
          </p>
        </Section>

        <Section id="services" title="2. Description of Services">
          <p>
            SchoolApp provides a cloud-based school management platform that
            includes, subject to the features enabled on your subscription:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>User and role management for administrators and teachers</li>
            <li>Student enrolment and class management</li>
            <li>Timetable creation and scheduling</li>
            <li>Attendance recording and reporting</li>
            <li>
              Multi-tenant isolation ensuring your data is not accessible to
              other schools
            </li>
          </ul>
          <p>
            Features are enabled per-tenant by the platform administrator. We
            reserve the right to add, modify, or remove features with reasonable
            notice.
          </p>
        </Section>

        <Section id="accounts" title="3. Accounts and Access">
          <p>
            School administrators are responsible for managing user accounts
            within their tenant. You must:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide accurate information when creating accounts</li>
            <li>Keep credentials confidential and not share passwords</li>
            <li>
              Promptly revoke access for any user who leaves your organisation
            </li>
            <li>
              Notify us immediately at {CONTACT_EMAIL} if you suspect
              unauthorised access
            </li>
          </ul>
          <p>
            We are not liable for any loss or damage arising from unauthorised
            access due to your failure to maintain the security of your
            credentials.
          </p>
          <p>
            Each School is assigned an isolated tenant. You may not attempt to
            access data belonging to any other tenant. Any such attempt is a
            material breach of these Terms and may result in immediate
            termination and reporting to law enforcement.
          </p>
        </Section>

        <Section id="acceptable-use" title="4. Acceptable Use">
          <p>
            You agree to use the Platform only for lawful purposes and in
            accordance with these Terms. You must{" "}
            <strong className="text-foreground">not</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Upload or transmit any content that is unlawful, harmful,
              defamatory, or infringes any third-party rights
            </li>
            <li>
              Attempt to reverse-engineer, decompile, or extract the source code
              of the Platform
            </li>
            <li>
              Use automated tools (scrapers, bots) to access the Platform
              without our prior written consent
            </li>
            <li>
              Attempt to circumvent authentication, access controls, or tenant
              isolation mechanisms
            </li>
            <li>
              Introduce malware, viruses, or any code designed to disrupt or
              damage the Platform
            </li>
            <li>
              Use the Platform to process data about individuals who are not
              affiliated with your School
            </li>
            <li>
              Resell, sublicense, or otherwise commercialise access to the
              Platform without our written consent
            </li>
          </ul>
          <p>
            Violation of this section may result in immediate suspension or
            termination of your access without refund.
          </p>
        </Section>

        <Section id="data" title="5. Data and Privacy">
          <p>
            Our collection and use of personal data is governed by our{" "}
            <a
              href="/privacy"
              className="text-primary underline underline-offset-2"
            >
              Privacy Policy
            </a>
            , which is incorporated into these Terms by reference.
          </p>
          <p>
            <strong className="text-foreground">Your data.</strong> You retain
            all ownership of the data you upload to the Platform. You grant us a
            limited, non-exclusive licence to store, process, and display that
            data solely to provide the services described in Section 2.
          </p>
          <p>
            <strong className="text-foreground">Data portability.</strong> You
            may request an export of your School's data at any time before
            account termination. Exports are provided in JSON or CSV format
            within 10 business days of a valid request.
          </p>
          <p>
            <strong className="text-foreground">Data deletion.</strong> Upon
            termination of your subscription, your data is retained for 90 days
            to allow for recovery requests, after which it is permanently
            deleted from all our systems including backups.
          </p>
          <p>
            <strong className="text-foreground">DPDPA 2023 compliance.</strong>{" "}
            Both parties agree to comply with the Digital Personal Data
            Protection Act, 2023 with respect to any personal data processed
            through the Platform.
          </p>
        </Section>

        <Section id="ip" title="6. Intellectual Property">
          <p>
            The Platform, including its software, design, trademarks, and all
            content created by us, is and remains the exclusive property of{" "}
            {COMPANY_NAME}. These Terms do not grant you any ownership rights in
            the Platform.
          </p>
          <p>
            We grant you a limited, non-exclusive, non-transferable, revocable
            licence to access and use the Platform solely for your internal
            school management purposes during the term of your subscription.
          </p>
          <p>
            Any feedback, suggestions, or ideas you provide to us regarding the
            Platform may be used by us without restriction or compensation to
            you.
          </p>
        </Section>

        <Section id="payment" title="7. Subscription and Payment">
          <p>
            Access to the Platform requires a valid subscription. Subscription
            fees, billing cycles, and payment methods are as specified in your
            order form or subscription agreement. The following terms apply:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">Billing.</strong>{" "}
              Subscriptions are billed in advance on a monthly or annual basis
              as selected at signup.
            </li>
            <li>
              <strong className="text-foreground">Taxes.</strong> All fees are
              exclusive of applicable taxes (including GST). You are responsible
              for all applicable taxes.
            </li>
            <li>
              <strong className="text-foreground">Late payment.</strong>{" "}
              Accounts with overdue payments may be suspended after 14 days'
              notice. Data is retained for 30 days after suspension before
              deletion.
            </li>
            <li>
              <strong className="text-foreground">Refunds.</strong> We do not
              offer refunds for partial subscription periods. If you cancel, you
              retain access until the end of your current billing cycle.
            </li>
            <li>
              <strong className="text-foreground">Price changes.</strong> We
              will provide 30 days' notice of any price increase before it takes
              effect.
            </li>
          </ul>
        </Section>

        <Section id="sla" title="8. Service Availability">
          <p>
            We target 99.5% monthly uptime for the Platform, excluding scheduled
            maintenance windows (communicated at least 24 hours in advance) and
            events beyond our reasonable control (force majeure).
          </p>
          <p>
            We do not guarantee uninterrupted or error-free operation. Planned
            downtime for maintenance will be scheduled during off-peak hours
            where possible.
          </p>
          <p>
            We provide the Platform on an "as-is" and "as-available" basis. To
            the maximum extent permitted by law, we disclaim all warranties,
            express or implied, including merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>
        </Section>

        <Section id="liability" title="9. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, {COMPANY_NAME}{" "}
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, including loss of data, loss of
            revenue, or loss of business, arising out of or related to your use
            of the Platform, even if advised of the possibility of such damages.
          </p>
          <p>
            Our total aggregate liability to you for all claims arising out of
            or related to these Terms or the Platform shall not exceed the fees
            paid by you to us in the three (3) months immediately preceding the
            event giving rise to the claim.
          </p>
          <p>
            Nothing in these Terms excludes or limits liability for death or
            personal injury caused by negligence, fraud, or any liability that
            cannot be excluded under applicable Indian law.
          </p>
        </Section>

        <Section id="termination" title="10. Termination">
          <p>
            <strong className="text-foreground">By you.</strong> You may cancel
            your subscription at any time through your account settings or by
            contacting {CONTACT_EMAIL}. Cancellation takes effect at the end of
            the current billing cycle.
          </p>
          <p>
            <strong className="text-foreground">By us.</strong> We may suspend
            or terminate your access immediately if:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              You materially breach these Terms and fail to remedy the breach
              within 14 days of notice
            </li>
            <li>You fail to pay applicable fees after 14 days' notice</li>
            <li>We are required to do so by law or a competent authority</li>
            <li>
              We reasonably believe continued access poses a security risk to
              the Platform or other users
            </li>
          </ul>
          <p>
            Upon termination, your licence to use the Platform ceases
            immediately. Sections 5 (Data and Privacy), 6 (Intellectual
            Property), 9 (Limitation of Liability), and 12 (Governing Law)
            survive termination.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to Terms">
          <p>
            We may update these Terms from time to time. For material changes,
            we will provide at least 30 days' notice by email to the registered
            administrator email address or by prominent notice within the
            Platform.
          </p>
          <p>
            If you continue to use the Platform after the effective date of the
            revised Terms, you are deemed to have accepted the changes. If you
            do not agree to the changes, you must stop using the Platform and
            may cancel your subscription.
          </p>
        </Section>

        <Section
          id="governing-law"
          title="12. Governing Law and Dispute Resolution"
        >
          <p>
            These Terms are governed by and construed in accordance with the
            laws of {GOVERNING_LAW}, without regard to its conflict of law
            provisions.
          </p>
          <p>
            Any dispute arising out of or in connection with these Terms shall
            first be attempted to be resolved through good-faith negotiation
            between the parties. If not resolved within 30 days, the dispute
            shall be submitted to binding arbitration in accordance with the
            Arbitration and Conciliation Act, 1996 (India). The seat of
            arbitration shall be {JURISDICTION}.
          </p>
          <p>
            For interim relief, either party may approach the courts at{" "}
            {JURISDICTION}, which shall have exclusive jurisdiction.
          </p>
        </Section>

        <Section id="contact" title="13. Contact">
          <p>For any questions regarding these Terms, please contact us:</p>
          <div className="rounded-md border bg-muted/30 p-4 text-sm mt-2 space-y-1">
            <p>
              <strong className="text-foreground">Legal Team</strong>
            </p>
            <p>{COMPANY_NAME}</p>
            <p>{COMPANY_ADDRESS}</p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t pt-6 mt-6 text-xs text-muted-foreground">
          <p>
            {COMPANY_NAME} · Registered in India · CIN: U72900KA2024PTC000001
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
