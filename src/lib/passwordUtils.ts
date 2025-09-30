/**
 * Generate a password based on athlete name initials
 * @param firstName - Player's first name
 * @param lastName - Player's last name
 * @returns Password string (e.g., "AB" for Aleksa Boskovic)
 */
export function generatePlayerPassword(firstName: string, lastName: string): string {
  const firstInitial = firstName.charAt(0).toUpperCase()
  const lastInitial = lastName.charAt(0).toUpperCase()
  return `${firstInitial}${lastInitial}`
}

/**
 * Validate a password against player name
 * @param password - Password to validate
 * @param firstName - Player's first name
 * @param lastName - Player's last name
 * @param customPassword - Custom password from database (optional)
 * @returns True if password matches the expected format
 */
export function validatePlayerPassword(password: string, firstName: string, lastName: string, customPassword?: string): boolean {
  // If custom password is set, use it; otherwise use initials
  const expectedPassword = customPassword || generatePlayerPassword(firstName, lastName)
  return password.toUpperCase() === expectedPassword.toUpperCase()
}
