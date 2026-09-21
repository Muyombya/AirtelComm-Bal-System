# BUILD 032 — Branch User Login Fix & Manager Password Reset

## PATCH ONLY
This ZIP contains only the files changed for BUILD 032 plus this README. Do not replace or copy any other project files.

## Changes
- Fix the Branch User authentication path.
- Add Manager-controlled password reset for Branch Users.
- Reset creates a fresh password salt/hash, requires password change on next login, and invalidates existing sessions for that user.
- Reset control is for Branch Users only.

## Files to replace
- server/src/controllers/authController.js
- server/src/routes/authRoutes.js
- client/src/services/api.js
- client/src/components/UserManagement.jsx
- client/src/user-management.css

## Database
No database migration is required.

## Test
1. Restart backend and frontend.
2. Log in as Manager.
3. Open User Management.
4. Find the affected Branch User (for example, racheal).
5. Use Reset Password and set a temporary password of at least 8 characters.
6. Sign out Manager.
7. Log in as the Branch User with the temporary password.
8. Confirm the user is taken to Change Password.
9. Set the user’s permanent password and continue.

## Not touched
- database migrations
- Till Balancing
- General Shop Status
- Cash Book
- Terminal Management
- Master Data
- atlas_development
