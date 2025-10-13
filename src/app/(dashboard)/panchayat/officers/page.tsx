"use client"

import { useEffect, useState, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, UserCheck, UserX, Activity, Plus, Search, Edit, Key, Power, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import OfficerDialog from "@/components/panchayat/OfficerDialog"
import ResetPasswordDialog from "@/components/panchayat/ResetPasswordDialog"

interface Officer {
  id: string
  username: string
  fullName: string
  mobileNumber?: string | null
  assignedSecretariats?: string | null
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
  updatedAt: string
  updateCount: number
}

export default function PanchayatOfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([])
  const [filteredOfficers, setFilteredOfficers] = useState<Officer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  // Dialog states
  const [officerDialogOpen, setOfficerDialogOpen] = useState(false)
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [resetPasswordOfficer, setResetPasswordOfficer] = useState<Officer | null>(null)

  const fetchOfficers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/panchayat/officers")

      if (!response.ok) {
        throw new Error("Failed to fetch officers")
      }

      const data = await response.json()
      setOfficers(data.officers || [])
    } catch (error) {
      console.error("Error fetching officers:", error)
      toast.error("Failed to load officers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOfficers()
  }, [fetchOfficers])

  useEffect(() => {
    filterOfficers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officers, searchQuery, statusFilter])

  const filterOfficers = () => {
    let filtered = [...officers]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (officer) =>
          officer.fullName.toLowerCase().includes(query) ||
          officer.username.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((officer) => officer.isActive)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((officer) => !officer.isActive)
    }

    setFilteredOfficers(filtered)
  }

  const handleAddOfficer = () => {
    setSelectedOfficer(null)
    setOfficerDialogOpen(true)
  }

  const handleEditOfficer = (officer: Officer) => {
    setSelectedOfficer(officer)
    setOfficerDialogOpen(true)
  }

  const handleResetPassword = (officer: Officer) => {
    setResetPasswordOfficer(officer)
    setResetPasswordDialogOpen(true)
  }

  const handleToggleActive = async (officer: Officer) => {
    try {
      const newStatus = !officer.isActive
      const response = await fetch(`/api/panchayat/officers/${officer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update officer status")
      }

      toast.success(`Officer ${newStatus ? "activated" : "deactivated"} successfully`)
      fetchOfficers()
    } catch (error) {
      console.error("Error toggling officer status:", error)
      toast.error("Failed to update officer status")
    }
  }

  const handleDialogSuccess = () => {
    fetchOfficers()
  }

  // Calculate statistics
  const totalOfficers = officers.length
  const activeOfficers = officers.filter((o) => o.isActive).length
  const inactiveOfficers = officers.filter((o) => !o.isActive).length
  const totalUpdates = officers.reduce((sum, o) => sum + o.updateCount, 0)

  return (
    <DashboardLayout requiredRole="PANCHAYAT_SECRETARY">
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading field officers...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
                Field Officers Management
              </h1>
              <p className="text-gray-600 mt-1">Manage field officers in your mandal</p>
            </div>
            <Button
              onClick={handleAddOfficer}
              className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Officer
            </Button>
          </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Officers */}
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Total Officers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-600">{totalOfficers}</p>
            </CardContent>
          </Card>

          {/* Active Officers */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5 text-green-600" />
                Active Officers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">{activeOfficers}</p>
            </CardContent>
          </Card>

          {/* Inactive Officers */}
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserX className="h-5 w-5 text-red-600" />
                Inactive Officers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-red-600">{inactiveOfficers}</p>
            </CardContent>
          </Card>

          {/* Total Updates */}
          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-orange-600" />
                Total Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-orange-600">{totalUpdates.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Field Officers List</CardTitle>
            <CardDescription>Search and filter field officers</CardDescription>
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Officers Table */}
            <div className="overflow-x-auto">
              {filteredOfficers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-semibold">
                    {searchQuery || statusFilter !== "all"
                      ? "No officers found matching your filters"
                      : "No field officers assigned to your mandal yet"}
                  </p>
                  {!searchQuery && statusFilter === "all" && (
                    <Button
                      onClick={handleAddOfficer}
                      className="mt-4 bg-gradient-to-r from-orange-500 to-green-600 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Officer
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold">Full Name</th>
                      <th className="text-left p-3 font-semibold">Username</th>
                      <th className="text-left p-3 font-semibold">Mobile</th>
                      <th className="text-left p-3 font-semibold">Assigned Secretariats</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                      <th className="text-center p-3 font-semibold">Last Login</th>
                      <th className="text-center p-3 font-semibold">Updates</th>
                      <th className="text-center p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfficers.map((officer) => {
                      const assignedSecs = officer.assignedSecretariats
                        ? JSON.parse(officer.assignedSecretariats)
                        : []

                      // Handle both old format (string[]) and new format (object[])
                      const displaySecretariats = assignedSecs.map((sec: string | { mandalName: string; secName: string }) => {
                        if (typeof sec === 'string') {
                          return sec
                        } else if (sec && typeof sec === 'object' && sec.secName) {
                          return `${sec.mandalName} → ${sec.secName}`
                        }
                        return 'Unknown'
                      })

                      return (
                        <tr key={officer.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{officer.fullName}</td>
                          <td className="p-3 text-gray-600">@{officer.username}</td>
                          <td className="p-3 text-gray-600">
                            {officer.mobileNumber || (
                              <span className="text-gray-400 italic">Not provided</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {displaySecretariats.length > 0 ? (
                                displaySecretariats.slice(0, 2).map((sec: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs"
                                  >
                                    {sec}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 italic text-xs">None</span>
                              )}
                              {displaySecretariats.length > 2 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                  +{displaySecretariats.length - 2} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {officer.isActive ? (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                Active
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center text-gray-600">
                            {officer.lastLogin ? (
                              format(new Date(officer.lastLogin), "MMM dd, yyyy")
                            ) : (
                              <span className="text-gray-400 italic">Never</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-semibold text-orange-600">
                            {officer.updateCount}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              {/* Edit Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditOfficer(officer)}
                                title="Edit Officer"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              {/* Reset Password Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetPassword(officer)}
                                title="Reset Password"
                              >
                                <Key className="h-4 w-4" />
                              </Button>

                              {/* Toggle Active Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleActive(officer)}
                                title={officer.isActive ? "Deactivate" : "Activate"}
                                className={
                                  officer.isActive
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-green-600 hover:bg-green-50"
                                }
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Results Count */}
            {filteredOfficers.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredOfficers.length} of {officers.length} officer
                {officers.length !== 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <OfficerDialog
          open={officerDialogOpen}
          onOpenChange={setOfficerDialogOpen}
          officer={selectedOfficer}
          onSuccess={handleDialogSuccess}
        />

        <ResetPasswordDialog
          open={resetPasswordDialogOpen}
          onOpenChange={setResetPasswordDialogOpen}
          officer={resetPasswordOfficer}
          onSuccess={handleDialogSuccess}
        />
        </div>
      )}
    </DashboardLayout>
  )
}

