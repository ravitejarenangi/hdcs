"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileDown, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface FilterOptions {
  mandals: string[]
  secretariats: string[]
  phcs: string[]
}

export default function AdminExportPage() {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    mandals: [],
    secretariats: [],
    phcs: [],
  })
  const [allSecretariats, setAllSecretariats] = useState<string[]>([])
  const [allPhcs, setAllPhcs] = useState<string[]>([])
  const [selectedMandal, setSelectedMandal] = useState<string>("all")
  const [selectedSecretariat, setSelectedSecretariat] = useState<string>("all")
  const [selectedPhc, setSelectedPhc] = useState<string>("all")
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [isLoadingCount, setIsLoadingCount] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Fetch record count when filters change
  useEffect(() => {
    fetchRecordCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMandal, selectedSecretariat, selectedPhc])

  // Update secretariat options when mandal changes
  useEffect(() => {
    if (selectedMandal === "all") {
      setFilterOptions((prev) => ({ ...prev, secretariats: allSecretariats }))
    } else {
      // Filter secretariats by selected mandal
      fetchSecretariatsByMandal(selectedMandal)
    }
    // Reset dependent filters
    setSelectedSecretariat("all")
    setSelectedPhc("all")
  }, [selectedMandal, allSecretariats])

  // Update PHC options when secretariat changes
  useEffect(() => {
    if (selectedSecretariat === "all") {
      setFilterOptions((prev) => ({ ...prev, phcs: allPhcs }))
    } else {
      // Filter PHCs by selected secretariat
      fetchPhcsBySecretariat(selectedSecretariat)
    }
    // Reset dependent filter
    setSelectedPhc("all")
  }, [selectedSecretariat, allPhcs])

  const clearFilterCache = () => {
    localStorage.removeItem("admin_filter_options")
    localStorage.removeItem("admin_filter_options_timestamp")
    console.log("Filter options cache cleared")
  }

  const fetchFilterOptions = async (forceRefresh = false) => {
    try {
      setIsLoadingFilters(true)

      // Check cache first (5 minute TTL)
      const cacheKey = "admin_filter_options"
      const cacheTimestampKey = "admin_filter_options_timestamp"
      const cachedData = localStorage.getItem(cacheKey)
      const cachedTimestamp = localStorage.getItem(cacheTimestampKey)
      const now = Date.now()
      const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

      if (!forceRefresh && cachedData && cachedTimestamp) {
        const age = now - parseInt(cachedTimestamp, 10)
        if (age < CACHE_TTL) {
          // Use cached data
          const data = JSON.parse(cachedData)
          setFilterOptions(data)
          setAllSecretariats(data.secretariats)
          setAllPhcs(data.phcs)
          setIsLoadingFilters(false)
          console.log("Loaded filter options from cache (age: " + Math.round(age / 1000) + "s)")
          return
        }
      }

      // Fetch from API
      const startTime = Date.now()
      const response = await fetch("/api/admin/filter-options")
      if (!response.ok) throw new Error("Failed to fetch filter options")

      const data = await response.json()
      const duration = Date.now() - startTime
      console.log(`Filter options loaded from API in ${duration}ms`)

      setFilterOptions(data)
      setAllSecretariats(data.secretariats)
      setAllPhcs(data.phcs)

      // Cache the data
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(cacheTimestampKey, now.toString())
    } catch (error) {
      console.error("Error fetching filter options:", error)
      toast.error("Failed to load filter options")
    } finally {
      setIsLoadingFilters(false)
    }
  }

  const handleRefreshFilters = () => {
    clearFilterCache()
    fetchFilterOptions(true)
    toast.info("Refreshing filter options...")
  }

  const fetchSecretariatsByMandal = async (mandalName: string) => {
    try {
      const startTime = Date.now()
      const response = await fetch(
        `/api/admin/filter-options?mandalName=${encodeURIComponent(mandalName)}`
      )
      if (!response.ok) throw new Error("Failed to fetch secretariats")

      const data = await response.json()
      const duration = Date.now() - startTime
      console.log(`Secretariats for ${mandalName} loaded in ${duration}ms`)

      setFilterOptions((prev) => ({ ...prev, secretariats: data.secretariats }))
    } catch (error) {
      console.error("Error fetching secretariats:", error)
      toast.error("Failed to load secretariats")
    }
  }

  const fetchPhcsBySecretariat = async (secName: string) => {
    try {
      const startTime = Date.now()
      const response = await fetch(
        `/api/admin/filter-options?secName=${encodeURIComponent(secName)}`
      )
      if (!response.ok) throw new Error("Failed to fetch PHCs")

      const data = await response.json()
      const duration = Date.now() - startTime
      console.log(`PHCs for ${secName} loaded in ${duration}ms`)

      setFilterOptions((prev) => ({ ...prev, phcs: data.phcs }))
    } catch (error) {
      console.error("Error fetching PHCs:", error)
      toast.error("Failed to load PHCs")
    }
  }

  const fetchRecordCount = async () => {
    try {
      setIsLoadingCount(true)
      const params = new URLSearchParams()
      if (selectedMandal !== "all") params.append("mandalName", selectedMandal)
      if (selectedSecretariat !== "all") params.append("secName", selectedSecretariat)
      if (selectedPhc !== "all") params.append("phcName", selectedPhc)

      const response = await fetch(`/api/admin/export/count?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch record count")

      const data = await response.json()
      setRecordCount(data.count)
    } catch (error) {
      console.error("Error fetching record count:", error)
      setRecordCount(null)
    } finally {
      setIsLoadingCount(false)
    }
  }

  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true)
      toast.info("Generating CSV export...")

      const params = new URLSearchParams()
      if (selectedMandal !== "all") params.append("mandalName", selectedMandal)
      if (selectedSecretariat !== "all") params.append("secName", selectedSecretariat)
      if (selectedPhc !== "all") params.append("phcName", selectedPhc)

      const response = await fetch(`/api/admin/export/residents-csv?${params.toString()}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to export data")
      }

      // Get the CSV content
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch
        ? filenameMatch[1]
        : `residents_export_${new Date().toISOString().slice(0, 10)}.csv`

      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`Successfully exported ${recordCount} records to CSV!`)
    } catch (error) {
      console.error("CSV export error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to export CSV")
    } finally {
      setIsExportingCsv(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true)
      toast.info("Generating Excel export...")

      const params = new URLSearchParams()
      if (selectedMandal !== "all") params.append("mandalName", selectedMandal)
      if (selectedSecretariat !== "all") params.append("secName", selectedSecretariat)
      if (selectedPhc !== "all") params.append("phcName", selectedPhc)

      const response = await fetch(`/api/admin/export/residents-excel?${params.toString()}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to export data")
      }

      // Get the Excel content
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch
        ? filenameMatch[1]
        : `residents_export_${new Date().toISOString().slice(0, 10)}.xlsx`

      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`Successfully exported ${recordCount} records to Excel!`)
    } catch (error) {
      console.error("Excel export error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to export Excel")
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <DashboardLayout requiredRole="ADMIN">
      <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Data Export</h1>
        <p className="text-gray-600 mt-2">
          Export resident data to CSV format with optional filters
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-orange-600" />
                Export Residents Data
              </CardTitle>
              <CardDescription className="mt-2">
                Select filters to export specific data or leave all filters as &quot;All&quot; to export complete dataset
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshFilters}
              disabled={isLoadingFilters}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingFilters ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mandal Filter */}
            <div className="space-y-2">
              <Label htmlFor="mandal">Mandal</Label>
              <Select
                value={selectedMandal}
                onValueChange={setSelectedMandal}
                disabled={isLoadingFilters}
              >
                <SelectTrigger id="mandal">
                  <SelectValue placeholder="Select Mandal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mandals</SelectItem>
                  {filterOptions.mandals.map((mandal) => (
                    <SelectItem key={mandal} value={mandal}>
                      {mandal}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secretariat Filter */}
            <div className="space-y-2">
              <Label htmlFor="secretariat">Secretariat</Label>
              <Select
                value={selectedSecretariat}
                onValueChange={setSelectedSecretariat}
                disabled={isLoadingFilters}
              >
                <SelectTrigger id="secretariat">
                  <SelectValue placeholder="Select Secretariat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Secretariats</SelectItem>
                  {filterOptions.secretariats.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PHC Filter */}
            <div className="space-y-2">
              <Label htmlFor="phc">PHC</Label>
              <Select
                value={selectedPhc}
                onValueChange={setSelectedPhc}
                disabled={isLoadingFilters}
              >
                <SelectTrigger id="phc">
                  <SelectValue placeholder="Select PHC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PHCs</SelectItem>
                  {filterOptions.phcs.map((phc) => (
                    <SelectItem key={phc} value={phc}>
                      {phc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Record Count Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              {isLoadingCount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-800">Calculating record count...</span>
                </>
              ) : recordCount !== null ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800 font-medium">
                    {recordCount.toLocaleString()} record{recordCount !== 1 ? "s" : ""} will be
                    exported
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">Unable to calculate record count</span>
                </>
              )}
            </div>
          </div>

          {/* Export Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm text-gray-900">Export Details:</h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Formats: CSV (Comma-Separated Values) or Excel (.xlsx)</li>
              <li>Encoding: UTF-8</li>
              <li>UID: Full Aadhaar number (unmasked) - Admin only</li>
              <li>
                All 31 columns: ID, Resident ID, UID, Household ID, Name, DOB, Age, Gender, Mobile,
                ABHA ID, Location, Demographic, Socio-Economic, Addresses, Timestamps
              </li>
              <li>File name: residents_export_YYYY-MM-DD_HH-mm-ss.csv or .xlsx</li>
            </ul>
          </div>

          {/* Export Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleExportCsv}
              disabled={isExportingCsv || isExportingExcel || recordCount === 0 || recordCount === null}
              className="bg-orange-600 hover:bg-orange-700"
              size="lg"
            >
              {isExportingCsv ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating CSV...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export to CSV
                </>
              )}
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={isExportingCsv || isExportingExcel || recordCount === 0 || recordCount === null}
              className="bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isExportingExcel ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Excel...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export to Excel
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  )
}
