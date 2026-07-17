# Payment Architecture v2 — design (2026-07-08)

Design deliverable for the accepted-offer → immediate-payment release. Written
before implementation per the execution contract.

## 1. Canonical payment model

The **accepted marketplace offer is the commercial price basis**. There is no
second (post-inspection) customer approval step anymore.

```
customer total  = accepted_offer_amount + delivery_fee + addons − discount
due now         = f(payment_mode) of customer total
remaining       = customer total − amount_paid
```

Order money fields (all on `public.orders`):

| Concept                     | Field                    | Written by                     | Visible to |
|-----------------------------|--------------------------|--------------------------------|------------|
| Initial estimate            | `estimated_price`        | request flow (never overwritten again) | customer, technician, admin |
| Technician offer            | `order_offers.amount`    | `submit_order_offer` RPC       | customer, that technician, admin |
| Accepted offer (price basis)| `accepted_offer_amount`  | `accept_order_offer` RPC       | customer, technician, admin |
| Payment mode snapshot       | `payment_mode`           | `accept_order_offer` RPC (from platform_settings) | all summaries |
| Amount due now              | `upfront_amount_due`     | `accept_order_offer` RPC       | customer, admin |
| Amount paid so far          | `amount_paid`            | `record_order_payment` RPC     | customer, technician, admin, reports |
| Remaining balance           | derived (never stored)   | `utils/orderMoney.ts`          | all |
| Internal spare-part cost    | `spare_parts_cost`       | technician at closure (existing col) | technician, admin/accounting ONLY |
| Legacy quote                | `final_price`, `quote_notes`, `quoted_at` | frozen (read-only fallback for old rows) | — |

`payment_status`: `unpaid → partially_paid → paid` (plus legacy
`pending`/`pending_payment`/`refunded` for gateway flows). Check constraint
extended with `partially_paid`.

Every cash settlement goes through `record_order_payment(order_id, amount,
method)` (SECURITY DEFINER): allowed for the order's customer, its assigned
technician, or admin; inserts a `payments` row and bumps
`orders.amount_paid` + `payment_status` atomically. Reports read real rows.

## 2. State transitions (replacing the post-inspection quote flow)

Old: pending → accepted → diagnosing → **quoted → (customer approves) →
awaiting_payment** → repairing…

New:

```
pending (offers) → accept_order_offer → awaiting_payment
awaiting_payment → customer confirms payment (payment.tsx) → accepted
accepted → picking_up → diagnosing → waiting_parts → repairing → testing → delivering → completed
```

- `quoted` is removed from the active journey. Enum value stays for legacy
  rows; migration moves live `quoted` orders → `awaiting_payment` with
  `accepted_offer_amount = final_price` (the payment-confirmation screen is
  the customer's explicit approval moment; they can still cancel there).
- `setQuote` / `respondToQuote` / `setTechnicianQuote` are deleted, along with
  the technician quote card and the customer quote-approval card.
- Technician workflow gating changes from "has accepted quote" to "order has
  an agreed price" (`accepted_offer_amount ?? final_price`), i.e. everything
  after `awaiting_payment` is unlocked.
- Completion (modes B/C or COD): the technician's *Complete order* action
  opens a closure sheet — internal spare-part cost + "I collected the
  remaining X SAR" confirmation → `record_order_payment` → `completed`.

## 3. Admin-configurable payment modes

`platform_settings` keys (JSONB, admin-editable in Platform Settings → new
"Payment policy" section — no code changes to switch):

| Key | Meaning | Default |
|-----|---------|---------|
| `payment_mode_active` | `full_upfront` \| `deposit_then_rest` \| `partial_then_final` | `full_upfront` |
| `payment_deposit_type` | `fixed` \| `percent` (mode B) | `fixed` |
| `payment_deposit_value` | SAR or % (mode B) | 50 |
| `payment_partial_percent` | % due now (mode C) | 50 |

`accept_order_offer` snapshots the active mode onto the order so an admin
change never rewrites live orders. Pure helper `utils/paymentPlan.ts`
(unit-tested) computes due-now on both server (SQL mirror) and client.

## 4. Courier–technician chat

New table `courier_chat_messages(task_id → delivery_tasks, sender_id,
content, is_read, created_at)`. RLS: only the task's courier and the order's
assigned technician can read/insert (admin read). INSERT check requires task
status ∈ (accepted, picked_up, delivered) → the chat **auto-closes at the DB
level** when the task completes/cancels; UI shows a locked banner. Realtime
enabled. Customer is never a participant. Screen:
`app/courier-chat/[taskId].tsx`, entered from the courier task detail and
from the technician's manage-order (when a live task exists).

## 5. Timeline / status history

- `order_timeline.actor_type` gains `courier`.
- Trigger on `delivery_tasks` writes courier steps into `order_timeline`
  with statuses `courier_<task_type>_<status>` (e.g.
  `courier_pickup_accepted` → "Courier heading to collect from you",
  `courier_pickup_picked_up` → "Device collected from customer").
- Client label map for these events in order-details + admin-order-detail.
- Accepted offer price shown clearly in order details ("Agreed price").

## 6. Courier stage-based actions + area upgrade

Task detail becomes stage-focused: the current target stop (customer before
pickup, technician after) is emphasized with Directions / Call / Chat;
the other stop is collapsed. My-tasks gains active/history sections + totals.

## 7. Screens/services touched

migrations(1 new) · types/order.ts · utils/paymentPlan.ts(new) ·
utils/orderMoney.ts(new) · services: platformSettings, offerMarketplace,
courier, courierChat(new), accounting, orderService, lib/supabase-api ·
screens: payment, order-details, order-offers, (customer)/orders,
(customer)/index, my-orders, (technician)/manage-order, index, chats,
available-orders, job/[id], (courier)/task/[id], my-tasks, courier-chat(new),
admin-platform-settings, admin-order-detail, admin-accounting, admin-orders,
admin-reports, role-selection, onboarding · tests: paymentPlan/orderMoney.

## 8. Regression risks & containment

- Live `quoted`/`awaiting_payment` orders → data migration + fallback money
  helper (`accepted_offer_amount ?? final_price ?? estimated_price`).
- `estimated_price` overwrite removed → legacy orders where it equals the
  offer are acceptable.
- RPC replacement is transactional; client keeps working against old RPC
  signature (same args).
- No RLS weakened: new table locked down; new RPCs enforce role/ownership.
- Spare-part cost never joins any customer-readable payload (verified: only
  manage-order writes it; only admin/accounting + technician screens read it).
