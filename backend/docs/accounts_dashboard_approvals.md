# Accounts Dashboard approvals

The dashboard card **Expense claims to approve** lists pending expense claims. The list is included on `GET /accounts/dashboard` for anyone who can already open that dashboard.

Approve stays on `POST /hr/expenses/approvals/approve`, which requires the HR module. Admin and HR keep that permission. Accountant does not. The card is read-only for Accountant and shows **Awaiting HR approval**. The approve route also returns 403 when the approver is the claim creator (`created_by_name` matches the user's name or email).

## Backlog

These types are not on the dashboard. They do not have an approve route that records who created the document, so they cannot enforce the same self-approval rule.

- Vendor bills (`PATCH /procurement/vendor-bills/{id}/status` can set `approved`, and the bill has no creator).
- Credit notes (stored as invoices; `PATCH /sales/invoices/{id}/status` is a generic status write, not an approval).
