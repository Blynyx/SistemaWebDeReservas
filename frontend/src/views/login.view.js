const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function renderLoginView(root, { message = '', onSubmit }) {
  root.replaceChildren();

  const page = document.createElement('section');
  page.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  const heading = document.createElement('h1');
  heading.textContent = 'Sistema Web de Reservas';

  const subtitle = document.createElement('p');
  subtitle.className = 'login-card__subtitle';
  subtitle.textContent = 'Inicia sesión para continuar';

  const form = document.createElement('form');
  form.className = 'login-form';
  form.noValidate = true;

  const slugField = createField({
    id: 'organizationSlug',
    label: 'Organización',
    type: 'text',
    autocomplete: 'organization',
    name: 'organizationSlug',
  });
  const emailField = createField({
    id: 'email',
    label: 'Correo electrónico',
    type: 'email',
    autocomplete: 'username',
    name: 'email',
  });
  const passwordField = createField({
    id: 'password',
    label: 'Contraseña',
    type: 'password',
    autocomplete: 'current-password',
    name: 'password',
  });

  const errorBox = document.createElement('p');
  errorBox.className = 'form-error';
  errorBox.id = 'login-error';
  errorBox.setAttribute('role', 'alert');
  errorBox.setAttribute('aria-live', 'polite');
  if (message) {
    errorBox.textContent = message;
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button button--primary';
  submit.textContent = 'Iniciar sesión';

  form.append(slugField.wrapper, emailField.wrapper, passwordField.wrapper, errorBox, submit);

  let submitting = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const organizationSlug = slugField.input.value.trim();
    const email = emailField.input.value.trim();
    const password = passwordField.input.value;

    if (!organizationSlug) {
      errorBox.textContent = 'La organización es obligatoria.';
      slugField.input.focus();
      return;
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      errorBox.textContent = 'El correo electrónico no es válido.';
      emailField.input.focus();
      return;
    }

    if (!password) {
      errorBox.textContent = 'La contraseña es obligatoria.';
      passwordField.input.focus();
      return;
    }

    submitting = true;
    submit.disabled = true;
    submit.textContent = 'Ingresando...';
    errorBox.textContent = '';

    try {
      await onSubmit({ organizationSlug, email, password });
      passwordField.input.value = '';
    } catch (error) {
      errorBox.textContent = error.message || 'No se pudo iniciar sesión.';
      submitting = false;
      submit.disabled = false;
      submit.textContent = 'Iniciar sesión';
    }
  });

  card.append(heading, subtitle, form);
  page.append(card);
  root.append(page);
}

function createField({ id, label, type, autocomplete, name }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.id = id;
  input.name = name;
  input.type = type;
  input.autocomplete = autocomplete;
  input.required = true;

  wrapper.append(labelEl, input);
  return { wrapper, input };
}
