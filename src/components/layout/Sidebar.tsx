"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  Users,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  History,
  UserCog,
} from "lucide-react"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface MenuItem {
  title: string
  icon: React.ReactNode
  href: string
  roles: string[]
}

const menuItems: MenuItem[] = [
  // ADMIN Menu Items
  {
    title: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: "/admin",
    roles: ["ADMIN"],
  },
  {
    title: "Officers",
    icon: <UserCog className="h-5 w-5" />,
    href: "/admin/officers",
    roles: ["ADMIN"],
  },
  {
    title: "Reports",
    icon: <FileText className="h-5 w-5" />,
    href: "/admin/reports",
    roles: ["ADMIN"],
  },
  {
    title: "Import Data",
    icon: <Upload className="h-5 w-5" />,
    href: "/admin/import",
    roles: ["ADMIN"],
  },
  {
    title: "Import History",
    icon: <History className="h-5 w-5" />,
    href: "/admin/import/history",
    roles: ["ADMIN"],
  },

  // PANCHAYAT_SECRETARY Menu Items
  {
    title: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: "/panchayat",
    roles: ["PANCHAYAT_SECRETARY"],
  },
  {
    title: "Field Officers",
    icon: <Users className="h-5 w-5" />,
    href: "/panchayat/officers",
    roles: ["PANCHAYAT_SECRETARY"],
  },

  // FIELD_OFFICER Menu Items
  {
    title: "Search Residents",
    icon: <Search className="h-5 w-5" />,
    href: "/field-officer",
    roles: ["FIELD_OFFICER"],
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsCollapsed(savedState === "true")
    }
  }, [])

  // Save sidebar state to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
  }

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(session?.user?.role || "")
  )

  const handleNavigation = (href: string) => {
    router.push(href)
    // Close mobile sidebar after navigation
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] border-r bg-white transition-all duration-300",
          // Mobile styles
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop styles
          isCollapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Collapse Toggle Button - Desktop Only */}
          <div className="hidden md:flex justify-end p-2 border-b">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="h-8 w-8"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredMenuItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 transition-all",
                    isActive
                      ? "bg-gradient-to-r from-orange-500 to-green-600 text-white hover:from-orange-600 hover:to-green-700"
                      : "hover:bg-gray-100",
                    isCollapsed && "justify-center px-2"
                  )}
                  onClick={() => handleNavigation(item.href)}
                >
                  <span className={cn(isCollapsed && "mx-auto")}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="text-sm font-medium">{item.title}</span>
                  )}
                </Button>
              )
            })}
          </nav>

          {/* Footer Info */}
          {!isCollapsed && (
            <div className="border-t p-4">
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700">
                  Chittoor District
                </p>
                <p>Health Data Collection</p>
                <p className="text-[10px] text-gray-400 mt-2">
                  Version 1.0.0
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

