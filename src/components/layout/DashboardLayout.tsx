"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
  requiredRole?: "ADMIN" | "FIELD_OFFICER" | "PANCHAYAT_SECRETARY"
}

export function DashboardLayout({
  children,
  requiredRole,
}: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load sidebar collapsed state
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsCollapsed(savedState === "true")
    }
  }, [])

  // Handle sidebar collapse toggle
  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem("sidebar-collapsed", String(collapsed))
  }

  // Authentication and authorization check
  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (requiredRole && session?.user?.role !== requiredRole) {
      // Redirect to appropriate dashboard based on role
      if (session?.user?.role === "ADMIN") {
        router.push("/admin")
      } else if (session?.user?.role === "PANCHAYAT_SECRETARY") {
        router.push("/panchayat")
      } else if (session?.user?.role === "FIELD_OFFICER") {
        router.push("/field-officer")
      } else {
        router.push("/login")
      }
    }
  }, [status, session, requiredRole, router])

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated or wrong role
  if (
    status === "unauthenticated" ||
    (requiredRole && session?.user?.role !== requiredRole)
  ) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Header */}
      <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Content */}
      <main
        className={cn(
          "pt-16 transition-all duration-300",
          // Desktop margin based on sidebar state
          "md:ml-64",
          isCollapsed && "md:ml-16"
        )}
      >
        <div className="container mx-auto p-4 md:px-6 md:pt-4 md:pb-6 lg:px-8 lg:pt-4 lg:pb-8">
          {children}
        </div>
      </main>
    </div>
  )
}

