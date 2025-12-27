"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronLeft, Search, Phone, MapPin, AlertTriangle, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface DuplicateMobileData {
  mobileNumber: string
  count: number
  sampleNames: string[]
  mandals: string[]
  secretariats: string[]
  residents: Array<{
    residentId: string
    name: string
    citizenMobile: string | null
    healthId: string | null
    mandalName: string | null
    secName: string | null
    updatedAt: Date
  }>
}

interface ApiResponse {
  total: number
  totalAffectedResidents: number
  duplicates: DuplicateMobileData[]
}

export default function DuplicateMobileNumbersPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedMobiles, setExpandedMobiles] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<"csv" | "excel" | null>(null)
  const [maskUid, setMaskUid] = useState(false) // Default to unmasked
  const [exportProgress, setExportProgress] = useState<{
    status: "initializing" | "processing" | "completed" | "error"
    message: string
    processedRecords: number
    totalRecords: number
    currentBatch: number
    totalBatches: number
  } | null>(null)

  useEffect(() => {
    fetchDuplicateMobileNumbers()
  }, [])

  const fetchDuplicateMobileNumbers = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/duplicate-mobile-numbers")

      if (!response.ok) {
        throw new Error("Failed to fetch duplicate mobile numbers")
      }

      const result: ApiResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      toast.error("Failed to load duplicate mobile numbers")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpand = (mobileNumber: string) => {
    setExpandedMobiles((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(mobileNumber)) {
        newSet.delete(mobileNumber)
      } else {
        newSet.add(mobileNumber)
      }
      return newSet
    })
  }

  const handleExportClick = (format: "csv" | "excel") => {
    setPendingExportFormat(format)
    setShowExportDialog(true)
  }

  const handleExport = async () => {
    if (!pendingExportFormat) return

    setShowExportDialog(false)
    setShowProgressDialog(true)
    setIsExporting(true)

    // Generate a unique session ID for this export
    const sessionId = `export-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    console.log(`Starting export with sessionId: ${sessionId}`)

    try {
      // Start the export in the background
      const exportUrl = `/api/admin/export/duplicate-mobiles-${pendingExportFormat}?maskUid=${maskUid.toString()}&sessionId=${sessionId}`

      // Start polling for progress
      pollProgress(sessionId, pendingExportFormat)

      // Fetch the export file
      const response = await fetch(exportUrl)

      if (!response.ok) {
        throw await getErrorMessage(response)
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `duplicate_mobile_numbers.${pendingExportFormat === "excel" ? "xlsx" : "csv"}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Get the blob data
      const blob = await response.blob()

      // Create download link and trigger download
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      setExportProgress({
        status: "completed",
        message: "Export completed successfully!",
        processedRecords: exportProgress?.totalRecords || 0,
        totalRecords: exportProgress?.totalRecords || 0,
        currentBatch: exportProgress?.totalBatches || 0,
        totalBatches: exportProgress?.totalBatches || 0,
      })

      setTimeout(() => {
        setShowProgressDialog(false)
        toast.success(`Successfully exported ${filename}`)
      }, 1500)
    } catch (err) {
      console.error("Export error:", err)
      setExportProgress({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to export data",
        processedRecords: 0,
        totalRecords: 0,
        currentBatch: 0,
        totalBatches: 0,
      })

      setTimeout(() => {
        setShowProgressDialog(false)
        toast.error(err instanceof Error ? err.message : "Failed to export data")
      }, 2000)
    } finally {
      setIsExporting(false)
      setExportFormat(null)
      setPendingExportFormat(null)
    }
  }

  const pollProgress = async (sessionId: string, format: "csv" | "excel") => {
    const maxPollTime = 60000 // 1 minute
    const pollInterval = 500 // 500ms
    const startTime = Date.now()

    const poll = async () => {
      if (Date.now() - startTime > maxPollTime) {
        console.log("Polling timeout")
        return
      }

      try {
        const response = await fetch(`/api/admin/export/progress/${sessionId}`)
        if (response.ok) {
          const progress = await response.json()
          console.log("Progress update:", progress)
          setExportProgress(progress)

          if (progress.status === "completed" || progress.status === "error") {
            return
          }
        }
      } catch (err) {
        console.error("Error polling progress:", err)
      }

      // Continue polling
      setTimeout(poll, pollInterval)
    }

    poll()
  }

  const getErrorMessage = async (response: Response): Promise<Error> => {
    try {
      const errorData = await response.json()
      return new Error(errorData.error || `Failed to generate export`)
    } catch {
      return new Error(response.statusText || "Failed to generate export")
    }
  }

  const filteredDuplicates = data?.duplicates.filter((dup) =>
    dup.mobileNumber.includes(searchQuery) ||
    dup.mandals.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
    dup.residents.some((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  if (isLoading) {
    return (
      <DashboardLayout requiredRole="ADMIN">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading duplicate mobile numbers...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !data) {
    return (
      <DashboardLayout requiredRole="ADMIN">
        <Card className="border-2 border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-16 w-16 text-red-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Data</h3>
            <p className="text-gray-600 mb-4">{error || "Unable to fetch duplicate mobile numbers"}</p>
            <Button onClick={fetchDuplicateMobileNumbers} className="bg-gradient-to-r from-orange-500 to-green-600">
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
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Duplicate Mobile Numbers</h1>
              <p className="text-gray-600 mt-1">
                Mobile numbers appearing more than 5 times in the database
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleExportClick("excel")}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
              disabled={isExporting}
            >
              {isExporting && exportFormat === "excel" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export Excel
            </Button>
            <Button
              onClick={() => handleExportClick("csv")}
              variant="outline"
              className="border-orange-600 text-orange-600 hover:bg-orange-50"
              disabled={isExporting}
            >
              {isExporting && exportFormat === "csv" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Duplicate Mobile Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{data.total}</div>
              <p className="text-xs text-gray-500 mt-2">Unique mobile numbers</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Affected Residents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {data.totalAffectedResidents.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-2">Total records with duplicate mobiles</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Occurrences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {data.total > 0 ? (data.totalAffectedResidents / data.total).toFixed(1) : 0}
              </div>
              <p className="text-xs text-gray-500 mt-2">Average times per mobile number</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by mobile number, mandal, or resident name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Duplicate Mobile Numbers List */}
        <div className="space-y-4">
          {filteredDuplicates.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-gray-500">No duplicate mobile numbers found matching your search.</p>
              </CardContent>
            </Card>
          ) : (
            filteredDuplicates.map((dup) => {
              const isExpanded = expandedMobiles.has(dup.mobileNumber)
              return (
                <Card key={dup.mobileNumber} className="border-2 border-amber-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-orange-600" />
                          <span className="text-lg">{dup.mobileNumber}</span>
                          <Badge variant="destructive" className="text-sm">
                            {dup.count} times
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Found in {dup.mandals.length} mandal{dup.mandals.length > 1 ? "s" : ""} •{" "}
                          {dup.secretariats.length} secretariat{dup.secretariats.length > 1 ? "s" : ""}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(dup.mobileNumber)}
                      >
                        {isExpanded ? "Hide" : "Show"} Residents
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent>
                      {/* Mandal tags */}
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">Mandals:</div>
                        <div className="flex flex-wrap gap-2">
                          {dup.mandals.map((mandal) => (
                            <Badge key={mandal} variant="secondary">
                              <MapPin className="h-3 w-3 mr-1" />
                              {mandal}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Residents table */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-3 font-semibold">Resident ID</th>
                              <th className="text-left p-3 font-semibold">Name</th>
                              <th className="text-left p-3 font-semibold">Mobile</th>
                              <th className="text-left p-3 font-semibold">ABHA ID</th>
                              <th className="text-left p-3 font-semibold">Mandal</th>
                              <th className="text-left p-3 font-semibold">Secretariat</th>
                              <th className="text-left p-3 font-semibold">Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dup.residents.map((resident) => (
                              <tr key={resident.residentId} className="border-t hover:bg-gray-50">
                                <td className="p-3 font-mono text-xs">{resident.residentId}</td>
                                <td className="p-3 font-medium">{resident.name}</td>
                                <td className="p-3">{resident.citizenMobile || "-"}</td>
                                <td className="p-3 font-mono text-xs">{resident.healthId || "-"}</td>
                                <td className="p-3">{resident.mandalName || "-"}</td>
                                <td className="p-3">{resident.secName || "-"}</td>
                                <td className="p-3 text-xs">
                                  {new Date(resident.updatedAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Export Options Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Options</DialogTitle>
            <DialogDescription>
              Choose your preferences for exporting duplicate mobile numbers as {pendingExportFormat?.toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maskUid"
                  checked={maskUid}
                  onCheckedChange={(checked) => setMaskUid(checked as boolean)}
                />
                <label htmlFor="maskUid" className="text-sm font-medium cursor-pointer">
                  Mask Aadhaar numbers (show only last 4 digits)
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {maskUid
                  ? "Aadhaar numbers will be masked (e.g., ********1234)"
                  : "Full Aadhaar numbers will be exported"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} className="bg-gradient-to-r from-orange-500 to-green-600">
              Export {pendingExportFormat?.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="sm:max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>Exporting Duplicate Mobile Numbers</DialogTitle>
            <DialogDescription>
              {exportProgress?.message || "Preparing your export..."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            {/* Progress Steps */}
            <div className="space-y-4">
              {/* Step 1: Initializing */}
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  exportProgress && exportProgress.currentBatch >= 1
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {exportProgress && exportProgress.currentBatch > 1 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Initializing</p>
                  <p className="text-xs text-gray-500">
                    {exportProgress && exportProgress.currentBatch >= 1 ? "Completed" : "Starting..."}
                  </p>
                </div>
              </div>

              {/* Step 2: Fetching Duplicates */}
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  exportProgress && exportProgress.currentBatch >= 2
                    ? "bg-green-500 text-white"
                    : exportProgress && exportProgress.currentBatch === 1
                    ? "bg-blue-500 text-white animate-pulse"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {exportProgress && exportProgress.currentBatch > 2 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Fetching Duplicate Mobiles</p>
                  <p className="text-xs text-gray-500">
                    {exportProgress && exportProgress.currentBatch >= 2 ? "Completed" : "Searching for duplicates..."}
                  </p>
                </div>
              </div>

              {/* Step 3: Fetching Residents */}
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  exportProgress && exportProgress.currentBatch >= 3
                    ? "bg-green-500 text-white"
                    : exportProgress && exportProgress.currentBatch === 2
                    ? "bg-blue-500 text-white animate-pulse"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {exportProgress && exportProgress.currentBatch > 3 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Fetching Residents</p>
                  <p className="text-xs text-gray-500">
                    {exportProgress && exportProgress.currentBatch >= 3
                      ? `Found ${exportProgress.totalRecords} residents`
                      : "Loading resident data..."}
                  </p>
                </div>
              </div>

              {/* Step 4: Generating File */}
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  exportProgress && exportProgress.status === "completed"
                    ? "bg-green-500 text-white"
                    : exportProgress && exportProgress.currentBatch === 3
                    ? "bg-blue-500 text-white animate-pulse"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {exportProgress && exportProgress.status === "completed" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : exportProgress && exportProgress.currentBatch >= 4 ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-xs font-bold">4</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Generating {pendingExportFormat?.toUpperCase()}</p>
                  <p className="text-xs text-gray-500">
                    {exportProgress && exportProgress.status === "completed"
                      ? "Completed!"
                      : exportProgress && exportProgress.currentBatch >= 4
                      ? "Creating file..."
                      : "Waiting..."}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {exportProgress && exportProgress.totalRecords > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Progress</span>
                    <span>{exportProgress.status === "completed"
                      ? "100%"
                      : `${Math.round((exportProgress.processedRecords / exportProgress.totalRecords) * 100)}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        exportProgress.status === "completed"
                          ? "bg-green-500"
                          : exportProgress.status === "error"
                          ? "bg-red-500"
                          : "bg-blue-500"
                      }`}
                      style={{
                        width: `${exportProgress.status === "completed"
                          ? 100
                          : (exportProgress.processedRecords / exportProgress.totalRecords) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {exportProgress && exportProgress.status === "error" && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{exportProgress.message}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
