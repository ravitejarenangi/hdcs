import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./db"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
          select: {
            id: true,
            username: true,
            passwordHash: true,
            role: true,
            fullName: true,
            mandalName: true,
            assignedSecretariats: true,
            isActive: true,
          },
        })

        if (!user || !user.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        })

        return {
          id: user.id,
          name: user.fullName,
          email: user.username, // Using username as email for compatibility
          role: user.role,
          username: user.username,
          mandalName: user.mandalName,
          assignedSecretariats: user.assignedSecretariats,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.username = user.username
        token.mandalName = user.mandalName
        token.assignedSecretariats = user.assignedSecretariats
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        session.user.role = token.role as string
        session.user.username = token.username as string
        session.user.mandalName = token.mandalName as string | null
        session.user.assignedSecretariats = token.assignedSecretariats as string | null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
