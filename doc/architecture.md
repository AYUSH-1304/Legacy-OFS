# Legacy OFS — System Architecture

## 1. Project Overview

Legacy OFS is a mobile-friendly Field Ticketing and Inspections Application for oilfield services.

## 2. System Components

- Frontend: React and Vite
- Backend: Node.js and Express.js
- Database: PostgreSQL
- API: REST API

## 3. Data Flow

1. The field worker creates a ticket using the frontend.
2. The frontend sends an HTTP request to the backend API.
3. The backend validates the request and processes it.
4. PostgreSQL stores the ticket information.
5. The backend returns the response to the frontend.
6. The frontend displays the updated ticket information.

## 4. Existing API Endpoints

- GET / — Backend status
- GET /api/health — Backend and database health check
- GET /api/tickets — Retrieve tickets
- POST /api/tickets — Create a ticket

## 5. Project Review

Verify ticket status workflow, administrator permissions, offline support, validation, and final testing.

## 6. Current Limitations

Record any features that are not yet implemented or tested.