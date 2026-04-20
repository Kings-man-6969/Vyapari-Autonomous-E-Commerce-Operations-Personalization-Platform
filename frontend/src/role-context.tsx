import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DemoRole } from './auth'

type RoleContextValue = {
  selectedRole: Exclude<DemoRole, 'guest'> | null
  setSelectedRole: (role: Exclude<DemoRole, 'guest'> | null) => void
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [selectedRole, setSelectedRole] = useState<Exclude<DemoRole, 'guest'> | null>(null)

  const value = useMemo(
    () => ({ selectedRole, setSelectedRole }),
    [selectedRole],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRoleContext() {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRoleContext must be used within RoleProvider')
  }
  return context
}
