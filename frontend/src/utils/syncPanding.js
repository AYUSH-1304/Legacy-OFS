import {
  getPendingOperations,
  removePendingOperation
} from "./offlineQueue";

export async function syncPendingOperations() {
  if (!navigator.onLine) return;

  const token = sessionStorage.getItem("token");
  if (!token) return;

  const operations = await getPendingOperations();

  if (!operations.length) return;

  const response = await fetch("http://localhost:5000/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ operations })
  });

  if (!response.ok) {
    throw new Error("Sync request failed");
  }

  const data = await response.json();

  for (const result of data.results) {
    if (result.status === "synced") {
      await removePendingOperation(result.operation_id);
    }
  }
}

export function startSyncListener() {
  const handleOnline = () => {
    syncPendingOperations().catch((error) => {
      console.error("Sync will be retried:", error.message);
    });
  };

  window.addEventListener("online", handleOnline);
  handleOnline();

  return () => window.removeEventListener("online", handleOnline);
}