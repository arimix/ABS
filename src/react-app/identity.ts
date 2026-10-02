interface StoredIdentity {
  participantId: string;
  name: string;
}

function key(code: string): string {
  return `forkd:${code.toUpperCase()}`;
}

export function saveIdentity(code: string, identity: StoredIdentity): void {
  try {
    localStorage.setItem(key(code), JSON.stringify(identity));
  } catch {
    // localStorage unavailable (private mode etc) — session still works, just won't persist across reloads
  }
}

export function loadIdentity(code: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}
