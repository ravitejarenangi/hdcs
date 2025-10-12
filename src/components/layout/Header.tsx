"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, LogOut, User, Settings, Shield } from "lucide-react"
import Image from "next/image"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push("/login")
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-gradient-to-r from-red-500 to-orange-500 text-white"
      case "FIELD_OFFICER":
        return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Shield className="h-3 w-3" />
      case "FIELD_OFFICER":
        return <User className="h-3 w-3" />
      default:
        return null
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-orange-50 via-white to-green-50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden mr-2"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo and Title */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            {/* Government Logo Placeholder */}
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">AP</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm md:text-base font-bold bg-gradient-to-r from-orange-600 via-gray-800 to-green-600 bg-clip-text text-transparent">
                Chittoor District
              </h1>
              <p className="text-xs text-gray-600">Health Data Collection System</p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-sm font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
                Chittoor Health
              </h1>
            </div>
          </div>
        </div>

        {/* User Info and Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* User Info - Hidden on small screens */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {session?.user?.name || session?.user?.username || "User"}
              </p>
              <div className="flex items-center justify-end gap-1">
                <Badge
                  className={`text-xs px-2 py-0.5 ${getRoleBadgeColor(
                    session?.user?.role || ""
                  )}`}
                >
                  <span className="flex items-center gap-1">
                    {getRoleIcon(session?.user?.role || "")}
                    {session?.user?.role === "ADMIN" ? "Admin" : "Field Officer"}
                  </span>
                </Badge>
              </div>
            </div>
          </div>

          {/* User Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10 bg-gradient-to-br from-orange-100 to-green-100 hover:from-orange-200 hover:to-green-200"
              >
                <User className="h-5 w-5 text-gray-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {session?.user?.name || session?.user?.username || "User"}
                  </p>
                  <p className="text-xs text-gray-500">
                    @{session?.user?.username}
                  </p>
                  <Badge
                    className={`text-xs w-fit ${getRoleBadgeColor(
                      session?.user?.role || ""
                    )}`}
                  >
                    <span className="flex items-center gap-1">
                      {getRoleIcon(session?.user?.role || "")}
                      {session?.user?.role === "ADMIN" ? "Admin" : "Field Officer"}
                    </span>
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

