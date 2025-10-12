"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Activity, TrendingUp, MapPin, UserCheck, BarChart3, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { format } from "date-fns"
import { toast } from "sonner"

interface Analytics {
  mandalName: string
  overview: {
    totalResidents: number
    residentsWithMobile: number
    residentsWithHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
    recentUpdatesCount: number
  }
  secretariatStatistics: Array<{
    secretariatName: string
    residentCount: number
  }>
  secretariatCompletion: Array<{
    secretariatName: string
    totalResidents: number
    withMobile: number
    withHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
  }>
  fieldOfficerPerformance: Array<{
    id: string
    username: string
    fullName: string
    assignedSecretariats: string[]
    updateCount: number
  }>
  updatesTimeline: Array<{
    date: string
    updateCount: number
  }>
  recentUpdates: Array<{
    id: string
    residentName: string
    residentId: string
    secretariatName: string | null
    fieldUpdated: string
    oldValue: string | null
    newValue: string | null
    updatedBy: string
    username: string
    updatedAt: string
  }>
}

const COLORS = ["#f97316", "#16a34a", "#3b82f6", "#eab308", "#8b5cf6"]

type SortColumn = "secretariat" | "total" | "mobile" | "healthId" | "avgQuality"
type SortDirection = "asc" | "desc" | null

export default function PanchayatDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/panchayat/analytics")

      if (!response.ok) {
        throw new Error("Failed to fetch analytics")
      }

      const data = await response.json()
      setAnalytics(data)
      toast.success("Analytics refreshed successfully")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
      toast.error(`Failed to fetch analytics: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const getSortedData = () => {
    if (!analytics || !sortColumn || !sortDirection) {
      return analytics?.secretariatCompletion || []
    }

    const sorted = [...analytics.secretariatCompletion].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortColumn) {
        case "secretariat":
          aValue = a.secretariatName
          bValue = b.secretariatName
          break
        case "total":
          aValue = a.totalResidents
          bValue = b.totalResidents
          break
        case "mobile":
          aValue = a.mobileCompletionRate
          bValue = b.mobileCompletionRate
          break
        case "healthId":
          aValue = a.healthIdCompletionRate
          bValue = b.healthIdCompletionRate
          break
        case "avgQuality":
          aValue = (a.mobileCompletionRate + a.healthIdCompletionRate) / 2
          bValue = (b.mobileCompletionRate + b.healthIdCompletionRate) / 2
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })

    return sorted
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-gray-400" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1 text-orange-600" />
    }
    return <ArrowDown className="h-4 w-4 ml-1 text-orange-600" />
  }

  return (
    <DashboardLayout requiredRole="PANCHAYAT_SECRETARY">
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading mandal analytics...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-600 font-semibold">Error: {error}</p>
            <Button
              onClick={fetchAnalytics}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : !analytics ? null : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
                Panchayat Secretary Dashboard
              </h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {analytics.mandalName} Mandal
              </p>
            </div>
            <Button
              onClick={fetchAnalytics}
              className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>

        {/* Overview Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Residents */}
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                Total Residents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-600">
                {analytics.overview.totalResidents.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-2">In {analytics.mandalName} mandal</p>
            </CardContent>
          </Card>

          {/* Mobile Completion */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-green-600" />
                Mobile Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">
                {analytics.overview.mobileCompletionRate}%
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {analytics.overview.residentsWithMobile.toLocaleString()} residents
              </p>
            </CardContent>
          </Card>

          {/* Health ID Completion */}
          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5 text-orange-600" />
                Health IDs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-orange-600">
                {analytics.overview.healthIdCompletionRate}%
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {analytics.overview.residentsWithHealthId.toLocaleString()} residents
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Total Secretariats */}
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-purple-600" />
                Total Secretariats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-purple-600">
                {analytics.secretariatStatistics.length}
              </p>
              <p className="text-sm text-gray-600 mt-2">In {analytics.mandalName} mandal</p>
            </CardContent>
          </Card>

          {/* Recent Updates */}
          <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-yellow-600">
                {analytics.overview.recentUpdatesCount.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-2">Last 6 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Secretariat-wise Distribution */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Secretariat-wise Resident Distribution
              </CardTitle>
              <CardDescription>Number of residents per secretariat</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.secretariatStatistics.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="secretariatName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={11}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="residentCount" fill="#3b82f6" name="Residents" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Updates Timeline */}
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Updates Timeline
              </CardTitle>
              <CardDescription>Daily updates (last 7 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.updatesTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="updateCount"
                    stroke="#16a34a"
                    strokeWidth={2}
                    name="Updates"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Secretariat Completion Table */}
        <Card className="border-2 border-orange-200">
          <CardHeader>
            <CardTitle>Secretariat-wise Data Completion</CardTitle>
            <CardDescription>Mobile number and Health ID completion rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th
                      className="text-left p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("secretariat")}
                    >
                      <div className="flex items-center">
                        Secretariat
                        <SortIcon column="secretariat" />
                      </div>
                    </th>
                    <th
                      className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("total")}
                    >
                      <div className="flex items-center justify-end">
                        Total
                        <SortIcon column="total" />
                      </div>
                    </th>
                    <th
                      className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("mobile")}
                    >
                      <div className="flex items-center justify-end">
                        Mobile %
                        <SortIcon column="mobile" />
                      </div>
                    </th>
                    <th
                      className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("healthId")}
                    >
                      <div className="flex items-center justify-end">
                        Health ID %
                        <SortIcon column="healthId" />
                      </div>
                    </th>
                    <th
                      className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("avgQuality")}
                    >
                      <div className="flex items-center justify-end">
                        Avg Quality
                        <SortIcon column="avgQuality" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedData().map((sec, index) => {
                    const avgQuality = Math.round(
                      (sec.mobileCompletionRate + sec.healthIdCompletionRate) / 2
                    )
                    return (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{sec.secretariatName}</td>
                        <td className="p-3 text-right">{sec.totalResidents.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-semibold ${
                              sec.mobileCompletionRate >= 80
                                ? "text-green-600"
                                : sec.mobileCompletionRate >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {sec.mobileCompletionRate}%
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-semibold ${
                              sec.healthIdCompletionRate >= 80
                                ? "text-green-600"
                                : sec.healthIdCompletionRate >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {sec.healthIdCompletionRate}%
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-semibold ${
                              avgQuality >= 80
                                ? "text-green-600"
                                : avgQuality >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {avgQuality}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Field Officer Performance */}
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle>Field Officer Performance</CardTitle>
            <CardDescription>Updates made by field officers in your mandal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">Officer Name</th>
                    <th className="text-left p-3 font-semibold">Username</th>
                    <th className="text-left p-3 font-semibold">Assigned Secretariats</th>
                    <th className="text-right p-3 font-semibold">Updates</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.fieldOfficerPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-500">
                        No field officers assigned to this mandal yet
                      </td>
                    </tr>
                  ) : (
                    analytics.fieldOfficerPerformance.map((officer) => (
                      <tr key={officer.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{officer.fullName}</td>
                        <td className="p-3 text-gray-600">@{officer.username}</td>
                        <td className="p-3 text-gray-600">
                          {officer.assignedSecretariats.join(", ")}
                        </td>
                        <td className="p-3 text-right font-semibold text-orange-600">
                          {officer.updateCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Updates */}
        <Card className="border-2 border-green-200">
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>Last 50 updates in your mandal (last 6 hours)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">Date</th>
                    <th className="text-left p-3 font-semibold">Resident</th>
                    <th className="text-left p-3 font-semibold">Secretariat</th>
                    <th className="text-left p-3 font-semibold">Field</th>
                    <th className="text-left p-3 font-semibold">Updated By</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentUpdates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">
                        No recent updates in the last 6 hours
                      </td>
                    </tr>
                  ) : (
                    analytics.recentUpdates.slice(0, 20).map((update) => (
                      <tr key={update.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-600">
                          {format(new Date(update.updatedAt), "MMM dd, HH:mm")}
                        </td>
                        <td className="p-3 font-medium">{update.residentName}</td>
                        <td className="p-3 text-gray-600">{update.secretariatName || "N/A"}</td>
                        <td className="p-3 text-gray-600">{update.fieldUpdated}</td>
                        <td className="p-3 text-gray-600">{update.updatedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </DashboardLayout>
  )
}

