/**
 * Validate employee ID: must start with a letter followed by exactly 6 digits
 * e.g. V123456, U654321
 */
export function isValidEmployeeId(id) {
  if (!id) return false;
  return /^[A-Za-z]\d{6}$/.test(id.trim());
}

export function getIdError(id) {
  if (!id || !id.trim()) return 'ID is required.';
  if (!/^[A-Za-z]/.test(id.trim())) return 'ID must start with a letter (e.g. V or U).';
  if (!/^[A-Za-z]\d{6}$/.test(id.trim())) return 'ID must be 1 letter + 6 digits (e.g. V123456).';
  return '';
}
