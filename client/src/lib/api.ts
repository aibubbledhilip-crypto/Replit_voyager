let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  
  const response = await fetch('/api/csrf-token', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get CSRF token');
  }
  
  const data = await response.json();
  csrfToken = data.csrfToken;
  
  if (!csrfToken) {
    throw new Error('Invalid CSRF token received');
  }
  
  return csrfToken;
}

export async function apiRequest(url: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
  // Add CSRF token for state-changing requests
  const method = options?.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    headers['x-csrf-token'] = token;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    
    // If CSRF token is invalid, clear it and retry once
    if (error.message?.includes('CSRF') && csrfToken) {
      csrfToken = null;
      return apiRequest(url, options);
    }
    
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}
