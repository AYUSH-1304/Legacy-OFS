
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('field_worker', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    device_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(30) UNIQUE NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    work_start_date DATE,
    work_end_date DATE,
    comments TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft'
        CHECK (status IN (
            'Draft', 'Submitted', 'Approved',
            'Rejected', 'Invoiced', 'Void'
        )),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_line_items (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL
        REFERENCES tickets(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1
        CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (unit_price >= 0)
);

-- Check Database Command
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;