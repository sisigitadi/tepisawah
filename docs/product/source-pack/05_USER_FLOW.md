# End-to-End User Flow

## Flow A — Customer self ordering

Customer sits at table
→ scans table QR
→ system identifies table
→ customer sees welcome
→ browses menu
→ adds items
→ reviews cart
→ submits order
→ order enters pending confirmation
→ cashier reviews
→ cashier confirms
→ kitchen ticket created
→ kitchen prepares
→ kitchen marks READY
→ waiter sees ready order
→ waiter delivers
→ waiter marks SERVED
→ payment is recorded
→ order becomes COMPLETED

## Flow B — Waiter ordering

Customer asks waiter
→ waiter selects table
→ waiter selects menu
→ waiter submits order
→ cashier reviews
→ kitchen prepares
→ ready
→ waiter serves
→ payment
→ completed

## Flow C — Call waiter

Customer presses CALL WAITER
→ service request created
→ waiter sees request
→ waiter accepts
→ waiter attends table
→ waiter marks resolved

## Flow D — Rejection/cancellation

Order submitted
→ cashier rejects or cancels according to reason
→ customer sees appropriate status
→ no kitchen ticket should remain active

## Critical rule
Order state transitions must be centralized. Frontend must not invent its own independent status model.
