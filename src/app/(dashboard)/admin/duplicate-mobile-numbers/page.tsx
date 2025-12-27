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
  const [pendingExportFormat, setPendingExportFormat] = useState<"csv" | "excel" | null>(null)
  const [maskUid, setMaskUid] = useState(false) // Default to unmasked

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

    setIsExporting(true)
    setExportFormat(pendingExportFormat)
    setShowExportDialog(false)

    try {
      const url = `/api/admin/export/duplicate-mobiles-${pendingExportFormat}?maskUid=${maskUid.toString()}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to generate ${pendingExportFormat.toUpperCase()} export`)
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

      toast.success(`Successfully exported ${filename}`)
    } catch (err) {
      console.error("Export error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to export data")
    } finally {
      setIsExporting(false)
      setExportFormat(null)
      setPendingExportFormat(null)
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
    </DashboardLayout>
  )
}
