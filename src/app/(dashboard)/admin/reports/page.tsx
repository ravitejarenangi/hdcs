"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { ExportFilterDialog, ExportFilters } from "@/components/reports/ExportFilterDialog"
import {
  FileText,
  Download,
  TrendingUp,
  Users,
  MapPin,
  Activity,
  PieChart,
  BarChart3,
  Loader2,
  RefreshCw,
  Filter as FilterIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

// Types
interface AnalyticsData {
  overview: {
    totalResidents: number
    residentsWithMobile: number
    residentsWithHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
    recentUpdatesCount: number
    // Placeholder metrics (optional for backward compatibility)
    residentsWithNamePlaceholder?: number
    residentsWithHhIdPlaceholder?: number
    residentsWithMobilePlaceholder?: number
    residentsWithHealthIdPlaceholder?: number
    // Field officer activity metrics
    currentlyActiveOfficersCount?: number // Officers active in last 15 minutes
    totalActiveOfficersCount?: number // Total enabled officers
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
  fieldOfficerPerformance: Array<{
    userId: string
    username: string
    name: string
    role: string
    mandals: string[] // Array of mandal names this officer is assigned to
    updatesCount: number
    mobileUpdatesCount: number
    healthIdUpdatesCount: number
  }>
  recentUpdates: Array<{
    id: number
    residentName: string
    residentId: string
    fieldUpdated: string
    oldValue: string | null
    newValue: string | null
    updatedBy: string
    username: string
    updatedAt: Date
  }>
  updatesTimeline: Array<{
    date: string
    count: number
  }>
  generatedAt: string
}

// Removed unused COLORS constant

export default function ReportsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overall")
  const [isExporting, setIsExporting] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<"excel" | "csv" | null>(null)
  const [activeFilters, setActiveFilters] = useState<ExportFilters | null>(null)

  // Sorting state for Mandal Statistics table
  type MandalSortColumn = "name" | "total" | "mobile" | "withoutMobile" | "mobilePercent" | "healthId" | "pendingHealthId" | "healthIdPercent"
  type SortDirection = "asc" | "desc" | null
  const [mandalSortColumn, setMandalSortColumn] = useState<MandalSortColumn | null>(null)
  const [mandalSortDirection, setMandalSortDirection] = useState<SortDirection>(null)

  // Officer table state (search, pagination, sorting)
  type OfficerSortColumn = "name" | "username" | "role" | "updates" | "mobileUpdates" | "healthIdUpdates"
  const [officerSearchQuery, setOfficerSearchQuery] = useState("")
  const [officerCurrentPage, setOfficerCurrentPage] = useState(1)
  const officerItemsPerPage = 10
  const [officerSortColumn, setOfficerSortColumn] = useState<OfficerSortColumn | null>("updates")
  const [officerSortDirection, setOfficerSortDirection] = useState<SortDirection>("desc")

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/analytics")

      if (!response.ok) {
        throw new Error("Failed to fetch analytics data")
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Sorting functions for Mandal Statistics table
  const handleMandalSort = (column: MandalSortColumn) => {
    if (mandalSortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (mandalSortDirection === "asc") {
        setMandalSortDirection("desc")
      } else if (mandalSortDirection === "desc") {
        setMandalSortDirection(null)
        setMandalSortColumn(null)
      }
    } else {
      setMandalSortColumn(column)
      setMandalSortDirection("asc")
    }
  }

  const getSortedMandalData = () => {
    if (!analytics) return []

    const sorted = [...analytics.mandalCompletion]

    if (mandalSortColumn && mandalSortDirection) {
      sorted.sort((a, b) => {
        let aVal: string | number
        let bVal: string | number

        switch (mandalSortColumn) {
          case "name":
            aVal = a.mandalName.toLowerCase()
            bVal = b.mandalName.toLowerCase()
            break
          case "total":
            aVal = a.totalResidents
            bVal = b.totalResidents
            break
          case "mobile":
            aVal = a.withMobile
            bVal = b.withMobile
            break
          case "withoutMobile":
            aVal = a.totalResidents - a.withMobile
            bVal = b.totalResidents - b.withMobile
            break
          case "mobilePercent":
            aVal = a.mobileCompletionRate
            bVal = b.mobileCompletionRate
            break
          case "healthId":
            aVal = a.withHealthId
            bVal = b.withHealthId
            break
          case "pendingHealthId":
            aVal = a.totalResidents - a.withHealthId
            bVal = b.totalResidents - b.withHealthId
            break
          case "healthIdPercent":
            aVal = a.healthIdCompletionRate
            bVal = b.healthIdCompletionRate
            break
          default:
            return 0
        }

        if (aVal < bVal) return mandalSortDirection === "asc" ? -1 : 1
        if (aVal > bVal) return mandalSortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return sorted
  }

  // Sort icon component for Mandal table
  const SortIcon = ({
    column,
    currentColumn,
    direction
  }: {
    column: MandalSortColumn
    currentColumn: MandalSortColumn | null
    direction: SortDirection
  }) => {
    if (currentColumn !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />
    }
    if (direction === "asc") {
      return <ArrowUp className="ml-1 h-4 w-4 text-orange-600" />
    }
    if (direction === "desc") {
      return <ArrowDown className="ml-1 h-4 w-4 text-orange-600" />
    }
    return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />
  }

  // Officer table functions
  const handleOfficerSort = (column: OfficerSortColumn) => {
    if (officerSortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (officerSortDirection === "asc") {
        setOfficerSortDirection("desc")
      } else if (officerSortDirection === "desc") {
        setOfficerSortDirection(null)
        setOfficerSortColumn(null)
      }
    } else {
      setOfficerSortColumn(column)
      setOfficerSortDirection("asc")
    }
  }

  const getFilteredAndSortedOfficers = () => {
    if (!analytics) return []

    let filtered = [...analytics.fieldOfficerPerformance]

    // Apply search filter
    if (officerSearchQuery) {
      const query = officerSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (officer) =>
          officer.name.toLowerCase().includes(query) ||
          officer.username.toLowerCase().includes(query) ||
          officer.role.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    if (officerSortColumn && officerSortDirection) {
      filtered.sort((a, b) => {
        let aVal: string | number
        let bVal: string | number

        switch (officerSortColumn) {
          case "name":
            aVal = a.name.toLowerCase()
            bVal = b.name.toLowerCase()
            break
          case "username":
            aVal = a.username.toLowerCase()
            bVal = b.username.toLowerCase()
            break
          case "role":
            aVal = a.role.toLowerCase()
            bVal = b.role.toLowerCase()
            break
          case "updates":
            aVal = a.updatesCount
            bVal = b.updatesCount
            break
          case "mobileUpdates":
            aVal = a.mobileUpdatesCount
            bVal = b.mobileUpdatesCount
            break
          case "healthIdUpdates":
            aVal = a.healthIdUpdatesCount
            bVal = b.healthIdUpdatesCount
            break
          default:
            return 0
        }

        if (aVal < bVal) return officerSortDirection === "asc" ? -1 : 1
        if (aVal > bVal) return officerSortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }

  // Sort icon component for Officer table
  const OfficerSortIcon = ({
    column,
    currentColumn,
    direction
  }: {
    column: OfficerSortColumn
    currentColumn: OfficerSortColumn | null
    direction: SortDirection
  }) => {
    if (currentColumn !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />
    }
    if (direction === "asc") {
      return <ArrowUp className="ml-1 h-4 w-4 text-orange-600" />
    }
    if (direction === "desc") {
      return <ArrowDown className="ml-1 h-4 w-4 text-orange-600" />
    }
    return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />
  }

  // Pagination for officer table
  const filteredOfficers = getFilteredAndSortedOfficers()
  const officerTotalPages = Math.ceil(filteredOfficers.length / officerItemsPerPage)
  const officerStartIndex = (officerCurrentPage - 1) * officerItemsPerPage
  const officerEndIndex = officerStartIndex + officerItemsPerPage
  const paginatedOfficers = filteredOfficers.slice(officerStartIndex, officerEndIndex)

  // Reset to page 1 when search query changes
  const handleOfficerSearch = (query: string) => {
    setOfficerSearchQuery(query)
    setOfficerCurrentPage(1)
  }

  const handleExportClick = (format: "excel" | "csv") => {
    setExportFormat(format)
    setShowFilterDialog(true)
  }

  const buildFilterQueryString = (filters: ExportFilters): string => {
    const params = new URLSearchParams()

    if (filters.startDate) {
      params.append("startDate", filters.startDate.toISOString().split("T")[0])
    }
    if (filters.endDate) {
      params.append("endDate", filters.endDate.toISOString().split("T")[0])
    }
    if (filters.mandals.length > 0) {
      params.append("mandals", filters.mandals.join(","))
    }
    if (filters.officers.length > 0) {
      params.append("officers", filters.officers.join(","))
    }
    if (filters.mobileStatus !== "all") {
      params.append("mobileStatus", filters.mobileStatus)
    }
    if (filters.healthIdStatus !== "all") {
      params.append("healthIdStatus", filters.healthIdStatus)
    }
    if (filters.ruralUrban.length > 0 && filters.ruralUrban.length < 2) {
      params.append("ruralUrban", filters.ruralUrban.join(","))
    }

    return params.toString()
  }

  const getActiveFilterCount = (filters: ExportFilters): number => {
    let count = 0
    if (filters.startDate || filters.endDate) count++
    if (analytics && filters.mandals.length < analytics.mandalStatistics.length) count++
    if (analytics && filters.officers.length < analytics.fieldOfficerPerformance.length) count++
    if (filters.mobileStatus !== "all") count++
    if (filters.healthIdStatus !== "all") count++
    if (filters.ruralUrban.length < 2) count++
    return count
  }

  const handleApplyFilters = async (filters: ExportFilters) => {
    if (!exportFormat) return

    setActiveFilters(filters)
    setIsExporting(true)

    try {
      const filterCount = getActiveFilterCount(filters)
      const filterText = filterCount > 0 ? ` with ${filterCount} filter(s)` : ""

      // Show loading toast
      toast.loading(`Applying filters and generating ${exportFormat.toUpperCase()} export...`, {
        id: "export-loading",
      })

      // Build query string
      const queryString = buildFilterQueryString(filters)
      const endpoint = `/api/admin/export/${exportFormat}${queryString ? `?${queryString}` : ""}`

      const response = await fetch(endpoint)

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have permission to export data")
        }
        throw new Error(`Failed to generate ${exportFormat.toUpperCase()} export`)
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `chittoor_health_report.${exportFormat === "excel" ? "xlsx" : "csv"}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Get the blob data
      const blob = await response.blob()

      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Show success toast
      toast.success(`Successfully exported ${filename}${filterText}`, {
        id: "export-loading",
        duration: 5000,
      })
    } catch (err) {
      console.error("Export error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to export data", {
        id: "export-loading",
        duration: 5000,
      })
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout requiredRole="ADMIN">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading reports...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !analytics) {
    return (
      <DashboardLayout requiredRole="ADMIN">
        <Card className="border-2 border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-red-600 mb-4">
              <FileText className="h-16 w-16" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Reports</h3>
            <p className="text-gray-600 mb-4">{error || "Unable to fetch analytics data"}</p>
            <Button onClick={fetchAnalytics} className="bg-gradient-to-r from-orange-500 to-green-600">
              <RefreshCw className="mr-2 h-4 w-4" />
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
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive reports and data visualizations for Chittoor District
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleExportClick("excel")}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 relative"
              disabled={isExporting}
            >
              {isExporting && exportFormat === "excel" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  <FilterIcon className="mr-2 h-3 w-3" />
                </>
              )}
              Export Excel
              {activeFilters && getActiveFilterCount(activeFilters) > 0 && (
                <Badge className="ml-2 bg-green-600 text-white text-xs px-1.5 py-0.5">
                  {getActiveFilterCount(activeFilters)}
                </Badge>
              )}
            </Button>
            <Button
              onClick={() => handleExportClick("csv")}
              variant="outline"
              className="border-orange-600 text-orange-600 hover:bg-orange-50 relative"
              disabled={isExporting}
            >
              {isExporting && exportFormat === "csv" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  <FilterIcon className="mr-2 h-3 w-3" />
                </>
              )}
              Export CSV
              {activeFilters && getActiveFilterCount(activeFilters) > 0 && (
                <Badge className="ml-2 bg-orange-600 text-white text-xs px-1.5 py-0.5">
                  {getActiveFilterCount(activeFilters)}
                </Badge>
              )}
            </Button>
            <Button
              onClick={fetchAnalytics}
              variant="outline"
              className="border-gray-300"
              disabled={isExporting}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Export Filter Dialog */}
        {analytics && exportFormat && (
          <ExportFilterDialog
            open={showFilterDialog}
            onOpenChange={setShowFilterDialog}
            onApplyFilters={handleApplyFilters}
            availableMandals={analytics.mandalStatistics.map((m) => m.mandalName)}
            availableOfficers={analytics.fieldOfficerPerformance.map((o) => {
              const officer = {
                userId: o.userId,
                username: o.username,
                name: o.name,
                mandals: Array.isArray(o.mandals) ? o.mandals : [], // Ensure it's an array
              }
              return officer
            })}
            exportFormat={exportFormat}
          />
        )}

        {/* Tabs for Different Reports */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <TabsTrigger value="overall" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Overall</span>
            </TabsTrigger>
            <TabsTrigger value="mandal" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Mandal-wise</span>
            </TabsTrigger>
            <TabsTrigger value="officers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Officers</span>
            </TabsTrigger>
            <TabsTrigger value="completion" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Completion</span>
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Updates</span>
            </TabsTrigger>
            <TabsTrigger value="demographics" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Demographics</span>
            </TabsTrigger>
          </TabsList>

          {/* Report 1: Overall Statistics */}
          <TabsContent value="overall" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Residents */}
              <Card className="border-2 border-orange-200 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Residents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {analytics.overview.totalResidents.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Registered in system</p>
                </CardContent>
              </Card>

              {/* Mobile Completion */}
              <Card className="border-2 border-green-200 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Mobile Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {analytics.overview.mobileCompletionRate}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {analytics.overview.residentsWithMobile.toLocaleString()} of{" "}
                    {analytics.overview.totalResidents.toLocaleString()} residents
                  </p>
                </CardContent>
              </Card>

              {/* Health ID Completion */}
              <Card className="border-2 border-blue-200 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Health ID Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.overview.healthIdCompletionRate}%
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {analytics.overview.residentsWithHealthId.toLocaleString()} of{" "}
                    {analytics.overview.totalResidents.toLocaleString()} residents
                  </p>
                </CardContent>
              </Card>

              {/* Recent Updates */}
              <Card className="border-2 border-purple-200 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Recent Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {analytics.overview.recentUpdatesCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Updates in last 30 days</p>
                </CardContent>
              </Card>
            </div>

            {/* Completion Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  Data Completion Overview
                </CardTitle>
                <CardDescription>Mobile number and health ID completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: "Mobile Numbers",
                        completion: analytics.overview.mobileCompletionRate,
                        missing: 100 - analytics.overview.mobileCompletionRate,
                      },
                      {
                        name: "Health IDs",
                        completion: analytics.overview.healthIdCompletionRate,
                        missing: 100 - analytics.overview.healthIdCompletionRate,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completion" fill="#16a34a" name="Completed %" />
                    <Bar dataKey="missing" fill="#ef4444" name="Missing %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report 2: Mandal-wise Report */}
          <TabsContent value="mandal" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Mandals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {analytics.mandalCompletion.length}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Mandals in Chittoor District</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Avg Mobile Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {analytics.mandalCompletion.length > 0
                      ? Math.round(
                          analytics.mandalCompletion.reduce(
                            (sum, m) => sum + m.mobileCompletionRate,
                            0
                          ) / analytics.mandalCompletion.length
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Average across all mandals</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Avg Health ID Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.mandalCompletion.length > 0
                      ? Math.round(
                          analytics.mandalCompletion.reduce(
                            (sum, m) => sum + m.healthIdCompletionRate,
                            0
                          ) / analytics.mandalCompletion.length
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Average across all mandals</p>
                </CardContent>
              </Card>
            </div>

            {/* Mandal Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Mandal Statistics</CardTitle>
                <CardDescription>Complete data for all mandals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th
                          className="text-left p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("name")}
                        >
                          <div className="flex items-center">
                            Mandal
                            <SortIcon
                              column="name"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("total")}
                        >
                          <div className="flex items-center justify-end">
                            Total Residents
                            <SortIcon
                              column="total"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("mobile")}
                        >
                          <div className="flex items-center justify-end">
                            Mobile No Updated
                            <SortIcon
                              column="mobile"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("withoutMobile")}
                        >
                          <div className="flex items-center justify-end">
                            Without Mobile No
                            <SortIcon
                              column="withoutMobile"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("mobilePercent")}
                        >
                          <div className="flex items-center justify-end">
                            Mobile No Updated %
                            <SortIcon
                              column="mobilePercent"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("healthId")}
                        >
                          <div className="flex items-center justify-end">
                            Health IDs Updated
                            <SortIcon
                              column="healthId"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("pendingHealthId")}
                        >
                          <div className="flex items-center justify-end">
                            Pending Health ID Updation
                            <SortIcon
                              column="pendingHealthId"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("healthIdPercent")}
                        >
                          <div className="flex items-center justify-end">
                            Health ID Completion %
                            <SortIcon
                              column="healthIdPercent"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedMandalData().map((mandal, index) => {
                        const withoutMobile = mandal.totalResidents - mandal.withMobile
                        const pendingHealthId = mandal.totalResidents - mandal.withHealthId
                        return (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{mandal.mandalName}</td>
                            <td className="p-3 text-right">{mandal.totalResidents.toLocaleString()}</td>
                            <td className="p-3 text-right">{mandal.withMobile.toLocaleString()}</td>
                            <td className="p-3 text-right text-red-600 font-semibold">
                              {withoutMobile.toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded ${
                                  mandal.mobileCompletionRate >= 80
                                    ? "bg-green-100 text-green-800"
                                    : mandal.mobileCompletionRate >= 50
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {mandal.mobileCompletionRate}%
                              </span>
                            </td>
                            <td className="p-3 text-right">{mandal.withHealthId.toLocaleString()}</td>
                            <td className="p-3 text-right text-orange-600 font-semibold">
                              {pendingHealthId.toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded ${
                                  mandal.healthIdCompletionRate >= 80
                                    ? "bg-green-100 text-green-800"
                                    : mandal.healthIdCompletionRate >= 50
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {mandal.healthIdCompletionRate}%
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
          </TabsContent>

          {/* Report 3: Field Officer Performance */}
          <TabsContent value="officers" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Currently Active Officers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {analytics.overview.currentlyActiveOfficersCount ?? 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Active in last 15 minutes
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Total enabled: {analytics.overview.totalActiveOfficersCount ?? 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {analytics.fieldOfficerPerformance
                      .reduce((sum, o) => sum + o.updatesCount, 0)
                      .toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">All-time updates</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Last 30 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.overview.recentUpdatesCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Recent updates</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Avg per Officer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {analytics.fieldOfficerPerformance.length > 0
                      ? Math.round(
                          analytics.fieldOfficerPerformance.reduce((sum, o) => sum + o.updatesCount, 0) /
                            analytics.fieldOfficerPerformance.length
                        )
                      : 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Updates per officer</p>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  Field Officer Performance Comparison
                </CardTitle>
                <CardDescription>Total updates by field officer</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.fieldOfficerPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="updatesCount" fill="#f97316" name="Total Updates" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Performance Metrics</CardTitle>
                <CardDescription>Individual officer statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search Input */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search by name, username, or role..."
                      value={officerSearchQuery}
                      onChange={(e) => handleOfficerSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th
                          className="text-left p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleOfficerSort("name")}
                        >
                          <div className="flex items-center">
                            Officer Name
                            <OfficerSortIcon
                              column="name"
                              currentColumn={officerSortColumn}
                              direction={officerSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-left p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleOfficerSort("username")}
                        >
                          <div className="flex items-center">
                            Username
                            <OfficerSortIcon
                              column="username"
                              currentColumn={officerSortColumn}
                              direction={officerSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-left p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleOfficerSort("role")}
                        >
                          <div className="flex items-center">
                            Role
                            <OfficerSortIcon
                              column="role"
                              currentColumn={officerSortColumn}
                              direction={officerSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleOfficerSort("mobileUpdates")}
                        >
                          <div className="flex items-center justify-end">
                            Mobile No Updated
                            <OfficerSortIcon
                              column="mobileUpdates"
                              currentColumn={officerSortColumn}
                              direction={officerSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleOfficerSort("healthIdUpdates")}
                        >
                          <div className="flex items-center justify-end">
                            Health IDs Updated
                            <OfficerSortIcon
                              column="healthIdUpdates"
                              currentColumn={officerSortColumn}
                              direction={officerSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right p-3 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleOfficerSort("updates")}
                        >
                          <div className="flex items-center justify-end">
                            Total Updates
                            <OfficerSortIcon
                              column="updates"
                              currentColumn={officerSortColumn}
                              direction={officerSortDirection}
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOfficers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            {officerSearchQuery
                              ? "No officers found matching your search"
                              : "No officer data available"}
                          </td>
                        </tr>
                      ) : (
                        paginatedOfficers.map((officer) => (
                          <tr key={officer.userId} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{officer.name}</td>
                            <td className="p-3 text-gray-600">{officer.username}</td>
                            <td className="p-3">
                              <Badge variant={officer.role === 'ADMIN' ? 'default' : 'secondary'}>
                                {officer.role}
                              </Badge>
                            </td>
                            <td className="p-3 text-right font-semibold text-green-600">
                              {officer.mobileUpdatesCount.toLocaleString()}
                            </td>
                            <td className="p-3 text-right font-semibold text-blue-600">
                              {officer.healthIdUpdatesCount.toLocaleString()}
                            </td>
                            <td className="p-3 text-right font-semibold text-orange-600">
                              {officer.updatesCount.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredOfficers.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t mt-4">
                    <div className="text-sm text-gray-600">
                      Showing {officerStartIndex + 1} to {Math.min(officerEndIndex, filteredOfficers.length)} of{" "}
                      {filteredOfficers.length} officers
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOfficerCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={officerCurrentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: officerTotalPages }, (_, i) => i + 1).map((page) => {
                          // Show first page, last page, current page, and pages around current
                          const showPage =
                            page === 1 ||
                            page === officerTotalPages ||
                            (page >= officerCurrentPage - 1 && page <= officerCurrentPage + 1)

                          if (!showPage) {
                            // Show ellipsis
                            if (page === officerCurrentPage - 2 || page === officerCurrentPage + 2) {
                              return (
                                <span key={page} className="px-2 text-gray-400">
                                  ...
                                </span>
                              )
                            }
                            return null
                          }

                          return (
                            <Button
                              key={page}
                              variant={officerCurrentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setOfficerCurrentPage(page)}
                              className={
                                officerCurrentPage === page
                                  ? "bg-orange-600 hover:bg-orange-700"
                                  : ""
                              }
                            >
                              {page}
                            </Button>
                          )
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOfficerCurrentPage((prev) => Math.min(officerTotalPages, prev + 1))}
                        disabled={officerCurrentPage === officerTotalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report 4: Data Completion Report */}
          <TabsContent value="completion" className="space-y-6">
            {/* Completion Pie Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mobile Completion Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Mobile Number Completion
                  </CardTitle>
                  <CardDescription>Distribution of mobile number data</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          {
                            name: "With Mobile",
                            value: analytics.overview.residentsWithMobile,
                            color: "#16a34a",
                          },
                          {
                            name: "Without Mobile",
                            value:
                              analytics.overview.totalResidents - analytics.overview.residentsWithMobile,
                            color: "#ef4444",
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {[
                          { name: "With Mobile", value: analytics.overview.residentsWithMobile },
                          {
                            name: "Without Mobile",
                            value:
                              analytics.overview.totalResidents - analytics.overview.residentsWithMobile,
                          },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "#16a34a" : "#ef4444"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-4">
                    <p className="text-2xl font-bold text-green-600">
                      {analytics.overview.mobileCompletionRate}%
                    </p>
                    <p className="text-sm text-gray-500">Completion Rate</p>
                  </div>
                </CardContent>
              </Card>

              {/* Health ID Completion Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Health ID Completion
                  </CardTitle>
                  <CardDescription>Distribution of health ID data</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          {
                            name: "With Health ID",
                            value: analytics.overview.residentsWithHealthId,
                            color: "#3b82f6",
                          },
                          {
                            name: "Without Health ID",
                            value:
                              analytics.overview.totalResidents -
                              analytics.overview.residentsWithHealthId,
                            color: "#ef4444",
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {[
                          { name: "With Health ID", value: analytics.overview.residentsWithHealthId },
                          {
                            name: "Without Health ID",
                            value:
                              analytics.overview.totalResidents -
                              analytics.overview.residentsWithHealthId,
                          },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "#3b82f6" : "#ef4444"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-4">
                    <p className="text-2xl font-bold text-blue-600">
                      {analytics.overview.healthIdCompletionRate}%
                    </p>
                    <p className="text-sm text-gray-500">Completion Rate</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Missing Data by Mandal */}
            <Card>
              <CardHeader>
                <CardTitle>Missing Data by Mandal</CardTitle>
                <CardDescription>Mandals with lowest completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-semibold">Mandal</th>
                        <th className="text-right p-3 font-semibold">Total Residents</th>
                        <th className="text-right p-3 font-semibold">Missing Mobile</th>
                        <th className="text-right p-3 font-semibold">Missing Health ID</th>
                        <th className="text-right p-3 font-semibold">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.mandalCompletion
                        .sort(
                          (a, b) =>
                            a.mobileCompletionRate +
                            a.healthIdCompletionRate -
                            (b.mobileCompletionRate + b.healthIdCompletionRate)
                        )
                        .slice(0, 10)
                        .map((mandal, index) => {
                          const missingMobile = mandal.totalResidents - mandal.withMobile
                          const missingHealthId = mandal.totalResidents - mandal.withHealthId
                          const avgCompletion =
                            (mandal.mobileCompletionRate + mandal.healthIdCompletionRate) / 2
                          return (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">{mandal.mandalName}</td>
                              <td className="p-3 text-right">{mandal.totalResidents.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-600 font-semibold">
                                {missingMobile.toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-red-600 font-semibold">
                                {missingHealthId.toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <span
                                  className={`inline-block px-2 py-1 rounded font-semibold ${
                                    avgCompletion < 30
                                      ? "bg-red-100 text-red-800"
                                      : avgCompletion < 60
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {avgCompletion < 30 ? "High" : avgCompletion < 60 ? "Medium" : "Low"}
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
          </TabsContent>

          {/* Report 5: Update Activity Report */}
          <TabsContent value="updates" className="space-y-6">
            {/* Activity Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {analytics.overview.recentUpdatesCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Daily Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {Math.round(analytics.overview.recentUpdatesCount / 30)}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Updates per day</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Peak Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.updatesTimeline.length > 0
                      ? Math.max(...analytics.updatesTimeline.map((d) => d.count))
                      : 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Max updates in a day</p>
                </CardContent>
              </Card>
            </div>

            {/* Activity Timeline Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  Update Activity Timeline
                </CardTitle>
                <CardDescription>Daily update activity for the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.updatesTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#f97316"
                      strokeWidth={2}
                      name="Updates"
                      dot={{ fill: "#f97316" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Updates Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Update Activity</CardTitle>
                <CardDescription>Latest 50 updates to resident data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-semibold">Date</th>
                        <th className="text-left p-3 font-semibold">Resident</th>
                        <th className="text-left p-3 font-semibold">Field Updated</th>
                        <th className="text-left p-3 font-semibold">Old Value</th>
                        <th className="text-left p-3 font-semibold">New Value</th>
                        <th className="text-left p-3 font-semibold">Updated By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.recentUpdates.slice(0, 20).map((update) => (
                        <tr key={update.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-xs">
                            {new Date(update.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{update.residentName}</div>
                            <div className="text-xs text-gray-500">{update.residentId}</div>
                          </td>
                          <td className="p-3">
                            <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                              {update.fieldUpdated}
                            </span>
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {update.oldValue || <span className="italic">empty</span>}
                          </td>
                          <td className="p-3 font-medium text-xs">{update.newValue}</td>
                          <td className="p-3">
                            <div className="text-xs">{update.updatedBy}</div>
                            <div className="text-xs text-gray-500">@{update.username}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report 6: Demographics Summary */}
          <TabsContent value="demographics" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-2 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Population</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {analytics.overview.totalResidents.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Registered residents</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Mandals Covered</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {analytics.mandalStatistics.length}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Administrative divisions</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Data Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {Math.round(
                      (analytics.overview.mobileCompletionRate +
                        analytics.overview.healthIdCompletionRate) /
                        2
                    )}
                    %
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Average completion</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Active Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {analytics.overview.recentUpdatesCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Mandals by Population */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top 10 Mandals */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Mandals by Population</CardTitle>
                  <CardDescription>Largest mandals in the district</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.mandalStatistics.slice(0, 10).map((mandal, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                              index < 3
                                ? "bg-gradient-to-r from-orange-500 to-green-600"
                                : "bg-gray-400"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span className="font-medium">{mandal.mandalName}</span>
                        </div>
                        <span className="text-lg font-bold text-orange-600">
                          {mandal.residentCount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Quality by Top Mandals */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Quality - Top Mandals</CardTitle>
                  <CardDescription>Completion rates for largest mandals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.mandalCompletion.slice(0, 10).map((mandal, index) => (
                      <div key={index}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{mandal.mandalName}</span>
                          <span className="text-sm text-gray-500">
                            {Math.round(
                              (mandal.mobileCompletionRate + mandal.healthIdCompletionRate) / 2
                            )}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-orange-500 to-green-600 h-2 rounded-full"
                            style={{
                              width: `${Math.round(
                                (mandal.mobileCompletionRate + mandal.healthIdCompletionRate) / 2
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Statistics Table */}
            <Card>
              <CardHeader>
                <CardTitle>Comprehensive Mandal Statistics</CardTitle>
                <CardDescription>Complete demographic and data quality overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-semibold">Rank</th>
                        <th className="text-left p-3 font-semibold">Mandal</th>
                        <th className="text-right p-3 font-semibold">Population</th>
                        <th className="text-right p-3 font-semibold">% of Total</th>
                        <th className="text-right p-3 font-semibold">Mobile %</th>
                        <th className="text-right p-3 font-semibold">Health ID %</th>
                        <th className="text-right p-3 font-semibold">Avg Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.mandalCompletion.map((mandal, index) => {
                        const percentOfTotal =
                          (mandal.totalResidents / analytics.overview.totalResidents) * 100
                        const avgQuality =
                          (mandal.mobileCompletionRate + mandal.healthIdCompletionRate) / 2
                        return (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-3 text-center font-semibold text-gray-500">
                              {index + 1}
                            </td>
                            <td className="p-3 font-medium">{mandal.mandalName}</td>
                            <td className="p-3 text-right font-semibold">
                              {mandal.totalResidents.toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-gray-600">
                              {percentOfTotal.toFixed(1)}%
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs ${
                                  mandal.mobileCompletionRate >= 80
                                    ? "bg-green-100 text-green-800"
                                    : mandal.mobileCompletionRate >= 50
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {mandal.mobileCompletionRate}%
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs ${
                                  mandal.healthIdCompletionRate >= 80
                                    ? "bg-green-100 text-green-800"
                                    : mandal.healthIdCompletionRate >= 50
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {mandal.healthIdCompletionRate}%
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded font-semibold ${
                                  avgQuality >= 80
                                    ? "bg-green-100 text-green-800"
                                    : avgQuality >= 50
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {Math.round(avgQuality)}%
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

