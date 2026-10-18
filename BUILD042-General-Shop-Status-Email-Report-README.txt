BUILD 042 - General Shop Status Email Report

Purpose
Add a protected Email Report workflow to General Shop Status without changing the existing report calculations or database schema.

Flow
General Shop Status -> Email Report -> To / CC / Subject / Message -> server loads the selected branch/date -> server generates PDF -> SMTP sends PDF attachment.

Changed files
- .env.example
- server/package.json
- server/src/config/environment.js
- server/src/controllers/generalShopStatusController.js
- server/src/controllers/generalShopStatusEmailController.js
- server/src/routes/generalShopStatusRoutes.js
- server/src/services/emailService.js
- server/src/services/gssReportPdf.js
- client/src/services/api.js
- client/src/components/GeneralShopStatus.jsx
- client/src/components/general-shop-status-email.css

No database migration is required.

SMTP configuration is environment-only. Never commit real SMTP credentials.

Required environment variables
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM

Authorization
The email endpoint uses the existing supervisor access and branch access middleware. Managers may select any branch; supervisors remain restricted to their assigned branch.

Endpoint
POST /api/general-shop-status/email-report

Validation
- Valid branch ID
- YYYY-MM-DD business date
- At least one valid To recipient
- Optional valid CC recipients
- Subject required, max 180 characters
- Message max 5,000 characters

Testing performed on the BUILD 042 source package
- JavaScript syntax checks passed for all changed server files and API file.
- Babel JSX parsing passed for GeneralShopStatus.jsx.
- Client Vite build could not be executed in the extracted test copy because its Linux Rollup optional binary is missing. This is an environment limitation of the extracted copy, not a reported application error.
- The actual project already has nodemailer@10.0.14 and pdfkit@0.20.2 installed.


Packaging correction: the new email stylesheet is located at client/src/general-shop-status-email.css, matching the project CSS structure. GeneralShopStatus.jsx imports it as ../general-shop-status-email.css. Existing general-shop-status-header-facelift.css remains at client/src/.
