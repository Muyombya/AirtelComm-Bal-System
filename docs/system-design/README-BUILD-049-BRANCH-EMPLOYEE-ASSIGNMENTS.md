# BUILD 049 — Branch worker roster

## Purpose

Maintain a branch roster that includes workers with and without an active Till. This allows the Shortage Counter to select an outside-Till responsible worker from the chosen branch.

## Database

Apply migration 049 to the same database where migration 048 was applied:

```sh
psql -U postgres -d airtelcomm_bal_system -f database/migrations/049_branch_employee_assignments.sql
```

The migration creates `branch_employees` and adds existing active Till attendants to their branch roster. Existing shortage records and balances are unchanged.

## Use

- The **Shortage Counter** page lists employees assigned directly to the selected branch and employees currently assigned to one of its Tills.
- Assign an existing employee without a Till to the branch from the **Branch Workers** section. They then appear in the outside-Till responsibility dropdown.
- Assigning a worker to a Till also records the worker as belonging to that Till's branch. Moving an employee's Till assignment moves their direct roster association with it.
- A worker already associated with a different branch cannot be added as an outside-Till worker until they are moved.
