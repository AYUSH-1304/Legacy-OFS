import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/tickets";
const LOGIN_URL = "http://localhost:5000/api/auth/login";

const TEMPLATES = [
  "Field Service Ticket",
  "Inspection Report",
  "Maintenance Record",
  "Service Request",
  "Work Completion Report",
];

function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [token, setToken] = useState(
    () => localStorage.getItem("token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [loggingIn, setLoggingIn] = useState(false);

  const [form, setForm] = useState({
    ticket_number: "",
    template_name: TEMPLATES[0],
    customer_name: "",
    work_start_date: "",
    work_end_date: "",
    comments: "",
  });

  // Har protected API request mein token bhejein.
  async function apiRequest(url, options = {}) {
    const currentToken = localStorage.getItem("token");

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(currentToken
          ? { Authorization: `Bearer ${currentToken}` }
          : {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken("");
      setUser(null);

      throw new Error(
        "Login expire ho gaya hai ya token invalid hai. Dobara login karein."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${response.status})`
      );
    }

    return data;
  }

  // Login
  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoggingIn(true);

    try {
      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Login failed."
        );
      }

      // Backend response mein token hona zaroori hai.
      const accessToken = data.token || data.accessToken;

      if (!accessToken) {
        throw new Error(
          "Login response mein token nahi mila. Backend login route check karein."
        );
      }

      localStorage.setItem("token", accessToken);

      const userData = data.user || null;

      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
      }

      setToken(accessToken);
      setUser(userData);
      setLoginForm({ email: "", password: "" });
      setSuccess("Login successful!");

      await fetchTickets();
    } catch (err) {
      setError(err.message || "Login nahi ho paya.");
    } finally {
      setLoggingIn(false);
    }
  }

  // Database se tickets load karein.
  async function fetchTickets() {
    if (!localStorage.getItem("token")) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(API_URL);
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Tickets load nahi ho paaye.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      fetchTickets();
    } else {
      setLoading(false);
    }
    // Initial login state ke liye.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleLoginChange(event) {
    const { name, value } = event.target;

    setLoginForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Ticket create karein.
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Pehle login karein.");
      return;
    }

    if (
      !form.ticket_number.trim() ||
      !form.template_name ||
      !form.customer_name.trim()
    ) {
      setError(
        "Ticket number, template aur customer name zaroori hain."
      );
      return;
    }

    if (
      form.work_start_date &&
      form.work_end_date &&
      form.work_end_date < form.work_start_date
    ) {
      setError("Work end date, start date se pehle nahi ho sakti.");
      return;
    }

    setSaving(true);

    try {
      const data = await apiRequest(API_URL, {
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
          comments: form.comments.trim(),
        }),
      });

      setSuccess(
        `Ticket ${data.ticket_number || ""} database mein save ho gaya!`
      );

      setForm({
        ticket_number: "",
        template_name: TEMPLATES[0],
        customer_name: "",
        work_start_date: "",
        work_end_date: "",
        comments: "",
      });

      await fetchTickets();
    } catch (err) {
      setError(err.message || "Ticket save nahi hua.");
    } finally {
      setSaving(false);
    }
  }

  // Ticket status update karein.
  async function updateTicketStatus(ticketId, action) {
    setError("");
    setSuccess("");

    let comment = "";

    if (action === "reject") {
      comment = window.prompt("Rejection reason likhein:");

      if (comment === null) return;

      if (!comment.trim()) {
        setError("Reject karne ke liye reason dena zaroori hai.");
        return;
      }
    }

    try {
      const data = await apiRequest(
        `${API_URL}/${ticketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, comment }),
        }
      );

      setSuccess(
        `Ticket ${ticketId} ka status ${data.status} ho gaya.`
      );

      await fetchTickets();
    } catch (err) {
      setError(err.message || "Status update nahi hua.");
    }
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken("");
    setUser(null);
    setTickets([]);
    setError("");
    setSuccess("Logout successful.");
  }

  // Login screen
  if (!token) {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <h1>Legacy OFS</h1>
            <p>Field Ticketing &amp; Inspections</p>
          </div>
        </header>

        <main className="container">
          <section className="panel">
            <h2>Login</h2>
            <p>Tickets dekhne aur create karne ke liye login karein.</p>

            {error && (
              <div className="message error">{error}</div>
            )}

            {success && (
              <div className="message success">{success}</div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-grid">
                <label className="full-width">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    placeholder="Enter your email"
                    autoComplete="username"
                    required
                  />
                </label>

                <label className="full-width">
                  Password
                  <input
                    type="password"
                    name="password"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              </div>

              <button type="submit" disabled={loggingIn}>
                {loggingIn ? "Logging in..." : "Login"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  const role = user?.role || "field_worker";
  const isAdmin = role === "admin";

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Legacy OFS</h1>
          <p>Field Ticketing &amp; Inspections</p>
        </div>

        <div>
          <span className="role-label">
            {isAdmin ? "Administrator" : "Field Worker"}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="container">
        <section className="welcome">
          <h2>Ticket Dashboard</h2>
          <p>Create field tickets and view saved records.</p>
        </section>

        {error && (
          <div className="message error">{error}</div>
        )}

        {success && (
          <div className="message success">{success}</div>
        )}

        <section className="stats">
          <div className="stat-card">
            <span>Total Tickets</span>
            <strong>{tickets.length}</strong>
          </div>

          <div className="stat-card">
            <span>Draft Tickets</span>
            <strong>
              {tickets.filter((t) => t.status === "Draft").length}
            </strong>
          </div>

          <div className="stat-card">
            <span>Submitted Tickets</span>
            <strong>
              {tickets.filter((t) => t.status === "Submitted").length}
            </strong>
          </div>
        </section>

        <section className="panel">
          <h2>Create New Ticket</h2>

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
                    <th>Actions</th>
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
                      <td>
                        {["Draft", "Rejected"].includes(ticket.status) && (
                          <button
                            type="button"
                            onClick={() =>
                              updateTicketStatus(ticket.id, "submit")
                            }
                          >
                            Submit
                          </button>
                        )}

                        {isAdmin && ticket.status === "Submitted" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                updateTicketStatus(ticket.id, "approve")
                              }
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateTicketStatus(ticket.id, "reject")
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {isAdmin && ticket.status === "Approved" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateTicketStatus(ticket.id, "invoice")
                            }
                          >
                            Invoice
                          </button>
                        )}
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