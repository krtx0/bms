// Downloads a binary file (e.g. an invoice PDF) from an authenticated API endpoint as a blob and
// triggers the download via a temporary object URL — a plain <a href> can't drive a fetch with a
// chosen filename. Ported from frontend/src/lib/download.ts; simplified since frontend and
// backend are now the same Next.js origin (see apiClient.ts) — no API_URL prefix or explicit
// cross-origin credentials mode needed, the session cookie rides along by default.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
