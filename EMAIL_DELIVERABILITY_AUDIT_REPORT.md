# Email Deliverability Audit Report

Audit date: 2026-10-21

## Executive Summary

The application sends mail through Gmail SMTP (`smtp.gmail.com`) on port 587. A live Nodemailer SMTP verification completed successfully, which verifies connectivity and authentication to the configured SMTP service; it does not prove that a particular message was accepted, delivered, or placed in an inbox.

The configured visible sender uses the `gmail.com` domain, while the storefront and order templates use `aaneddles.com` as the brand website/support domain. Public DNS-over-HTTPS lookups returned NXDOMAIN for `aaneddles.com`, so I could not verify its mail records or confirm that it is currently a registered/configured domain. This sender/domain mismatch and the lack of verifiable brand-domain authentication are the primary configuration concerns. The sender mailbox appears to be a Gmail address; its exact value is intentionally omitted.

The code now uses bounded retries for explicit temporary SMTP failures, provides plain-text alternatives, sets consistent From/Reply-To/envelope settings, logs provider acceptance/failure without logging recipient addresses or message contents, records provider message IDs in order history, and tells checkout only that the provider accepted the message (not that it was delivered).

**Inbox placement is not proven or guaranteed.** No controlled messages were sent to test inboxes, and no original message headers, Gmail send-as verification, bounce events, or provider reputation data were available.

## Root Cause Analysis

| Finding | Evidence | Impact | Status |
|---|---|---|---|
| Email uses Gmail SMTP and a `gmail.com` sender domain rather than a verified brand-domain sender | Local configuration inspection revealed `smtp.gmail.com`, port 587, and a `gmail.com` From domain. Secret values were not displayed. | Messages carry Gmail sender identity while templates and website identify AA NEEDLES. This can reduce brand trust and does not authenticate the website domain. | EMAIL PROVIDER ACTION REQUIRED |
| Brand domain DNS could not be authenticated | Public DNS-over-HTTPS returned status 3 (NXDOMAIN) for `aaneddles.com` MX, TXT, and NS lookups. | SPF, DKIM, DMARC, MX, and provider verification for this domain cannot be confirmed. | DNS CHANGE REQUIRED / DOMAIN OWNER ACTION REQUIRED |
| The previous order confirmation UI asserted delivery without checking the mail result | Checkout unconditionally displayed “A confirmation email has been sent”; the order API did not expose a reliable result. | Customers could be told an email was sent even if SMTP rejected it. | FIXED AND VERIFIED |
| Legacy email code lacked a plain-text alternative and bounded retry behavior | Previous `sendEmail` passed HTML only and attempted one send. | Less robust rendering and transient-failure handling. | FIXED AND VERIFIED |
| Status-change notification attempts were not safely tied to provider acceptance | The order notification service sent messages and recorded status history, but success was not equivalent to delivery. | Operators and customers could misinterpret a queued/accepted response as delivered mail. | CODE FIXED, AWAITING PRODUCTION VERIFICATION |
| SMTP success does not establish inbox placement | No Gmail/Outlook/Yahoo inbox tests or full received message headers were supplied. | Spam/junk placement and recipient-side rejection remain unknown. | UNRESOLVED |

## Code Changes

- `src/utils/email.js`
  - Centralized Nodemailer transport options, SMTP verification, sender formatting, plain-text generation, retry classification, and send results.
  - Requires STARTTLS for port 587 and verifies TLS certificates.
  - Retries only explicit SMTP 4xx responses and connection failures known to occur before delivery; does not retry ambiguous timeouts/resets that could cause duplicate delivery.
  - Returns the SMTP provider's message ID and reports the state as provider acceptance, not recipient delivery.
  - Avoids logging message content, credentials, or recipient addresses.
- `src/utils/emailSender.js`
  - Kept the existing import path compatible while reusing the central email utility.
- `src/config/env.js`
  - Added optional `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, and `EMAIL_RETURN_PATH` configuration and validation for mailbox formats.
- `src/server.js`
  - Verifies the SMTP transport at startup and records a sanitized result.
- `src/services/orderEmail.service.js`
  - Uses the configured sender/reply-to, records provider acceptance and message ID, and avoids storing a recipient email in order status history.
- `src/services/order.service.js`
  - Returns the notification outcome for order creation/status changes and preserves order business state when sending email fails.
- `src/utils/__tests__/emailSender.test.js`
  - Covers missing SMTP configuration, transient SMTP server/recipient rejection, permanent SMTP responses, timeout duplicate prevention, recipient rejection, text alternatives, and sender headers.
- `frontend/src/app/checkout/page.js`
  - Reads the order email status from the API response.
- `frontend/src/components/checkout/OrderConfirmed.js`
  - Avoids falsely claiming delivery; displays provider acceptance or a send-submission failure.

## DNS Configuration

DNS checks were performed on 2026-10-21 using public DNS-over-HTTPS. Results must be distinguished from message authentication results: only received message headers can prove that SPF/DKIM/DMARC passed for an actual message.

| Check | Current status | Evidence / problem | Required action |
|---|---|---|---|
| SPF for `aaneddles.com` | Unknown / domain lookup returned NXDOMAIN | No records can be returned for the currently referenced brand domain. | Confirm the intended registered brand domain and DNS zone. Once using a domain sender, obtain the exact SPF include/value from the chosen provider and merge it into the domain's single SPF TXT record. Do not add a second SPF record. |
| DKIM for `aaneddles.com` | Unknown | No brand DNS zone or selector could be verified; no received message headers supplied. | In the email-provider admin console, enable domain DKIM and publish the exact provider-issued selector/key or CNAME records. Never invent a selector/key. |
| DMARC for `aaneddles.com` | Unknown / domain lookup returned NXDOMAIN | No brand-domain DMARC record can be retrieved. | After SPF/DKIM are configured and aligned, publish one DMARC record initially at a monitoring policy (commonly `p=none`) with a monitored reporting mailbox. Review reports before increasing enforcement. Do not overwrite any existing record without checking the authoritative zone. |
| Gmail SPF | DNS record found | `gmail.com` publishes `v=spf1 redirect=_spf.google.com`. This is Google-owned provider DNS and does not authenticate `aaneddles.com`. | No change to Gmail DNS is needed or authorized. |
| Gmail DMARC | DNS record found | `gmail.com` publishes `v=DMARC1; p=none; sp=quarantine; rua=mailto:mailauth-reports@google.com`. This policy is not a DMARC policy for the brand domain. | No change to Gmail DNS is needed or authorized. |
| DKIM for actual sent messages | Unknown | Public DNS records alone do not confirm which selector/signature Google applied to a message. No full headers are available. | Send a controlled test and inspect `Authentication-Results` and `DKIM-Signature` headers. |
| MX for `aaneddles.com` | Unknown / domain lookup returned NXDOMAIN | Public lookup did not return records. | Confirm the exact domain spelling and registrar/authoritative DNS. MX is only required if receiving mail at that domain; it is separate from sending authentication. |

No DNS was modified.

## Email Provider Configuration

- Configured service: Google Gmail SMTP, host `smtp.gmail.com`, port `587`, STARTTLS.
- SMTP credentials, sender address, and other secret values were not included in this report.
- Environment variables used:
  - Required for SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
  - Optional: `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `EMAIL_RETURN_PATH`.
  - Retry setting shared with newsletter sender: `NEWSLETTER_MAX_ATTEMPTS` (bounded in code to a maximum of five).
- Live `transporter.verify()` result: **PASS**. This proves the configured SMTP endpoint accepted a connection/authentication at the time of test, not that the sender identity is verified by Google or that messages reach recipient inboxes.
- Account-level Gmail “Send mail as” authorization, sending quota, account restrictions, and bounce/complaint state require access to the Google account/provider dashboard and remain unverified.
- For production brand identity, use an address on the confirmed, business-controlled domain via Google Workspace or another transactional email provider. Verify the sender/domain in that provider and use its exact DNS records. Do not spoof a brand-domain From address through an unverified Gmail account.

## Email Trigger Review

| Email type | Trigger / sender path | Current assessment |
|---|---|---|
| Order confirmation | Successful order creation → `orderEmail.service.js` → centralized sender | Sends after database commit; provider outcome is returned and recorded. SMTP acceptance is not delivery confirmation. |
| Order status updates | Admin order status transition → central order email dispatcher | Uses order templates and notification history; valid status changes are separate from email success. Duplicate status submissions do not trigger a new transition. |
| Registration/password reset OTP | `otp.service.js` via compatibility `sendEmail` | Uses central transport, retry behavior, plain-text fallback, and sanitized send failure logging. |
| Order reminder | Scheduled order reminder job via `sendEmail` | Uses central transport; no delivery/bounce webhook exists. |
| Low-stock alerts | Inventory alert job via `sendEmail` | Existing recipient batch failure handling remains in place. |
| Newsletter | Newsletter service via `sendEmailWithRetry` | Existing send accounting and unsubscribe flow remain separate from transactional order messages. |

No provider delivery/bounce webhook or suppression-list integration was found. SMTP acceptance cannot report later bounce, complaint, or inbox placement to this application.

## Test Results

| Test | Expected | Actual | Result |
|---|---|---|---|
| Backend test suite (`npm test -- --runInBand`) | Email sender behavior passes | 1 suite, 7 tests passed | PASS |
| Backend changed-file syntax checks | No syntax errors | All checked files passed `node --check` | PASS |
| Frontend production build | Checkout compiles and type-checks | Next.js production build completed | PASS |
| Order confirmation component ESLint | No component lint errors | Passed | PASS |
| Configured SMTP verification | SMTP connection/auth succeeds | `transporter.verify()` succeeded | PASS |
| SPF/DMARC public lookup for `aaneddles.com` | Records available if domain resolves | NXDOMAIN (DNS status 3) | FAIL / DOMAIN ACTION REQUIRED |
| Controlled Gmail/Outlook/Yahoo inbox tests | Message headers and placement recorded | Not performed; test inboxes and authorization unavailable | NOT RUN |
| Bounce/complaint/provider events | Events captured by application | No provider event webhook found/configured | NOT IMPLEMENTED |

SMTP acceptance means the submission provider accepted a message for processing. It is not a delivery receipt and does not prove inbox placement.

## Remaining Actions

1. Confirm the correct, registered brand domain. Public DNS currently reports NXDOMAIN for `aaneddles.com`, which is also referenced by the website and support templates.
2. Use a mailbox on that verified business domain with an authorized email provider; verify the sender identity in the provider console.
3. Publish provider-generated SPF and DKIM records in the authoritative DNS zone; do not add duplicate SPF records or guess DKIM values.
4. Add a DMARC monitoring record only after confirming the domain/DNS zone, then inspect reports and align From, SPF, and DKIM. Keep enforcement gradual.
5. Configure `EMAIL_FROM`, `EMAIL_FROM_NAME`, and a working, monitored `EMAIL_REPLY_TO` in the hosting environment. If the provider supports a custom bounce/return-path domain, configure `EMAIL_RETURN_PATH` and the provider-issued DNS records.
6. Send controlled test messages to Gmail, Outlook, and Yahoo test accounts. Inspect full headers for `spf=pass`, `dkim=pass`, and `dmarc=pass`; record actual inbox/spam placement and any bounce response.
7. Add provider webhooks and a bounce/complaint suppression workflow before sending at production scale.
8. For durable retry recovery across server restarts, implement an email outbox/queue with idempotency keys and operational monitoring. The current implementation makes bounded synchronous attempts and records order notification results; it is not a durable queue. Do not automatically retry an ambiguous SMTP timeout because the recipient may already have received the message.

## Deployment Instructions

1. Deploy backend and frontend code together so the API's `emailStatus` response and checkout display remain compatible.
2. Keep SMTP credentials in the backend hosting environment only; do not put them in frontend environment variables or commit them.
3. Set the sender and optional reply-to to addresses authorized by the chosen provider. Keep `EMAIL_FROM` as a mailbox address or standard display-name mailbox format.
4. Restart the backend and inspect sanitized startup logs for SMTP verification. Do not expose logs containing recipient data or credentials.
5. Place a controlled test order using an authorized test account. Confirm the order persists even if email sending fails, the UI does not claim delivery, and the backend order history records provider acceptance/failure.
6. Check the received message headers and provider logs, and check the recipient inbox and spam folder manually.
7. Apply DNS changes only in the authoritative DNS provider after confirming the correct domain and using provider-generated values.

## Final Status

- **FIXED AND VERIFIED:** Misleading checkout email claim; frontend build and component lint; SMTP transport connection; bounded SMTP response handling; plain-text alternatives; sanitized notification logging; backend mail tests.
- **CODE FIXED, AWAITING PRODUCTION VERIFICATION:** Actual order confirmation/status delivery to customer inboxes; sender account authorization; recipient-provider acceptance and placement.
- **DNS CHANGE REQUIRED:** No brand-domain SPF/DKIM/DMARC values can be confirmed while the referenced domain returns NXDOMAIN. Confirm domain ownership/name and provider before making DNS changes.
- **EMAIL PROVIDER ACTION REQUIRED:** Verify authorized sender identity and review account sending limits, bounce/complaint reports, and message headers.
- **UNRESOLVED:** Inbox placement, domain/IP reputation, message-level SPF/DKIM/DMARC results, bounce/complaint webhook handling, and durable queued retries. These require provider/domain access and real test messages.

The changes improve correctness and observability, but they do not promise or guarantee inbox placement.
