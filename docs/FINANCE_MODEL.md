# Finance feature — external-payment recording only

The Hub will **not process payments**, handle bank credentials, store card data, initiate transfers, or provide an in-app checkout.

## Functional requirements

- Staff create a fee obligation: student ID, term, due amount, due date and status.
- Authorized finance/admin staff record externally confirmed payments (cash, bank, mobile money) with date, amount, reference, receiving staff account and optional non-sensitive receipt ID.
- Statuses: Unpaid, Partial, Paid, Overdue (overdue is date-based; keep separate from balance calculation).
- Issue a numbered acknowledgment / receipt **after independent verification**; support adjustments and refunds via immutable reversing entries rather than deleting history.
- Admin finance dashboard: outstanding balances, totals by class/term, reconciled vs. pending, overdue totals.
- Parent/guardian communication: send acknowledgment only to verified contacts, with a lawful basis or consent as appropriate; never disclose a different student's information.
- Email and WhatsApp integrations are **not present in this prototype**. Later outbound messages require authorized provider accounts, API tokens stored as server-side secrets, event/audit logs, opt-out handling and anti-duplicate safeguards.

## Tentative records

- guardians(id, verified_contact_info, contact_preferences)
- students(id, ...)
- student_guardians(student_id, guardian_id, relationship, authorization)
- fee_obligations(id, student_id, period, amount, due_date, currency)
- payment_records(id, fee_obligation_id, amount, paid_at, method, external_reference, recorded_by, verified_by, created_at)
- payment_adjustments(id, payment_record_id, delta, reason, approved_by, created_at)
- receipt_deliveries(id, payment_record_id, guardian_id, channel, status, sent_at, provider_message_id)
- finance_audit_events(id, actor_id, action, target_id, created_at)

Define approved retention windows, access policies, encryption and backup/restore tests before production. Guardian payment records and contact information are sensitive personal data; do not add them to public code, logs or fixtures.
