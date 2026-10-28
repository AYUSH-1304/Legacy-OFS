# Legacy OFS – Field Ticketing and Inspections Application

## Project Overview

Legacy OFS is a mobile-friendly field ticketing and inspections application developed as part of the SkillRev internship capstone project.

The application helps oilfield service field workers create and manage service tickets, while administrators can review submitted tickets and approve or reject them. Ticket records are stored in a PostgreSQL database through a Node.js and Express.js backend.

## Developer Information

- **Project Name:** Legacy OFS – Field Ticketing and Inspections Application
- **Internship:** SkillRev
- **Developer:** Ayush Kumawat
- **Project Type:** Internship Capstone Project

## Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend user interface |
| Node.js | Backend runtime |
| Express.js | REST API development |
| PostgreSQL | Relational database |
| pgAdmin | Database management |
| JavaScript | Application development |
| npm | Package management |
| Visual Studio Code | Development environment |

## Core Features

- Create and view field service tickets.
- Select a ticket template.
- Record customer details, work dates, and comments.
- Store ticket records in PostgreSQL.
- Track ticket statuses:
  - Draft
  - Submitted
  - Approved
  - Rejected
  - Invoiced
  - Void
- Support administrator ticket review and approval/rejection workflows.
- Record rejection reasons.
- Connect the React frontend to the Express backend through REST APIs.
- Check backend and database connectivity.

### Planned Features

The following features require implementation and verification before they can be considered complete:

- User authentication and role-based authorization.
- Service and material line items with quantities and prices.
- Device registration and administrator-controlled device revocation.
- Offline ticket creation and editing.
- Automatic synchronization of pending offline changes.
- Automated tests and production deployment.

## Project Structure

The following is a suggested project structure. Actual files may vary depending on the implementation.

```text
Legacy-OFS/
├── backend/
│   ├── routes/
│   │   ├── auth.js
│   │   └── tickets.js
│   ├── server.js
│   ├── db.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── database_setup.sql
└── README.md
```

## Prerequisites

Install the following software before running the project:

- Node.js and npm
- PostgreSQL
- pgAdmin (optional, for database management)
- Visual Studio Code (recommended)

## Database Setup

1. Start the PostgreSQL service.
2. Open pgAdmin or a PostgreSQL terminal.
3. Create or select the database configured in the backend.
4. Open `database_setup.sql`.
5. Execute the SQL queries against the selected database.
6. Verify that the required tables and columns have been created successfully.

**Note:** Review the existing schema before executing setup queries. The setup script does not intentionally delete existing records.

## Backend Setup

Open a terminal in Visual Studio Code and navigate to the backend directory:

```powershell
cd D:\Legacy-OFS\backend
```

Install the dependencies:

```powershell
npm install
```

Create a `.env` file inside the `backend` directory. Configure the variables expected by `db.js` and the application.

Example configuration:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_long_random_secret
```

Replace the example values with your actual local configuration. Never publish real credentials.

Start the backend using the script configured in `package.json`:

```powershell
npm start
```

If a development script is available, you can instead run:

```powershell
npm run dev
```

The backend should start on port `5000` if that is the configured port.

## Frontend Setup

Open a second terminal:

```powershell
cd D:\Legacy-OFS\frontend
```

Install the frontend dependencies:

```powershell
npm install
```

Start the React development server:

```powershell
npm run dev
```

Open the local URL displayed in the terminal. With the default Vite configuration, it is commonly:

```text
http://localhost:5173
```

## Verify Backend and Database Connectivity

Ensure the backend is running before testing the API.

Open PowerShell and execute:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/"
```

Check database connectivity:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

A successful health-check response should indicate that the server is running and the database connection is working.

If the request fails, verify the backend terminal, port configuration, PostgreSQL service, database credentials, and `.env` settings.

## API Endpoints

The following endpoints are expected based on the current project design. Confirm the actual routes and HTTP methods in the implementation.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Check that the backend is running |
| GET | `/api/health` | Check backend and database connectivity |
| GET | `/api/tickets` | Retrieve tickets |
| POST | `/api/tickets` | Create a ticket |
| PATCH | `/api/tickets/:id/status` | Update ticket status, if implemented |

Authentication, request fields, authorization, and supported status transitions depend on the actual backend implementation.

## Testing Checklist

Use this checklist to verify the application before marking features as complete.

- [ ] PostgreSQL service starts successfully.
- [ ] Backend starts without errors.
- [ ] `/api/health` confirms database connectivity.
- [ ] Frontend opens in the browser.
- [ ] A new ticket can be created.
- [ ] The ticket is saved in PostgreSQL.
- [ ] Saved tickets appear in the dashboard after refresh.
- [ ] Ticket templates can be selected.
- [ ] Ticket status updates are saved correctly.
- [ ] Administrators can approve or reject submitted tickets.
- [ ] Rejection reasons are saved and displayed.
- [ ] Invalid inputs and API errors are handled clearly.
- [ ] Authentication and role permissions are tested, if implemented.
- [ ] Service/material line items are tested, if implemented.
- [ ] Offline synchronization is tested, if implemented.

## Security Considerations

- Never commit `.env` files to GitHub.
- Never publish database passwords, JWT secrets, or real user credentials.
- Validate incoming API data on the backend.
- Restrict approval and rejection actions to authorized administrators.
- Use secure password hashing when authentication is implemented.
- Configure HTTPS and production security before deployment.

## Troubleshooting

### Backend does not start

- Confirm that Node.js and npm are installed.
- Run `npm install` in the backend directory.
- Check the terminal for missing packages or syntax errors.
- Verify that the configured port is available.

### Database connection fails

- Confirm that PostgreSQL is running.
- Verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
- Confirm that the database exists and the configured user has access.

### Tickets are not being saved

- Check the browser console for frontend errors.
- Check the backend terminal for API errors.
- Verify the request URL and request body.
- Confirm that the backend SQL query matches the actual database schema.
- Check the database table to confirm whether the ticket record was inserted.

### Ticket status does not update

- Confirm that the status endpoint exists.
- Verify the ticket ID and request body.
- Check that the requested status transition is allowed.
- Review the API response and backend error logs.

## Future Improvements

1. Complete authentication and role-based access control.
2. Complete and verify ticket creation, retrieval, and updates.
3. Add ticket status history and audit logging.
4. Implement service and material line items.
5. Implement device management and administrator revocation.
6. Implement offline storage and synchronization.
7. Add automated backend and frontend tests.
8. Prepare screenshots, a demonstration video, and final capstone documentation.

## Project Status

The project is designed around a React frontend, a Node.js/Express backend, and a PostgreSQL database.

Feature completion should be confirmed through testing in the running application. In particular, successful frontend display and backend health checks alone do not prove that ticket persistence, authorization, approval workflows, or offline synchronization are working correctly.

## License

This project was developed for the SkillRev internship capstone. Add an appropriate license if the project will be distributed publicly.
