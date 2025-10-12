import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      mandalName?: string | null
      assignedSecretariats?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: string
    mandalName?: string | null
    assignedSecretariats?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    username?: string
    mandalName?: string | null
    assignedSecretariats?: string | null
  }
}
