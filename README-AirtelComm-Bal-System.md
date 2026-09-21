# AirtelComm-Bal-System

AirtelComm-Bal-System is a web-based branch operations and balancing system designed to manage Till Balancing, daily transaction activity, Cash Book operations, General Shop Status, terminal management, master data, and controlled user access.

The application is built as a React/Vite progressive web application (PWA) with an Express/Node.js API and PostgreSQL database.

## Current Build

**BUILD 040**

BUILD 040 represents the current production baseline of the application. Development will continue from this baseline through subsequent builds.

## Core Modules

The current application includes:

- **Till Balancing**
  - Till-level balancing
  - Operating capital / float information
  - Cash and coin capture
  - Daily transaction counts
  - Balance history
  - Branch User, Supervisor, and Manager access rules

- **Cash Book**
  - Opening balances
  - Cash book entries
  - Expense tracking
  - Cash book history and reporting

- **General Shop Status**
  - Branch operational status information
  - Branch-level operational reporting

- **Terminal Management**
  - Terminal master data
  - Terminal and branch assignment

- **Master Data**
  - Branch, Till, terminal, and related operational master data

- **User Management**
  - User administration
  - Role and branch/till assignments
  - Password management

- **Authentication & Access Control**
  - User authentication
  - Session-based access
  - Role-based permissions
  - Branch access restrictions
  - Assigned Till restrictions for Branch Users
  - Forced password change support

## User Roles

### Manager

Managers have access to the system's administrative and operational functions, including:

- Master Data
- Terminal Management
- Till Balancing
- General Shop Status
- Cash Book
- User Management

### Supervisor

Supervisors have operational access appropriate to their assigned branch, including:

- Till Balancing
- General Shop Status
- Cash Book

### Branch User

Branch Users are restricted to their assigned Till for Till Balancing operations.

## Technology Stack

### Frontend

- React 19
- Vite
- Tailwind CSS
- Vite PWA
- JavaScript / JSX

### Backend

- Node.js
- Express 5
- PostgreSQL client (`pg`)
- CORS
- dotenv

### Database

- PostgreSQL
- SQL migration files maintained in `database/migrations/`
- Initial seed data maintained in `database/seeds/`

## Project Structure

```text
AirtelComm-Bal-System/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── routes/
│   └── package.json
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── maintenance/
│   └── README.md
│
├── package.json
├── .env.example
└── README.md
```

## Running the Application Locally

### Requirements

Install the following before running the system:

- Node.js
- npm
- PostgreSQL

### Install dependencies

From the project root:

```bash
npm install
```

Then install the frontend and backend dependencies:

```bash
npm install --prefix client
npm install --prefix server
```

### Configure the database

Create a PostgreSQL database for the application and configure the server environment variables.

Create a local environment file based on `.env.example`.

**Never commit `.env` files or database passwords to GitHub.**

### Run frontend and backend together

```bash
npm run dev
```

The root development command starts both the Vite frontend and the Node/Express backend.

You can also run them separately:

```bash
npm run dev:client
```

or:

```bash
npm run dev:server
```

## Production Build

Build the frontend with:

```bash
npm run build
```

Start the backend with:

```bash
npm start
```

For production deployment, configure the production database and environment variables through the hosting provider rather than storing production credentials in the repository.

## Database Migrations

Database changes are maintained as numbered SQL migration files under:

```text
database/migrations/
```

Migrations should be applied in their intended sequence.

Initial seed data is stored under:

```text
database/seeds/
```

The maintenance directory contains scripts intended for controlled administrative use. Destructive or test-data reset scripts must not be executed against a production database unless explicitly intended.

## Environment Configuration

The backend uses environment variables for its runtime configuration.

Typical local configuration includes:

```text
PORT=5000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=airtelcomm_bal_system
DATABASE_USER=postgres
DATABASE_PASSWORD=your_local_database_password
```

Production environments should provide equivalent values through their hosting platform's secure environment-variable system.

The frontend API endpoint should also be configured for the production API rather than relying on a local development address.

## Security Notes

- Do not commit `.env` files.
- Do not commit production database credentials.
- Do not expose database credentials in frontend code.
- Production deployments should use HTTPS.
- Production CORS should be restricted to the approved frontend origin.
- Database migrations should be reviewed before production execution.
- Test/reset database scripts must never be run against production data unintentionally.

## Development and Release Workflow

The project uses incremental builds so that changes can be tested and released in controlled stages.

The intended workflow is:

```text
Development
    ↓
Test
    ↓
Fix
    ↓
Confirm
    ↓
Build
    ↓
Production
```

BUILD 040 is the current baseline. Future work should be developed as subsequent builds, for example:

```text
BUILD 040
BUILD 041
BUILD 042
...
```

GitHub should be treated as the source repository for the application, while the production hosting services deploy from the approved repository branch.

## Progressive Web App

The frontend is configured as a Progressive Web App.

The application can be installed on supported devices and launched in a standalone application-style experience.

PWA configuration is maintained in:

```text
client/vite.config.js
```

## Operational Principles

The system is designed around controlled branch and Till operations.

Important operational concepts include:

- Branch
- Till
- Terminal
- Operating Capital
- Daily Transactions
- Cash Book
- Balance
- Short
- Excess
- User Role
- Branch Assignment
- Till Assignment

These concepts are part of the application's business domain and should remain consistent when new modules are introduced.

## Status

**Current status: Production baseline — BUILD 040**

The system is being prepared for production deployment, with further functionality and UI improvements planned through subsequent builds.

## License

This project is proprietary software. Unless explicitly stated otherwise by the project owner, the source code and business logic are not licensed for redistribution, resale, or unauthorized use.
