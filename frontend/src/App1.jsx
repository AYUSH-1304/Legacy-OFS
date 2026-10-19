
import { useState } from "react";
import "./App.css";

function App() {
  const [tickets, setTickets] = useState([]);
  const [customer, setCustomer] = useState("");
  const [template, setTemplate] = useState("Service Request");

  function createTicket(event) {
    event.preventDefault();

    if (!customer.trim()) {
      alert("Please enter customer name");
      return;
    }

    const newTicket = {
      id: Date.now(),
      ticketNumber: `OFS-${Date.now().toString().slice(-6)}`,
      customer: customer.trim(),
      template,
      status: "Draft",
    };

    setTickets((previous) => [newTicket, ...previous]);
    setCustomer("");
  }

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Legacy OFS</h1>
          <p>Field Ticketing and Inspections</p>
        </div>
        <span className="role">Field Worker</span>
      </header>

      <section className="summary">
        <div className="card">
          <h3>Total Tickets</h3>
          <p>{tickets.length}</p>
        </div>
        <div className="card">
          <h3>Draft Tickets</h3>
          <p>{tickets.filter((t) => t.status === "Draft").length}</p>
        </div>
        <div className="card">
          <h3>Submitted</h3>
          <p>{tickets.filter((t) => t.status === "Submitted").length}</p>
        </div>
      </section>

      <section className="panel">
        <h2>Create Field Ticket</h2>

        <form onSubmit={createTicket}>
          <label htmlFor="customer">Customer Name</label>
          <input
            id="customer"
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            placeholder="Enter customer name"
            required
          />

          <label htmlFor="template">Ticket Template</label>
          <select
            id="template"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          >
            <option>Service Request</option>
            <option>Field Work</option>
            <option>Inspection</option>
            <option>Maintenance</option>
            <option>Equipment Service</option>
          </select>

          <button type="submit">Create Ticket</button>
        </form>
      </section>

      <section className="panel">
        <h2>Recent Tickets</h2>

        {tickets.length === 0 ? (
          <p className="empty">No tickets yet. Create your first ticket.</p>
        ) : (
          <div className="ticket-list">
            {tickets.map((ticket) => (
              <article className="ticket" key={ticket.id}>
                <div>
                  <strong>{ticket.ticketNumber}</strong>
                  <p>{ticket.customer}</p>
                  <small>{ticket.template}</small>
                </div>
                <span className="status">{ticket.status}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
