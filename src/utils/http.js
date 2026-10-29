class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

/** GET a URL and parse the JSON body. Throws UpstreamError on network, timeout or HTTP errors. */
async function fetchJson(url, { timeoutMs = 10000, headers } = {}) {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new UpstreamError(err.name === 'TimeoutError' ? 'Upstream request timed out' : 'Upstream request failed');
  }
  if (!res.ok) throw new UpstreamError(`Upstream responded with ${res.status}`, res.status);
  try {
    return await res.json();
  } catch {
    throw new UpstreamError('Upstream sent invalid JSON');
  }
}

module.exports = { fetchJson, UpstreamError };
