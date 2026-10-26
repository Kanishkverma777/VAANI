const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('vaani_token') || localStorage.getItem('voiceforge_token');
  if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
    return null;
  }
  return token;
}

export function setStoredToken(token?: string | null): void {
  if (typeof window !== 'undefined') {
    if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
      localStorage.removeItem('vaani_token');
      localStorage.removeItem('voiceforge_token');
      return;
    }
    localStorage.setItem('vaani_token', token);
    localStorage.setItem('voiceforge_token', token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vaani_token');
    localStorage.removeItem('vaani_user');
    localStorage.removeItem('voiceforge_token');
    localStorage.removeItem('voiceforge_user');
  }
}

export function getStoredUser(): { email?: string; full_name?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('vaani_user') || localStorage.getItem('voiceforge_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: { email?: string; full_name?: string }): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vaani_user', JSON.stringify(user));
    localStorage.setItem('voiceforge_user', JSON.stringify(user));
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && !endpoint.includes('/auth/')) {
      clearStoredToken();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }

    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      errorDetail = data?.error?.message || data?.detail || data?.message || (typeof data === 'string' ? data : JSON.stringify(data));
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}
