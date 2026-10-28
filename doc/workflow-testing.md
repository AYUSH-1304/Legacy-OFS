# Legacy OFS — Ticket Workflow Testing

## Objective
Verify ticket status transitions and persistence in PostgreSQL.

## Workflow Tests

- Draft ticket can be submitted.
- Submitted ticket can be approved by an administrator.
- Submitted ticket can be rejected by an administrator.
- Status changes persist in PostgreSQL.
- Updated status appears on the frontend.
- Invalid status transitions are rejected.
- Invalid ticket IDs return appropriate errors.

## Test Evidence
Record the ticket ID, requested action, API response, and final database status.

## Issues
Document errors and their fixes.

## Pending Work
List workflow features that remain incomplete.