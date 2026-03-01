/**
 * PrivacyPage — DPDPA 2023 compliant privacy policy.
 * Freeze §Static Screen: Privacy Policy
 *
 * Covers (per Freeze + DPDPA 2023 §§ 4, 6, 8, 11, 13):
 *   - Data collected
 *   - Purpose of processing
 *   - Retention period
 *   - User rights under DPDPA 2023
 *   - Contact for data requests
 *
 * Public route — no auth required.
 */

const EFFECTIVE_DATE = "1 March 2026";
const CONTACT_EMAIL = "privacy@schoolapp.in";
const COMPANY_NAME = "SchoolApp Technologies Pvt. Ltd.";
const COMPANY_ADDRESS = "123, Tech Park, Bengaluru, Karnataka – 560001, India";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3 text-foreground">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Effective date: {EFFECTIVE_DATE}
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            This Privacy Policy describes how {COMPANY_NAME} ("we", "us", or
            "our") collects, uses, and protects personal data processed through
            the SchoolApp platform ("Platform"). This policy is issued in
            compliance with the{" "}
            <strong className="text-foreground">
              Digital Personal Data Protection Act, 2023 (DPDPA 2023)
            </strong>{" "}
            of India.
          </p>
        </div>

        <Section title="1. Data Fiduciary">
          <p>
            {COMPANY_NAME} is the Data Fiduciary as defined under DPDPA 2023. We
            determine the purpose and means of processing personal data
            collected through this Platform.
          </p>
          <p>
            Schools and institutions that subscribe to the Platform act as
            independent Data Fiduciaries for the personal data of their
            students, staff, and administrators. We process that data on their
            behalf as a Data Processor.
          </p>
        </Section>

        <Section title="2. Personal Data We Collect">
          <p>
            We collect and process the following categories of personal data:
          </p>
          <div className="rounded-md border overflow-hidden mt-2">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    Category
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    Data Elements
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    Who It Relates To
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Account data",
                    "Name, email address, hashed password, role",
                    "Administrators, Teachers",
                  ],
                  [
                    "Student data",
                    "Name, class assignment, batch assignment",
                    "Students",
                  ],
                  [
                    "Attendance data",
                    "Date, class period, attendance status (Present/Absent/Late)",
                    "Students",
                  ],
                  [
                    "Timetable data",
                    "Class periods, subject assignments, teacher assignments",
                    "Teachers, Students",
                  ],
                  [
                    "Usage data",
                    "Login timestamps, IP address (server logs only)",
                    "All users",
                  ],
                  [
                    "Tenant data",
                    "School name, slug/subdomain, feature configuration",
                    "School administrators",
                  ],
                ].map(([cat, elems, who]) => (
                  <tr key={cat} className="border-t">
                    <td className="px-3 py-2 font-medium text-foreground align-top">
                      {cat}
                    </td>
                    <td className="px-3 py-2 align-top">{elems}</td>
                    <td className="px-3 py-2 align-top">{who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            We do not collect sensitive personal data such as financial
            information, biometric data, health records, or government-issued
            identification numbers through this Platform.
          </p>
        </Section>

        <Section title="3. Purpose of Processing">
          <p>Personal data is processed for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Providing and operating the school management Platform
              (authentication, timetable, attendance)
            </li>
            <li>
              Enabling school administrators to manage users, classes, and
              academic records
            </li>
            <li>
              Generating attendance summaries and reports for school
              administration
            </li>
            <li>
              Communicating service-related notices (platform updates, security
              alerts)
            </li>
            <li>
              Complying with legal obligations applicable to us or to
              subscribing schools
            </li>
            <li>
              Improving Platform performance and resolving technical issues
              (using anonymised or aggregated data)
            </li>
          </ul>
          <p>
            We do not use personal data for targeted advertising, sale to third
            parties, or any purpose incompatible with those listed above.
          </p>
        </Section>

        <Section title="4. Lawful Basis for Processing">
          <p>
            Under DPDPA 2023, we process personal data on the following bases:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">Consent</strong> — collected
              at the point of account registration for administrators and
              teachers.
            </li>
            <li>
              <strong className="text-foreground">Legitimate uses</strong> —
              processing student attendance and timetable data is necessary to
              fulfil the service contracted by the subscribing school.
            </li>
            <li>
              <strong className="text-foreground">Legal obligation</strong> —
              retaining records as required by applicable education regulations
              or court orders.
            </li>
          </ul>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain personal data for the following periods:</p>
          <div className="rounded-md border overflow-hidden mt-2">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    Data Type
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    Retention Period
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "User account data",
                    "Duration of active subscription + 90 days after termination",
                  ],
                  [
                    "Student records",
                    "Duration of active subscription + 90 days after termination",
                  ],
                  [
                    "Attendance records",
                    "Duration of active subscription + 90 days after termination",
                  ],
                  ["Server/access logs", "90 days from the date of generation"],
                  [
                    "Deleted records",
                    "Soft-deleted for 30 days, then permanently erased from all systems",
                  ],
                  ["Backup data", "Maximum 30 days from the date of backup"],
                ].map(([type, period]) => (
                  <tr key={type} className="border-t">
                    <td className="px-3 py-2 font-medium text-foreground align-top">
                      {type}
                    </td>
                    <td className="px-3 py-2 align-top">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            After the retention period, personal data is permanently deleted or
            anonymised such that it can no longer be attributed to a specific
            individual.
          </p>
        </Section>

        <Section title="6. Data Sharing and Disclosure">
          <p>
            We do not sell, rent, or trade personal data. We may share data only
            in the following circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">Service providers</strong> —
              Cloud infrastructure providers (e.g., hosting, database) acting as
              sub-processors under binding data processing agreements that meet
              DPDPA 2023 standards.
            </li>
            <li>
              <strong className="text-foreground">Subscribing schools</strong> —
              School administrators have access to data within their own tenant
              only; cross-tenant access is technically prevented.
            </li>
            <li>
              <strong className="text-foreground">Legal requirements</strong> —
              When required by law, court order, or a competent government
              authority under applicable Indian law.
            </li>
          </ul>
          <p>
            Any sub-processor engaged by us is contractually bound to process
            personal data only as instructed and to implement appropriate
            technical and organisational safeguards.
          </p>
        </Section>

        <Section title="7. Your Rights Under DPDPA 2023">
          <p>
            As a Data Principal under the Digital Personal Data Protection Act,
            2023, you have the following rights with respect to your personal
            data:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-foreground">
                Right to access (§ 11)
              </strong>{" "}
              — You may request a summary of the personal data we hold about you
              and the purposes for which it is being processed.
            </li>
            <li>
              <strong className="text-foreground">
                Right to correction and erasure (§ 12)
              </strong>{" "}
              — You may request correction of inaccurate or incomplete personal
              data, and erasure of personal data that is no longer necessary for
              the purpose for which it was collected.
            </li>
            <li>
              <strong className="text-foreground">
                Right to grievance redressal (§ 13)
              </strong>{" "}
              — You may raise a grievance with our Data Protection Officer. We
              will acknowledge your grievance within 48 hours and resolve it
              within 30 days.
            </li>
            <li>
              <strong className="text-foreground">
                Right to nominate (§ 14)
              </strong>{" "}
              — You may nominate another individual to exercise your rights in
              the event of your death or incapacity.
            </li>
            <li>
              <strong className="text-foreground">
                Right to withdraw consent
              </strong>{" "}
              — Where processing is based on consent, you may withdraw your
              consent at any time. Withdrawal will not affect the lawfulness of
              processing prior to withdrawal.
            </li>
          </ul>
          <p>
            To exercise any of these rights, please submit a written request to
            our Data Protection Officer using the contact details in Section 9
            below. We may ask you to verify your identity before processing your
            request.
          </p>
        </Section>

        <Section title="8. Data Security">
          <p>
            We implement the following technical and organisational measures to
            protect personal data:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Passwords are stored using industry-standard one-way hashing
              (bcrypt)
            </li>
            <li>All data in transit is encrypted using TLS 1.2 or higher</li>
            <li>Database access is restricted by role-based access controls</li>
            <li>
              Tenant data is strictly isolated — no cross-tenant queries are
              permitted at the application layer
            </li>
            <li>
              Access logs are retained and reviewed for anomalous activity
            </li>
            <li>
              Regular security reviews of application code and infrastructure
            </li>
          </ul>
          <p>
            In the event of a personal data breach that is likely to result in
            risk to Data Principals, we will notify the Data Protection Board of
            India as required under DPDPA 2023 and inform affected users without
            undue delay.
          </p>
        </Section>

        <Section title="9. Contact — Data Protection Officer">
          <p>
            For all queries, requests, or grievances related to this Privacy
            Policy or the processing of your personal data, please contact our
            Data Protection Officer:
          </p>
          <div className="rounded-md border bg-muted/30 p-4 text-sm mt-2 space-y-1">
            <p>
              <strong className="text-foreground">
                Data Protection Officer
              </strong>
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
            <p>Response time: Within 48 hours of receipt</p>
          </div>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in law or our practices. When we make material changes, we
            will update the effective date at the top of this page and, where
            required by DPDPA 2023, seek fresh consent from affected Data
            Principals.
          </p>
          <p>
            Continued use of the Platform after any changes constitutes
            acceptance of the updated policy for purposes other than those
            requiring explicit consent.
          </p>
        </Section>

        {/* Footer */}
        <div className="border-t pt-6 mt-6 text-xs text-muted-foreground">
          <p>
            {COMPANY_NAME} · Registered in India · CIN: U72900KA2024PTC000001
          </p>
          <p className="mt-1">
            This policy is governed by the laws of India. Disputes are subject
            to the jurisdiction of courts in Bengaluru, Karnataka.
          </p>
        </div>
      </div>
    </div>
  );
}
