export const validateStrongPassword = (password: string): string[] => {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Use at least 12 characters.');
  if (password.length > 128) errors.push('Use 128 characters or fewer.');
  if (!/[a-z]/.test(password)) errors.push('Add a lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Add an uppercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Add a number.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Add a symbol.');

  return errors;
};
