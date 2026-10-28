#  Final Testing and Validation

## 1. Objective
Validate the frontend, backend, PostgreSQL database connection, and ticket workflow.

## 2. Testing Checklist
- Backend starts successfully on port 5000.
- `/api/health` confirms database connectivity.
- Frontend starts successfully.
- Existing tickets display in the dashboard.
- New tickets can be created.
- Ticket data is saved in PostgreSQL.
- Draft and Submitted ticket counts display correctly.
- Ticket status workflow is tested.
- Approve and Reject actions are tested if implemented.
- Errors are checked and documented.

## 3. Commands Used

Backend:
```powershell
cd D:\Legacy-OFS\backend
node server.js
```

Frontend — open a second terminal:
```powershell
cd D:\Legacy-OFS\frontend
npm run dev
```

## 4. API Validation

Check backend health:
```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

Check tickets:
```powershell
Invoke-RestMethod http://localhost:5000/api/tickets
```

## 5. Results
Record the actual results of each test. Mark a test as passed only after verifying it.

## 6. Issues and Improvements
Document any errors, missing features, and fixes required before the final demo.

## 7. Conclusion
Final testing helps verify that the Legacy OFS application is ready for project demonstration.