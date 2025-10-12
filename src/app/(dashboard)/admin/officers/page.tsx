"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { OfficerDialog } from "@/components/admin/OfficerDialog"
import { ResetPasswordDialog } from "@/components/admin/ResetPasswordDialog"
import { toast } from "sonner"
import {
  UserPlus,
  Search,
  Edit,
  Key,
  Loader2,
  CheckCircle,
  XCircle,
  Activity,
  UserCheck,
  UserX,
} from "lucide-react"
import { format } from "date-fns"

interface Officer {
  id: string
  username: string
  fullName: string
  mobileNumber?: string | null
  role: string
  mandalName?: string | null
  assignedSecretariats?: string | null
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
  updateCount: number
}

export default function OfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([])
  const [filteredOfficers, setFilteredOfficers] = useState<Officer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  // Dialog states
  const [showOfficerDialog, setShowOfficerDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null)

  const filterOfficers = useCallback(() => {
    let filtered = officers

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (officer) =>
          officer.fullName.toLowerCase().includes(query) ||
          officer.username.toLowerCase().includes(query)
      )
    }

    // Filter by status
    if (statusFilter === "active") {
      filtered = filtered.filter((officer) => officer.isActive)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((officer) => !officer.isActive)
    }

    setFilteredOfficers(filtered)
  }, [officers, searchQuery, statusFilter])

  useEffect(() => {
    fetchOfficers()
  }, [])

  useEffect(() => {
    filterOfficers()
  }, [filterOfficers])

  const fetchOfficers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/admin/officers")

      if (!response.ok) {
        throw new Error("Failed to fetch officers")
      }

      const data = await response.json()
      setOfficers(data)
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error("Failed to load field officers")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddOfficer = () => {
    setSelectedOfficer(null)
    setShowOfficerDialog(true)
  }

  const handleEditOfficer = (officer: Officer) => {
    setSelectedOfficer(officer)
    setShowOfficerDialog(true)
  }

  const handleResetPassword = (officer: Officer) => {
    setSelectedOfficer(officer)
    setShowResetPasswordDialog(true)
  }

  const handleToggleStatus = async (officer: Officer) => {
    try {
      const newStatus = !officer.isActive
      const response = await fetch(`/api/admin/officers/${officer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update officer status")
      }

      toast.success(
        `Officer ${newStatus ? "activated" : "deactivated"} successfully`
      )
      fetchOfficers()
    } catch (error) {
      console.error("Toggle status error:", error)
      toast.error("Failed to update officer status")
    }
  }

  const handleDeactivate = async (officer: Officer) => {
    if (
      !confirm(
        `Are you sure you want to deactivate ${officer.fullName}? They will no longer be able to log in.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/admin/officers/${officer.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to deactivate officer")
      }

      toast.success("Officer deactivated successfully")
      fetchOfficers()
    } catch (error) {
      console.error("Deactivate error:", error)
      toast.error("Failed to deactivate officer")
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="mr-1 h-3 w-3" />
          Active
        </Badge>
      )
    }
    return (
      <Badge className="bg-red-100 text-red-800 border-red-300">
        <XCircle className="mr-1 h-3 w-3" />
        Inactive
      </Badge>
    )
  }

  const stats = {
    total: officers.length,
    active: officers.filter((o) => o.isActive).length,
    inactive: officers.filter((o) => !o.isActive).length,
    totalUpdates: officers.reduce((sum, o) => sum + o.updateCount, 0),
  }

  return (
    <DashboardLayout requiredRole="ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Field Officer Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage field officer accounts and permissions
            </p>
          </div>
          <Button
            onClick={handleAddOfficer}
            className="bg-gradient-to-r from-orange-500 to-green-600"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Officer
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Officers</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                </div>
                <UserX className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Updates</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.totalUpdates}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Field Officers</CardTitle>
            <CardDescription>
              View and manage all field officer accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "active" ? "default" : "outline"}
                  onClick={() => setStatusFilter("active")}
                  size="sm"
                  className={
                    statusFilter === "active"
                      ? "bg-green-600 hover:bg-green-700"
                      : ""
                  }
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === "inactive" ? "default" : "outline"}
                  onClick={() => setStatusFilter("inactive")}
                  size="sm"
                  className={
                    statusFilter === "inactive"
                      ? "bg-red-600 hover:bg-red-700"
                      : ""
                  }
                >
                  Inactive
                </Button>
              </div>
            </div>

            {/* Officers Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredOfficers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery || statusFilter !== "all"
                    ? "No officers found matching your filters"
                    : "No field officers yet. Click 'Add New Officer' to create one."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left font-semibold">Full Name</th>
                      <th className="p-3 text-left font-semibold">Username</th>
                      <th className="p-3 text-left font-semibold">Role</th>
                      <th className="p-3 text-left font-semibold">Mandal/Secretariats</th>
                      <th className="p-3 text-left font-semibold">Mobile</th>
                      <th className="p-3 text-left font-semibold">Status</th>
                      <th className="p-3 text-right font-semibold">Updates</th>
                      <th className="p-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfficers.map((officer) => {
                      const assignedSecs = officer.assignedSecretariats
                        ? JSON.parse(officer.assignedSecretariats)
                        : []

                      return (
                        <tr key={officer.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{officer.fullName}</td>
                          <td className="p-3 text-gray-600">@{officer.username}</td>
                          <td className="p-3">
                            {officer.role === "ADMIN" && (
                              <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                            )}
                            {officer.role === "PANCHAYAT_SECRETARY" && (
                              <Badge className="bg-blue-100 text-blue-700">Panchayat Sec</Badge>
                            )}
                            {officer.role === "FIELD_OFFICER" && (
                              <Badge className="bg-green-100 text-green-700">Field Officer</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {officer.role === "ADMIN" && (
                              <span className="text-gray-500 italic">District-wide</span>
                            )}
                            {officer.role === "PANCHAYAT_SECRETARY" && (
                              <span className="text-gray-700 font-medium">
                                {officer.mandalName || "-"}
                              </span>
                            )}
                            {officer.role === "FIELD_OFFICER" && (
                              <div className="flex flex-wrap gap-1">
                                {assignedSecs.length > 0 ? (
                                  <>
                                    {assignedSecs.slice(0, 2).map((sec: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs"
                                      >
                                        {sec}
                                      </span>
                                    ))}
                                    {assignedSecs.length > 2 && (
                                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                        +{assignedSecs.length - 2}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-400 italic">None</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-gray-600">
                            {officer.mobileNumber || (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="p-3">{getStatusBadge(officer.isActive)}</td>
                          <td className="p-3 text-right font-medium text-orange-600">
                            {officer.updateCount}
                          </td>
                          <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOfficer(officer)}
                              title="Edit Officer"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(officer)}
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(officer)}
                              title={officer.isActive ? "Deactivate" : "Activate"}
                              className={
                                officer.isActive
                                  ? "text-red-600 hover:text-red-700"
                                  : "text-green-600 hover:text-green-700"
                              }
                            >
                              {officer.isActive ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <OfficerDialog
        open={showOfficerDialog}
        onOpenChange={setShowOfficerDialog}
        officer={selectedOfficer}
        onSuccess={fetchOfficers}
      />

      <ResetPasswordDialog
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
        officer={selectedOfficer}
        onSuccess={fetchOfficers}
      />
    </DashboardLayout>
  )
}

