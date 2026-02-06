export async function readResponseBody(response) {
  if (!response) return { json: null, text: "" };
  const contentType = response.headers?.get?.("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return { json, text: "" };
    }
  } catch (_) {
    // fall through to text
  }

  try {
    const text = await response.text();
    return { json: null, text };
  } catch (_) {
    return { json: null, text: "" };
  }
}

export function toUserFacingMessage({
  status,
  apiMessage,
  fallback,
} = {}) {
  const msg = String(apiMessage || "").trim();
  const msgLower = msg.toLowerCase();

  if (status === 400) return msg || "Please check your input and try again.";
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) {
    // Avoid exposing internal/bypass-y wording like "Not allowed" to end users.
    if (msgLower.includes("not allowed")) return "This action isn’t available.";
    return "You don’t have permission to do that.";
  }
  if (status === 404) return "This content isn’t available.";
  if (status === 409) return msg || "This action can’t be completed right now.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";

  return msg || fallback || "Something went wrong. Please try again.";
}

export async function throwIfNotOk(response, { fallback } = {}) {
  if (response?.ok) return response;

  const status = response?.status;
  const { json, text } = await readResponseBody(response);
  const apiMessage =
    (json && (json.message || json.error || json?.data?.message)) || text;

  const userMessage = toUserFacingMessage({
    status,
    apiMessage,
    fallback,
  });

  const err = new Error(userMessage);
  err.status = status;
  err.apiMessage = apiMessage;
  throw err;
}
