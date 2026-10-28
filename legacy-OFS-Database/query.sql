-- Legacy OFS database setup
-- Run this in your existing Legacy OFS PostgreSQL database.
-- No DROP or DELETE statements: existing ticket data is preserved.

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('field_worker', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tickets table (created only if it does not already exist)
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(100) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    work_start_date DATE,
    work_end_date DATE,
    comments TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Approval/rejection fields for an existing tickets table
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);

-- 4. Ticket line items
CREATE TABLE IF NOT EXISTS ticket_line_items (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    item_type VARCHAR(30),
    description TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Devices registered to accounts
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(150) NOT NULL,
    device_identifier VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Ticket status history
CREATE TABLE IF NOT EXISTS ticket_status_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_name);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_line_items_ticket_id ON ticket_line_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket_id ON ticket_status_history(ticket_id);

-- 8. Verification: list tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 9. Verification: inspect tickets columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tickets'
ORDER BY ordinal_position;
