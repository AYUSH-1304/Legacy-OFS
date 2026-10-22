import { useEffect, useState } from "react";

const API = "http://localhost:5000/api";

export default function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadTickets() {
    setLoading(true);
    setError("");

    try {
      const token = sessionStorage.getItem("token");

      if (!token) throw new Error("Please log in first");

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);

      const response = await fetch(
        `${API}/tickets?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load tickets");
      }

      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, [status]);

  async function changeStatus(id, action) {
    const comment =
      action === "reject"
        ? window.prompt("Enter the rejection reason:")
        : "";

    if (action === "reject" && !comment?.trim()) return;

    try {
      const response = await fetch(`${API}/tickets/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`
        },
        body: JSON.stringify({ action, comment })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Status update failed");
      }

      await loadTickets();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <h1>Legacy OFS Admin Dashboard</h1>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          loadTickets();
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ticket or customer"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {["Draft", "Submitted", "Approved", "Rejected", "Invoiced", "Void"]
            .map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
        </select>

        <button type="submit">Search</button>
      </form>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading tickets...</p>}

      {!loading && tickets.length === 0 && <p>No tickets found.</p>}

      <div className="ticket-list">
        {tickets.map((ticket) => (
          <article key={ticket.id} className="ticket-card">
            <h2>{ticket.title}</h2>
            <p>Customer: {ticket.customer_name || "—"}</p>
            <p>Status: {ticket.status}</p>

            {ticket.status === "Submitted" && (
              <div>
                <button onClick={() => changeStatus(ticket.id, "approve")}>
                  Approve
                </button>
                <button onClick={() => changeStatus(ticket.id, "reject")}>
                  Reject
                </button>
              </div>
            )}

            {ticket.status === "Approved" && (
              <button onClick={() => changeStatus(ticket.id, "invoice")}>
                Mark invoiced
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}