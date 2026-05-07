type PasswordRule = {
  id: 'length' | 'lowercase' | 'uppercase' | 'numberOrSymbol'
  label: string
  met: boolean
}

type PasswordStrength = {
  score: number
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
  requirements: PasswordRule[]
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const requirements: PasswordRule[] = [
    {
      id: 'length',
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      id: 'lowercase',
      label: 'Contains a lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      id: 'uppercase',
      label: 'Contains an uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'numberOrSymbol',
      label: 'Contains a number or symbol',
      met: /[\d\W_]/.test(password),
    },
  ]

  const score = requirements.filter((rule) => rule.met).length + (password.length >= 12 ? 1 : 0)

  if (score >= 5) {
    return { score: 5, label: 'Strong', requirements }
  }
  if (score === 4) {
    return { score: 4, label: 'Good', requirements }
  }
  if (score === 3) {
    return { score: 3, label: 'Fair', requirements }
  }
  if (score === 2) {
    return { score: 2, label: 'Weak', requirements }
  }
  return { score: 1, label: 'Very weak', requirements }
}

export function strengthColorClass(score: number): string {
  if (score >= 5) {
    return 'bg-emerald-500'
  }
  if (score >= 4) {
    return 'bg-lime-500'
  }
  if (score >= 3) {
    return 'bg-amber-500'
  }
  if (score >= 2) {
    return 'bg-orange-500'
  }
  return 'bg-red-500'
}
