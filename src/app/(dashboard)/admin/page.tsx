"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  Phone,
  CreditCard,
  TrendingUp,
  Loader2,
  AlertCircle,
  Download,
  BarChart3,
  Activity,
  MapPin,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { toast } from "sonner"

interface AnalyticsData {
  overview: {
    totalResidents: number
    residentsWithMobile: number
    residentsWithHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
    recentUpdatesCount: number
    // Placeholder metrics
    residentsWithNamePlaceholder?: number
    residentsWithHhIdPlaceholder?: number
    residentsWithMobilePlaceholder?: number
    residentsWithHealthIdPlaceholder?: number
  }
  mandalStatistics: Array<{
    mandalName: string
    residentCount: number
  }>
  mandalCompletion: Array<{
    mandalName: string
    totalResidents: number
    withMobile: number
    withHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
  }>
  mandalHierarchy: Array<{
    mandalName: string
    totalResidents: number
    withMobile: number
    withHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
    secretariats: Array<{
      secName: string
      totalResidents: number
      withMobile: number
      withHealthId: number
      mobileCompletionRate: number
      healthIdCompletionRate: number
    }>
  }>
  fieldOfficerPerformance: Array<{
    userId: string
    username: string
    name: string
    role: string
    updatesCount: number
  }>
  recentUpdates: Array<{
    id: string
    residentName: string
    residentId: string
    fieldUpdated: string
    oldValue: string
    newValue: string
    updatedBy: string
    username: string
    updatedAt: string
  }>
  updatesTimeline: Array<{
    date: string
    count: number
  }>
  generatedAt: string
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedMandals, setExpandedMandals] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/analytics")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to fetch analytics")
        toast.error("Failed to load analytics", {
          description: data.error || "Please try again",
        })
      } else {
        setAnalytics(data)
      }
    } catch {
      setError("Network error. Please try again.")
      toast.error("Network Error", {
        description: "Failed to connect to server",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMandal = (mandalName: string) => {
    setExpandedMandals((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(mandalName)) {
        newSet.delete(mandalName)
      } else {
        newSet.add(mandalName)
      }
      return newSet
    })
  }

  if (isLoading) {
    return (
      <DashboardLayout requiredRole="ADMIN">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error && !analytics) {
    return (
      <DashboardLayout requiredRole="ADMIN">
        <Card className="border-2 border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Failed to Load Analytics
            </h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={fetchAnalytics} className="bg-orange-600 hover:bg-orange-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout requiredRole="ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive analytics and insights
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Overview Statistics Cards */}
        {analytics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <p className="text-sm text-gray-600 mt-2">
                    Registered in system
                  </p>
                </CardContent>
              </Card>

              {/* Mobile Numbers */}
              <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="h-5 w-5 text-green-600" />
                    Mobile Numbers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-green-600">
                    {analytics.overview.mobileCompletionRate}%
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    {analytics.overview.residentsWithMobile.toLocaleString()} of{" "}
                    {analytics.overview.totalResidents.toLocaleString()} residents
                  </p>
                </CardContent>
              </Card>

              {/* Health IDs */}
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    Health IDs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-purple-600">
                    {analytics.overview.healthIdCompletionRate}%
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    {analytics.overview.residentsWithHealthId.toLocaleString()} of{" "}
                    {analytics.overview.totalResidents.toLocaleString()} residents
                  </p>
                </CardContent>
              </Card>

              {/* Recent Updates */}
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    Recent Updates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-orange-600">
                    {analytics.overview.recentUpdatesCount.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Last 30 days
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Data Quality Alert Section */}
            {(analytics.overview.residentsWithNamePlaceholder || 0) > 0 ||
            (analytics.overview.residentsWithHhIdPlaceholder || 0) > 0 ||
            (analytics.overview.residentsWithMobilePlaceholder || 0) > 0 ||
            (analytics.overview.residentsWithHealthIdPlaceholder || 0) > 0 ? (
              <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-5 w-5" />
                    Data Quality Alert - Records Requiring Attention
                  </CardTitle>
                  <CardDescription>
                    The following records have placeholder or missing values that need to be updated
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Name Placeholders */}
                    {(analytics.overview.residentsWithNamePlaceholder || 0) > 0 && (
                      <div className="p-4 bg-white rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-700">Unknown Names</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                          {(analytics.overview.residentsWithNamePlaceholder || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Records with UNKNOWN_NAME_* placeholder
                        </p>
                      </div>
                    )}

                    {/* HH ID Placeholders */}
                    {(analytics.overview.residentsWithHhIdPlaceholder || 0) > 0 && (
                      <div className="p-4 bg-white rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-700">Unknown HH IDs</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                          {(analytics.overview.residentsWithHhIdPlaceholder || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Records with HH_UNKNOWN_* placeholder
                        </p>
                      </div>
                    )}

                    {/* Mobile Placeholders */}
                    {(analytics.overview.residentsWithMobilePlaceholder || 0) > 0 && (
                      <div className="p-4 bg-white rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-700">Missing Mobile Numbers</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                          {(analytics.overview.residentsWithMobilePlaceholder || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Records with NULL, N/A, 0, 0.0, or empty mobile
                        </p>
                      </div>
                    )}

                    {/* Health ID Placeholders */}
                    {(analytics.overview.residentsWithHealthIdPlaceholder || 0) > 0 && (
                      <div className="p-4 bg-white rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-700">Missing Health IDs</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                          {(analytics.overview.residentsWithHealthIdPlaceholder || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Records with NULL, N/A, or empty health ID
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mandal-wise Distribution */}
              <Card className="border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Mandal-wise Resident Distribution
                  </CardTitle>
                  <CardDescription>
                    Number of residents per mandal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.mandalStatistics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="mandalName"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="residentCount"
                        fill="#3b82f6"
                        name="Residents"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Completion Rates Pie Chart */}
              <Card className="border-2 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Data Completion Overview
                  </CardTitle>
                  <CardDescription>
                    Mobile numbers and health IDs completion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "With Mobile",
                            value: analytics.overview.residentsWithMobile,
                          },
                          {
                            name: "Without Mobile",
                            value:
                              analytics.overview.totalResidents -
                              analytics.overview.residentsWithMobile,
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Updates Timeline */}
            {analytics.updatesTimeline.length > 0 && (
              <Card className="border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    Updates Timeline (Last 7 Days)
                  </CardTitle>
                  <CardDescription>
                    Daily update activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analytics.updatesTimeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        name="Updates"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Mandal Completion Statistics */}
            <Card className="border-2 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                  Mandal-wise Completion Rates
                </CardTitle>
                <CardDescription>
                  Mobile and Health ID completion by mandal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-4 w-12"></th>
                        <th className="text-left py-2 px-4">Name</th>
                        <th className="text-right py-2 px-4">Total</th>
                        <th className="text-right py-2 px-4">Mobile %</th>
                        <th className="text-right py-2 px-4">Health ID %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.mandalHierarchy.map((mandal, mandalIndex) => (
                        <>
                          {/* Level 1: Mandal Row */}
                          <tr
                            key={`mandal-${mandalIndex}`}
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleMandal(mandal.mandalName)}
                          >
                            <td className="py-2 px-4">
                              {expandedMandals.has(mandal.mandalName) ? (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-600" />
                              )}
                            </td>
                            <td className="py-2 px-4 font-bold text-indigo-700">
                              {mandal.mandalName}
                            </td>
                            <td className="text-right py-2 px-4 font-semibold">
                              {mandal.totalResidents.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-4">
                              <Badge
                                variant={
                                  mandal.mobileCompletionRate >= 75
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  mandal.mobileCompletionRate >= 75
                                    ? "bg-green-600"
                                    : "text-orange-600"
                                }
                              >
                                {mandal.mobileCompletionRate}%
                              </Badge>
                            </td>
                            <td className="text-right py-2 px-4">
                              <Badge
                                variant={
                                  mandal.healthIdCompletionRate >= 75
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  mandal.healthIdCompletionRate >= 75
                                    ? "bg-purple-600"
                                    : "text-orange-600"
                                }
                              >
                                {mandal.healthIdCompletionRate}%
                              </Badge>
                            </td>
                          </tr>

                          {/* Level 2: Secretariat Rows (shown when mandal is expanded) */}
                          {expandedMandals.has(mandal.mandalName) &&
                            mandal.secretariats.map((secretariat, secIndex) => (
                              <tr
                                key={`sec-${mandalIndex}-${secIndex}`}
                                className="border-b hover:bg-blue-50 bg-blue-50/30"
                              >
                                <td className="py-2 px-4 pl-8">
                                  <span className="text-blue-600">•</span>
                                </td>
                                <td className="py-2 px-4 pl-8 font-semibold text-blue-700">
                                  {secretariat.secName}
                                </td>
                                <td className="text-right py-2 px-4">
                                  {secretariat.totalResidents.toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-4">
                                  <Badge
                                    variant={
                                      secretariat.mobileCompletionRate >= 75
                                        ? "default"
                                        : "outline"
                                    }
                                    className={
                                      secretariat.mobileCompletionRate >= 75
                                        ? "bg-green-600"
                                        : "text-orange-600"
                                    }
                                  >
                                    {secretariat.mobileCompletionRate}%
                                  </Badge>
                                </td>
                                <td className="text-right py-2 px-4">
                                  <Badge
                                    variant={
                                      secretariat.healthIdCompletionRate >= 75
                                        ? "default"
                                        : "outline"
                                    }
                                    className={
                                      secretariat.healthIdCompletionRate >= 75
                                        ? "bg-purple-600"
                                        : "text-orange-600"
                                    }
                                  >
                                    {secretariat.healthIdCompletionRate}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Field Officer Performance */}
            <Card className="border-2 border-cyan-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-600" />
                  Field Officer Performance
                </CardTitle>
                <CardDescription>
                  Updates made by each field officer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Name</th>
                        <th className="text-left py-2 px-4">Username</th>
                        <th className="text-left py-2 px-4">Role</th>
                        <th className="text-right py-2 px-4">Updates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.fieldOfficerPerformance.map((officer, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 font-medium">
                            {officer.name}
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            @{officer.username}
                          </td>
                          <td className="py-2 px-4">
                            <Badge variant="outline">{officer.role}</Badge>
                          </td>
                          <td className="text-right py-2 px-4">
                            <Badge variant="default" className="bg-cyan-600">
                              {officer.updatesCount}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {analytics.fieldOfficerPerformance.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-gray-500">
                            No updates recorded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recent Updates */}
            <Card className="border-2 border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-amber-600" />
                  Recent Updates
                </CardTitle>
                <CardDescription>
                  Latest changes made to resident data (Last 50)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Resident</th>
                        <th className="text-left py-2 px-4">Field</th>
                        <th className="text-left py-2 px-4">Old Value</th>
                        <th className="text-left py-2 px-4">New Value</th>
                        <th className="text-left py-2 px-4">Updated By</th>
                        <th className="text-left py-2 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.recentUpdates.slice(0, 10).map((update) => (
                        <tr key={update.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4">
                            <div>
                              <div className="font-medium">{update.residentName}</div>
                              <div className="text-xs text-gray-500">
                                {update.residentId}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <Badge variant="outline">
                              {update.fieldUpdated.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {update.oldValue === "null" ? (
                              <span className="text-gray-400 italic">empty</span>
                            ) : (
                              update.oldValue
                            )}
                          </td>
                          <td className="py-2 px-4 font-medium">
                            {update.newValue === "null" ? (
                              <span className="text-gray-400 italic">empty</span>
                            ) : (
                              update.newValue
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <div>
                              <div className="font-medium">{update.updatedBy}</div>
                              <div className="text-xs text-gray-500">
                                @{update.username}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {new Date(update.updatedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                      {analytics.recentUpdates.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-gray-500">
                            No recent updates
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {analytics.recentUpdates.length > 10 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500">
                      Showing 10 of {analytics.recentUpdates.length} recent updates
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Administrative tools and data management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                    onClick={() => {
                      toast.info("Import Data", {
                        description: "Data import feature coming soon",
                      })
                    }}
                  >
                    <Download className="h-6 w-6" />
                    <span>Import Data</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                    onClick={() => {
                      toast.info("Export Data", {
                        description: "Data export feature coming soon",
                      })
                    }}
                  >
                    <Download className="h-6 w-6" />
                    <span>Export Data</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2"
                    onClick={fetchAnalytics}
                  >
                    <Activity className="h-6 w-6" />
                    <span>Refresh Analytics</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Footer Info */}
            <div className="text-center text-sm text-gray-500">
              <p>
                Analytics generated at:{" "}
                {new Date(analytics.generatedAt).toLocaleString("en-IN")}
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
