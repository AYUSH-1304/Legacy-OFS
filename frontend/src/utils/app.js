
const API_BASE_URL = "http://localhost:5000/api";

export async function apiRequest(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Backend connection failed. Check whether the server is running on port 5000."
    );
  }

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned an invalid response.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return data;
}

export function getTickets() {
  return apiRequest("/tickets");
}

export function createTicket(ticket) {
  return apiRequest("/tickets", {
    method: "POST",
    body: JSON.stringify(ticket),
  });
}

export function updateTicketStatus(ticketId, action) {
  return apiRequest(`/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}
