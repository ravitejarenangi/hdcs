"use client"

import React, { useState, useEffect } from "react"
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
  ChevronLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Upload,
  FileSpreadsheet,
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
import * as XLSX from "xlsx"

interface AnalyticsData {
  overview: {
    totalResidents: number
    residentsWithMobile: number
    residentsWithHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
    recentUpdatesCount: number
    // Separate update counts by field type
    mobileUpdatesCount?: number
    healthIdUpdatesCount?: number
    // Enhanced mobile and ABHA ID statistics
    mobileUpdatesAllTime?: number
    mobileUpdatesToday?: number
    healthIdUpdatesAllTime?: number
    healthIdsAddedViaUpdates?: number
    healthIdsOriginal?: number
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
    mobileUpdatesAllTime: number
    mobileUpdatesToday: number
    healthIdUpdatesAllTime: number
    healthIdUpdatesToday: number
    healthIdsOriginal: number
    healthIdsAddedViaUpdates: number
  }>
  mandalHierarchy: Array<{
    mandalName: string
    totalResidents: number
    withMobile: number
    withHealthId: number
    mobileCompletionRate: number
    healthIdCompletionRate: number
    mobileUpdatesAllTime: number
    mobileUpdatesToday: number
    healthIdUpdatesAllTime: number
    healthIdUpdatesToday: number
    healthIdsOriginal: number
    healthIdsAddedViaUpdates: number
    secretariats: Array<{
      secName: string
      totalResidents: number
      withMobile: number
      withHealthId: number
      mobileCompletionRate: number
      healthIdCompletionRate: number
      mobileUpdatesAllTime: number
      mobileUpdatesToday: number
      healthIdUpdatesAllTime: number
      healthIdUpdatesToday: number
      healthIdsOriginal: number
      healthIdsAddedViaUpdates: number
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

type MandalSortColumn = "name" | "total" | "mobile" | "healthId"
type OfficerSortColumn = "name" | "username" | "role" | "updates"
type UpdatesSortColumn = "resident" | "field" | "updatedBy" | "date"
type SortDirection = "asc" | "desc" | null

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedMandals, setExpandedMandals] = useState<Set<string>>(new Set())

  // Pagination state for Field Officer Performance table
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Sorting state for Mandal table
  const [mandalSortColumn, setMandalSortColumn] = useState<MandalSortColumn | null>(null)
  const [mandalSortDirection, setMandalSortDirection] = useState<SortDirection>(null)

  // Sorting state for Field Officer table
  const [officerSortColumn, setOfficerSortColumn] = useState<OfficerSortColumn | null>(null)
  const [officerSortDirection, setOfficerSortDirection] = useState<SortDirection>(null)

  // Sorting state for Recent Updates table
  const [updatesSortColumn, setUpdatesSortColumn] = useState<UpdatesSortColumn | null>(null)
  const [updatesSortDirection, setUpdatesSortDirection] = useState<SortDirection>(null)

  // Export state
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

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

  // Sorting handlers
  const handleMandalSort = (column: MandalSortColumn) => {
    if (mandalSortColumn === column) {
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

  const handleOfficerSort = (column: OfficerSortColumn) => {
    if (officerSortColumn === column) {
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

  const handleUpdatesSort = (column: UpdatesSortColumn) => {
    if (updatesSortColumn === column) {
      if (updatesSortDirection === "asc") {
        setUpdatesSortDirection("desc")
      } else if (updatesSortDirection === "desc") {
        setUpdatesSortDirection(null)
        setUpdatesSortColumn(null)
      }
    } else {
      setUpdatesSortColumn(column)
      setUpdatesSortDirection("asc")
    }
  }

  // Export functions for Mandal-Wise table
  const exportMandalTableToCSV = () => {
    if (!analytics?.mandalHierarchy) {
      toast.error("No data available to export")
      return
    }

    try {
      setIsExportingCsv(true)
      toast.info("Generating CSV export...")

      // Prepare CSV data
      const csvRows: string[] = []

      // Header row
      const headers = [
        "Mandal Name",
        "Total Residents",
        "Mobile %",
        "ABHA ID %",
        "Mobile Updates (All Time)",
        "Mobile Updates (Today)",
        "ABHA IDs (Original)",
        "ABHA IDs (Added)",
        "ABHA IDs (Today)",
      ]
      csvRows.push(headers.join(","))

      // Data rows - Mandals only (no secretariats)
      analytics.mandalHierarchy.forEach((mandal) => {
        csvRows.push([
          `"${mandal.mandalName}"`,
          mandal.totalResidents,
          `${mandal.mobileCompletionRate}%`,
          `${mandal.healthIdCompletionRate}%`,
          mandal.mobileUpdatesAllTime,
          mandal.mobileUpdatesToday,
          mandal.healthIdsOriginal,
          mandal.healthIdsAddedViaUpdates,
          mandal.healthIdUpdatesToday,
        ].join(","))
      })

      // Totals row
      const totalResidents = analytics.mandalHierarchy.reduce((sum, m) => sum + m.totalResidents, 0)
      const avgMobile = Math.round(
        analytics.mandalHierarchy.reduce((sum, m) => sum + m.mobileCompletionRate, 0) /
          analytics.mandalHierarchy.length
      )
      const avgHealthId = Math.round(
        analytics.mandalHierarchy.reduce((sum, m) => sum + m.healthIdCompletionRate, 0) /
          analytics.mandalHierarchy.length
      )
      const totalMobileUpdatesAllTime = analytics.mandalHierarchy.reduce(
        (sum, m) => sum + m.mobileUpdatesAllTime,
        0
      )
      const totalMobileUpdatesToday = analytics.mandalHierarchy.reduce(
        (sum, m) => sum + m.mobileUpdatesToday,
        0
      )
      const totalHealthIdsOriginal = analytics.mandalHierarchy.reduce(
        (sum, m) => sum + m.healthIdsOriginal,
        0
      )
      const totalHealthIdsAdded = analytics.mandalHierarchy.reduce(
        (sum, m) => sum + m.healthIdsAddedViaUpdates,
        0
      )
      const totalHealthIdsToday = analytics.mandalHierarchy.reduce(
        (sum, m) => sum + m.healthIdUpdatesToday,
        0
      )

      csvRows.push([
        '"TOTAL (All Mandals)"',
        totalResidents,
        `"${avgMobile}% avg"`,
        `"${avgHealthId}% avg"`,
        totalMobileUpdatesAllTime,
        totalMobileUpdatesToday,
        totalHealthIdsOriginal,
        totalHealthIdsAdded,
        totalHealthIdsToday,
      ].join(","))

      // Create CSV content with BOM for Excel compatibility
      const BOM = "\uFEFF"
      const csvContent = BOM + csvRows.join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      link.download = `mandal_completion_rates_${timestamp}.csv`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success("CSV exported successfully", {
        description: `File: mandal_completion_rates_${timestamp}.csv`,
      })
    } catch (error) {
      console.error("CSV export error:", error)
      toast.error("Failed to export CSV", {
        description: "Please try again",
      })
    } finally {
      setIsExportingCsv(false)
    }
  }

  const exportMandalTableToExcel = () => {
    if (!analytics?.mandalHierarchy) {
      toast.error("No data available to export")
      return
    }

    try {
      setIsExportingExcel(true)
      toast.info("Generating Excel export...")

      // Prepare data for Excel
      const excelData: Array<Record<string, string | number>> = []

      // Add mandals only (no secretariats)
      analytics.mandalHierarchy.forEach((mandal) => {
        excelData.push({
          "Mandal Name": mandal.mandalName,
          "Total Residents": mandal.totalResidents,
          "Mobile %": `${mandal.mobileCompletionRate}%`,
          "ABHA ID %": `${mandal.healthIdCompletionRate}%`,
          "Mobile Updates (All Time)": mandal.mobileUpdatesAllTime,
          "Mobile Updates (Today)": mandal.mobileUpdatesToday,
          "ABHA IDs (Original)": mandal.healthIdsOriginal,
          "ABHA IDs (Added)": mandal.healthIdsAddedViaUpdates,
          "ABHA IDs (Today)": mandal.healthIdUpdatesToday,
        })
      })

      // Totals row
      const totalResidents = analytics.mandalHierarchy.reduce((sum, m) => sum + m.totalResidents, 0)
      const avgMobile = Math.round(
        analytics.mandalHierarchy.reduce((sum, m) => sum + m.mobileCompletionRate, 0) /
          analytics.mandalHierarchy.length
      )
      const avgHealthId = Math.round(
        analytics.mandalHierarchy.reduce((sum, m) => sum + m.healthIdCompletionRate, 0) /
          analytics.mandalHierarchy.length
      )

      excelData.push({
        "Mandal Name": "TOTAL (All Mandals)",
        "Total Residents": totalResidents,
        "Mobile %": `${avgMobile}% avg`,
        "ABHA ID %": `${avgHealthId}% avg`,
        "Mobile Updates (All Time)": analytics.mandalHierarchy.reduce(
          (sum, m) => sum + m.mobileUpdatesAllTime,
          0
        ),
        "Mobile Updates (Today)": analytics.mandalHierarchy.reduce(
          (sum, m) => sum + m.mobileUpdatesToday,
          0
        ),
        "ABHA IDs (Original)": analytics.mandalHierarchy.reduce(
          (sum, m) => sum + m.healthIdsOriginal,
          0
        ),
        "ABHA IDs (Added)": analytics.mandalHierarchy.reduce(
          (sum, m) => sum + m.healthIdsAddedViaUpdates,
          0
        ),
        "ABHA IDs (Today)": analytics.mandalHierarchy.reduce(
          (sum, m) => sum + m.healthIdUpdatesToday,
          0
        ),
      })

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData)

      // Set column widths
      worksheet["!cols"] = [
        { wch: 25 }, // Name
        { wch: 15 }, // Total Residents
        { wch: 12 }, // Mobile %
        { wch: 12 }, // ABHA ID %
        { wch: 22 }, // Mobile Updates (All Time)
        { wch: 22 }, // Mobile Updates (Today)
        { wch: 20 }, // ABHA IDs (Original)
        { wch: 18 }, // ABHA IDs (Added)
        { wch: 18 }, // ABHA IDs (Today)
      ]

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mandal Completion Rates")

      // Generate Excel file
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      const filename = `mandal_completion_rates_${timestamp}.xlsx`

      XLSX.writeFile(workbook, filename)

      toast.success("Excel exported successfully", {
        description: `File: ${filename}`,
      })
    } catch (error) {
      console.error("Excel export error:", error)
      toast.error("Failed to export Excel", {
        description: "Please try again",
      })
    } finally {
      setIsExportingExcel(false)
    }
  }

  // Sort icon component
  const SortIcon = ({
    column,
    currentColumn,
    direction
  }: {
    column: string
    currentColumn: string | null
    direction: SortDirection
  }) => {
    if (currentColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-gray-400" />
    }
    if (direction === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1 text-orange-600" />
    }
    return <ArrowDown className="h-4 w-4 ml-1 text-orange-600" />
  }

  // Get sorted mandal data
  const getSortedMandals = () => {
    if (!analytics || !mandalSortColumn || !mandalSortDirection) {
      return analytics?.mandalHierarchy || []
    }

    return [...analytics.mandalHierarchy].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (mandalSortColumn) {
        case "name":
          aValue = a.mandalName
          bValue = b.mandalName
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
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return mandalSortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return mandalSortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  }

  // Get sorted officer data
  const getSortedOfficers = () => {
    if (!analytics) return []

    let sorted = [...analytics.fieldOfficerPerformance]

    if (officerSortColumn && officerSortDirection) {
      sorted = sorted.sort((a, b) => {
        let aValue: number | string
        let bValue: number | string

        switch (officerSortColumn) {
          case "name":
            aValue = a.name
            bValue = b.name
            break
          case "username":
            aValue = a.username
            bValue = b.username
            break
          case "role":
            aValue = a.role
            bValue = b.role
            break
          case "updates":
            aValue = a.updatesCount
            bValue = b.updatesCount
            break
          default:
            return 0
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          return officerSortDirection === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }

        return officerSortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number)
      })
    }

    return sorted
  }

  // Pagination logic for Field Officer Performance
  const getPaginatedOfficers = () => {
    const sorted = getSortedOfficers()
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sorted.slice(startIndex, endIndex)
  }

  const totalPages = analytics
    ? Math.ceil(analytics.fieldOfficerPerformance.length / itemsPerPage)
    : 0

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Get sorted updates data
  const getSortedUpdates = () => {
    if (!analytics || !updatesSortColumn || !updatesSortDirection) {
      return analytics?.recentUpdates || []
    }

    return [...analytics.recentUpdates].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (updatesSortColumn) {
        case "resident":
          aValue = a.residentName
          bValue = b.residentName
          break
        case "field":
          aValue = a.fieldUpdated
          bValue = b.fieldUpdated
          break
        case "updatedBy":
          aValue = a.updatedBy
          bValue = b.updatedBy
          break
        case "date":
          aValue = new Date(a.updatedAt).getTime()
          bValue = new Date(b.updatedAt).getTime()
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return updatesSortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return updatesSortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/admin/export"}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
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
                <CardContent className="space-y-3">
                  {/* Completion Rate */}
                  <div>
                    <p className="text-4xl font-bold text-green-600">
                      {analytics.overview.mobileCompletionRate}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {analytics.overview.residentsWithMobile.toLocaleString()} of{" "}
                      {analytics.overview.totalResidents.toLocaleString()} residents
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-green-200"></div>

                  {/* Update Statistics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-100 p-2 rounded">
                      <p className="text-xs text-gray-600">Total Updated</p>
                      <p className="text-lg font-bold text-green-700">
                        {(analytics.overview.mobileUpdatesAllTime || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-green-100 p-2 rounded relative">
                      <Badge className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] px-1.5 py-0">
                        Today
                      </Badge>
                      <p className="text-xs text-gray-600">Updated Today</p>
                      <p className="text-lg font-bold text-green-700">
                        {(analytics.overview.mobileUpdatesToday || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ABHA IDs */}
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    ABHA IDs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Completion Rate */}
                  <div>
                    <p className="text-4xl font-bold text-purple-600">
                      {analytics.overview.healthIdCompletionRate}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {analytics.overview.residentsWithHealthId.toLocaleString()} of{" "}
                      {analytics.overview.totalResidents.toLocaleString()} residents
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-purple-200"></div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-purple-100 p-2 rounded">
                      <p className="text-xs text-gray-600">Original Data</p>
                      <p className="text-lg font-bold text-purple-700">
                        {(analytics.overview.healthIdsOriginal || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-purple-100 p-2 rounded">
                      <p className="text-xs text-gray-600">Added via Updates</p>
                      <p className="text-lg font-bold text-purple-700">
                        {(analytics.overview.healthIdsAddedViaUpdates || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Updates - Split by Field Type */}
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    Recent Updates
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mobile Numbers Updated */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Phone className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Mobile Numbers</p>
                        <p className="text-xs text-gray-500">Updated</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {(analytics.overview.mobileUpdatesCount || 0).toLocaleString()}
                    </p>
                  </div>

                  {/* ABHA IDs Updated */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">ABHA IDs</p>
                        <p className="text-xs text-gray-500">Updated</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {(analytics.overview.healthIdUpdatesCount || 0).toLocaleString()}
                    </p>
                  </div>

                  {/* Total Updates (Optional - for reference) */}
                  <div className="pt-2 border-t border-orange-100">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-600">Total Updates</p>
                      <p className="text-sm font-bold text-orange-600">
                        {analytics.overview.recentUpdatesCount.toLocaleString()}
                      </p>
                    </div>
                  </div>
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

                    {/* ABHA ID Placeholders */}
                    {(analytics.overview.residentsWithHealthIdPlaceholder || 0) > 0 && (
                      <div className="p-4 bg-white rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-700">Missing ABHA IDs</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">
                          {(analytics.overview.residentsWithHealthIdPlaceholder || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Records with NULL, N/A, or empty ABHA ID
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
                    Mobile numbers and ABHA IDs completion
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-indigo-600" />
                      Mandal-wise Completion Rates
                    </CardTitle>
                    <CardDescription>
                      Mobile and ABHA ID completion by mandal
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={exportMandalTableToCSV}
                      disabled={isExportingCsv || !analytics?.mandalHierarchy}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      {isExportingCsv ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      Export CSV
                    </Button>
                    <Button
                      onClick={exportMandalTableToExcel}
                      disabled={isExportingExcel || !analytics?.mandalHierarchy}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      {isExportingExcel ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4" />
                      )}
                      Export Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-4 w-12"></th>
                        <th
                          className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("name")}
                        >
                          <div className="flex items-center">
                            Name
                            <SortIcon
                              column="name"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("total")}
                        >
                          <div className="flex items-center justify-end">
                            Total
                            <SortIcon
                              column="total"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("mobile")}
                        >
                          <div className="flex items-center justify-end">
                            Mobile %
                            <SortIcon
                              column="mobile"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-right py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleMandalSort("healthId")}
                        >
                          <div className="flex items-center justify-end">
                            ABHA ID %
                            <SortIcon
                              column="healthId"
                              currentColumn={mandalSortColumn}
                              direction={mandalSortDirection}
                            />
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 bg-green-50">
                          <div className="text-xs font-semibold text-green-700">
                            Mobile Updates
                            <br />
                            (All Time)
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 bg-green-50">
                          <div className="text-xs font-semibold text-green-700">
                            Mobile Updates
                            <br />
                            (Today)
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 bg-purple-50">
                          <div className="text-xs font-semibold text-purple-700">
                            ABHA IDs
                            <br />
                            (Original)
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 bg-purple-50">
                          <div className="text-xs font-semibold text-purple-700">
                            ABHA IDs
                            <br />
                            (Added)
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 bg-purple-50">
                          <div className="text-xs font-semibold text-purple-700">
                            ABHA IDs
                            <br />
                            (Today)
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedMandals().map((mandal, mandalIndex) => (
                        <React.Fragment key={`mandal-${mandalIndex}`}>
                          {/* Level 1: Mandal Row */}
                          <tr
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
                            <td className="text-right py-2 px-4 bg-green-50 font-semibold text-green-700">
                              {mandal.mobileUpdatesAllTime.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-4 bg-green-50 font-semibold text-green-700">
                              {mandal.mobileUpdatesToday > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  {mandal.mobileUpdatesToday.toLocaleString()}
                                  <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                                    Today
                                  </Badge>
                                </span>
                              ) : (
                                "0"
                              )}
                            </td>
                            <td className="text-right py-2 px-4 bg-purple-50 font-semibold text-purple-700">
                              {mandal.healthIdsOriginal.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-4 bg-purple-50 font-semibold text-purple-700">
                              {mandal.healthIdsAddedViaUpdates.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-4 bg-purple-50 font-semibold text-purple-700">
                              {mandal.healthIdUpdatesToday > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  {mandal.healthIdUpdatesToday.toLocaleString()}
                                  <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">
                                    Today
                                  </Badge>
                                </span>
                              ) : (
                                "0"
                              )}
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
                                {/* Update statistics for secretariat */}
                                <td className="text-right py-2 px-4 bg-green-50 text-green-600 text-sm">
                                  {secretariat.mobileUpdatesAllTime.toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-4 bg-green-50 text-green-600 text-sm">
                                  {secretariat.mobileUpdatesToday > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                      {secretariat.mobileUpdatesToday.toLocaleString()}
                                      <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                                        Today
                                      </Badge>
                                    </span>
                                  ) : (
                                    "0"
                                  )}
                                </td>
                                <td className="text-right py-2 px-4 bg-purple-50 text-purple-600 text-sm">
                                  {secretariat.healthIdsOriginal.toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-4 bg-purple-50 text-purple-600 text-sm">
                                  {secretariat.healthIdsAddedViaUpdates.toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-4 bg-purple-50 text-purple-600 text-sm">
                                  {secretariat.healthIdUpdatesToday > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                      {secretariat.healthIdUpdatesToday.toLocaleString()}
                                      <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">
                                        Today
                                      </Badge>
                                    </span>
                                  ) : (
                                    "0"
                                  )}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}

                      {/* Totals Row */}
                      {analytics.mandalHierarchy.length > 0 && (
                        <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4 text-indigo-900">TOTALS</td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {analytics.mandalHierarchy
                              .reduce((sum, m) => sum + m.totalResidents, 0)
                              .toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge className="bg-blue-600 text-white">
                              {analytics.mandalHierarchy.length > 0
                                ? Math.round(
                                    analytics.mandalHierarchy.reduce(
                                      (sum, m) => sum + m.mobileCompletionRate,
                                      0
                                    ) / analytics.mandalHierarchy.length
                                  )
                                : 0}
                              % avg
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge className="bg-blue-600 text-white">
                              {analytics.mandalHierarchy.length > 0
                                ? Math.round(
                                    analytics.mandalHierarchy.reduce(
                                      (sum, m) => sum + m.healthIdCompletionRate,
                                      0
                                    ) / analytics.mandalHierarchy.length
                                  )
                                : 0}
                              % avg
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4 bg-green-100 text-green-800">
                            {analytics.mandalHierarchy
                              .reduce((sum, m) => sum + m.mobileUpdatesAllTime, 0)
                              .toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 bg-green-100 text-green-800">
                            {analytics.mandalHierarchy
                              .reduce((sum, m) => sum + m.mobileUpdatesToday, 0)
                              .toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 bg-purple-100 text-purple-800">
                            {analytics.mandalHierarchy
                              .reduce((sum, m) => sum + m.healthIdsOriginal, 0)
                              .toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 bg-purple-100 text-purple-800">
                            {analytics.mandalHierarchy
                              .reduce((sum, m) => sum + m.healthIdsAddedViaUpdates, 0)
                              .toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 bg-purple-100 text-purple-800">
                            {analytics.mandalHierarchy
                              .reduce((sum, m) => sum + m.healthIdUpdatesToday, 0)
                              .toLocaleString()}
                          </td>
                        </tr>
                      )}
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
                <div className="space-y-4">
                  {/* Items per page selector */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Show</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-600">entries</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Showing {analytics.fieldOfficerPerformance.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, analytics.fieldOfficerPerformance.length)} of{" "}
                      {analytics.fieldOfficerPerformance.length} entries
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th
                            className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => handleOfficerSort("name")}
                          >
                            <div className="flex items-center">
                              Name
                              <SortIcon
                                column="name"
                                currentColumn={officerSortColumn}
                                direction={officerSortDirection}
                              />
                            </div>
                          </th>
                          <th
                            className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => handleOfficerSort("username")}
                          >
                            <div className="flex items-center">
                              Username
                              <SortIcon
                                column="username"
                                currentColumn={officerSortColumn}
                                direction={officerSortDirection}
                              />
                            </div>
                          </th>
                          <th
                            className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => handleOfficerSort("role")}
                          >
                            <div className="flex items-center">
                              Role
                              <SortIcon
                                column="role"
                                currentColumn={officerSortColumn}
                                direction={officerSortDirection}
                              />
                            </div>
                          </th>
                          <th
                            className="text-right py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => handleOfficerSort("updates")}
                          >
                            <div className="flex items-center justify-end">
                              Updates
                              <SortIcon
                                column="updates"
                                currentColumn={officerSortColumn}
                                direction={officerSortDirection}
                              />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPaginatedOfficers().map((officer, index) => (
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

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      <div className="flex items-center gap-1">
                        {/* First page */}
                        {currentPage > 3 && (
                          <>
                            <Button
                              variant={currentPage === 1 ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(1)}
                              className="h-8 w-8 p-0"
                            >
                              1
                            </Button>
                            {currentPage > 4 && (
                              <span className="px-2 text-gray-500">...</span>
                            )}
                          </>
                        )}

                        {/* Page numbers around current page */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            return (
                              page === currentPage ||
                              page === currentPage - 1 ||
                              page === currentPage + 1 ||
                              page === currentPage - 2 ||
                              page === currentPage + 2
                            )
                          })
                          .map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              className={`h-8 w-8 p-0 ${
                                currentPage === page ? "bg-cyan-600 hover:bg-cyan-700" : ""
                              }`}
                            >
                              {page}
                            </Button>
                          ))}

                        {/* Last page */}
                        {currentPage < totalPages - 2 && (
                          <>
                            {currentPage < totalPages - 3 && (
                              <span className="px-2 text-gray-500">...</span>
                            )}
                            <Button
                              variant={currentPage === totalPages ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(totalPages)}
                              className="h-8 w-8 p-0"
                            >
                              {totalPages}
                            </Button>
                          </>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
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
                        <th
                          className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleUpdatesSort("resident")}
                        >
                          <div className="flex items-center">
                            Resident
                            <SortIcon
                              column="resident"
                              currentColumn={updatesSortColumn}
                              direction={updatesSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleUpdatesSort("field")}
                        >
                          <div className="flex items-center">
                            Field
                            <SortIcon
                              column="field"
                              currentColumn={updatesSortColumn}
                              direction={updatesSortDirection}
                            />
                          </div>
                        </th>
                        <th className="text-left py-2 px-4">Old Value</th>
                        <th className="text-left py-2 px-4">New Value</th>
                        <th
                          className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleUpdatesSort("updatedBy")}
                        >
                          <div className="flex items-center">
                            Updated By
                            <SortIcon
                              column="updatedBy"
                              currentColumn={updatesSortColumn}
                              direction={updatesSortDirection}
                            />
                          </div>
                        </th>
                        <th
                          className="text-left py-2 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleUpdatesSort("date")}
                        >
                          <div className="flex items-center">
                            Date
                            <SortIcon
                              column="date"
                              currentColumn={updatesSortColumn}
                              direction={updatesSortDirection}
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedUpdates().slice(0, 10).map((update) => (
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
                    className="h-24 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    onClick={() => {
                      toast.info("Import Data", {
                        description: "Data import feature coming soon",
                      })
                    }}
                  >
                    <Upload className="h-6 w-6 text-blue-600" />
                    <div className="text-center">
                      <div className="font-semibold">Import Data</div>
                      <div className="text-xs text-gray-500">Upload resident data</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 hover:bg-orange-50 hover:border-orange-300 transition-colors"
                    onClick={() => window.location.href = "/admin/export"}
                  >
                    <FileDown className="h-6 w-6 text-orange-600" />
                    <div className="text-center">
                      <div className="font-semibold">Export Data</div>
                      <div className="text-xs text-gray-500">Export resident data to CSV</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 hover:bg-green-50 hover:border-green-300 transition-colors"
                    onClick={fetchAnalytics}
                  >
                    <Activity className="h-6 w-6 text-green-600" />
                    <div className="text-center">
                      <div className="font-semibold">Refresh Analytics</div>
                      <div className="text-xs text-gray-500">Update dashboard data</div>
                    </div>
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
