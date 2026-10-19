import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/tickets";

const TEMPLATES = [
  "Field Service Ticket",
  "Inspection Report",
  "Maintenance Record",
  "Service Request",
  "Work Completion Report",
];

function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    ticket_number: "",
    template_name: TEMPLATES[0],
    customer_name: "",
    work_start_date: "",
    work_end_date: "",
    comments: "",
  });

  // Database se tickets load karein
  async function fetchTickets() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Tickets load nahi ho paaye.");
      }

      const data = await response.json();
      setTickets(data);
    } catch (err) {
      setError(
        "Backend se connection nahi ho raha. Check karein ki server port 5000 par chal raha hai."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, []);

  // Form fields update karein
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Ticket PostgreSQL mein save karein
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.ticket_number.trim() ||
      !form.template_name ||
      !form.customer_name.trim()
    ) {
      setError("Ticket number, template aur customer name zaroori hain.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticket_number: form.ticket_number.trim(),
          template_name: form.template_name,
          customer_name: form.customer_name.trim(),
          work_start_date: form.work_start_date || null,
          work_end_date: form.work_end_date || null,
          comments: form.comments.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Ticket could not be saved."
        );
      }

      setSuccess("The ticket has been successfully saved to the database!");

      setForm({
        ticket_number: "",
        template_name: TEMPLATES[0],
        customer_name: "",
        work_start_date: "",
        work_end_date: "",
        comments: "",
      });

      // Database se latest tickets dobara load karein
      await fetchTickets();
    } catch (err) {
      setError(
        err.message ||
          "Ticket save nahi hua. Backend aur database connection check karein."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Legacy OFS</h1>
          <p>Field Ticketing & Inspections</p>
        </div>
        <span className="role-label">Field Worker</span>
      </header>

      <main className="container">
        <section className="welcome">
          <h2>Ticket Dashboard</h2>
          <p>Create field tickets and view saved records.</p>
        </section>

        <section className="stats">
          <div className="stat-card">
            <span>Total Tickets</span>
            <strong>{tickets.length}</strong>
          </div>

          <div className="stat-card">
            <span>Draft Tickets</span>
            <strong>
              {tickets.filter((ticket) => ticket.status === "Draft").length}
            </strong>
          </div>

          <div className="stat-card">
            <span>Submitted Tickets</span>
            <strong>
              {
                tickets.filter(
                  (ticket) => ticket.status === "Submitted"
                ).length
              }
            </strong>
          </div>
        </section>

        <section className="panel">
          <h2>Create New Ticket</h2>

          {error && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Ticket Number *
                <input
                  type="text"
                  name="ticket_number"
                  placeholder="e.g. OFS-1001"
                  value={form.ticket_number}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Ticket Template *
                <select
                  name="template_name"
                  value={form.template_name}
                  onChange={handleChange}
                  required
                >
                  {TEMPLATES.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Customer Name *
                <input
                  type="text"
                  name="customer_name"
                  placeholder="Enter customer name"
                  value={form.customer_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Work Start Date
                <input
                  type="date"
                  name="work_start_date"
                  value={form.work_start_date}
                  onChange={handleChange}
                />
              </label>

              <label>
                Work End Date
                <input
                  type="date"
                  name="work_end_date"
                  value={form.work_end_date}
                  onChange={handleChange}
                />
              </label>

              <label className="full-width">
                Comments
                <textarea
                  name="comments"
                  placeholder="Enter work details or comments"
                  value={form.comments}
                  onChange={handleChange}
                  rows="4"
                />
              </label>
            </div>

            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Ticket"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Saved Tickets</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={fetchTickets}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p>Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="empty-state">
              No tickets yet. Create your first ticket above.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Ticket No.</th>
                    <th>Template</th>
                    <th>Customer</th>
                    <th>Start Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.ticket_number}</td>
                      <td>{ticket.template_name}</td>
                      <td>{ticket.customer_name}</td>
                      <td>
                        {ticket.work_start_date
                          ? String(ticket.work_start_date).slice(0, 10)
                          : "—"}
                      </td>
                      <td>
                        <span className="status">
                          {ticket.status || "Draft"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;