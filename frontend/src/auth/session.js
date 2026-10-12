const STORAGE_KEY = 'reservas.session';

// Bearer JWT + sessionStorage: la sesión dura la pestaña actual
// y no persiste entre cierres del navegador. No elimina riesgos XSS.

export function saveSession({ token, user, organization }) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    })
  );
}

export function getSession() {
  const raw = sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed?.token || !parsed?.user?.id || !parsed?.user?.role || !parsed?.organization?.id) {
      return null;
    }

    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function hasSession() {
  return Boolean(getToken());
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}
