# BUILD 048 — Outside-Till shortage responsibilities

## Purpose

Record branch liabilities assigned to a worker when the amount is not the result of that worker's Till Balance, for example a deposit held by a bank or cash deposit machine.

## Database

Apply the new migration once to the application database:

```sh
psql -U postgres -d airtelcomm_bal_system -f database/migrations/048_branch_external_shortage_responsibilities.sql
```

Do not rerun earlier migrations.

## Use

- Managers and Supervisors use **Shortage Counter** to record the worker, amount, date, and reason/reference.
- A responsibility can be settled in full or in part. The API rejects settlements above the outstanding amount and dates earlier than the responsibility.
- Outside-Till balances and settlements are combined with Till shortage events by worker in the General Shop Status summary and Branch Status report.
- The General Shop Status report shows `Outside Till` in the source/Till column when applicable.
- Each responsibility and settlement is stored as a separate ledger record so its note, date, and history are retained.

## Notes

The responsibility ledger is separate from Till Balancing. Recording an outside-Till responsibility does not create or change a Till Balance record.
