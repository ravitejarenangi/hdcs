"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResidentsTable } from "@/components/tables/ResidentsTable"
import { Search, Filter, Loader2, AlertCircle, Users, ChevronLeft, ChevronRight, X, CheckCircle2, Phone, CreditCard } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface Resident {
  id: string
  residentId: string
  uid: string | null
  hhId: string
  name: string
  dob: Date | null
  gender: string | null
  citizenMobile: string | null
  healthId: string | null
  distName: string | null
  mandalName: string | null
  secName: string | null
  ruralUrban: string | null
  age: number | null
  phcName: string | null
  doorNumber: string | null
  addressEkyc: string | null
  addressHh: string | null
}

interface UIDSearchResult {
  searchedResident: Resident
  householdMembers: Resident[]
  householdId: string
  totalMembers: number
}

interface AdvancedSearchResult {
  residents: Resident[]
  totalResidents: number
  pagination: {
    currentPage: number
    totalPages: number
    pageSize: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  filters: {
    mandal: string | null
    secretariat: string | null
    phc: string | null
  }
}

interface AssignedSecretariat {
  mandalName: string
  secName: string
}

interface LocationOption {
  name: string
  residentCount?: number
}

interface SecretariatStats {
  total: number
  mobilePending: number
  mobileUpdated: number
  healthIdPending: number
  healthIdUpdated: number
}

export default function FieldOfficerDashboard() {
  // Removed unused session variable

  // UID Search State
  const [searchUid, setSearchUid] = useState("")
  const [uidSearchResult, setUidSearchResult] = useState<UIDSearchResult | null>(null)
  const [isUidSearching, setIsUidSearching] = useState(false)
  const [uidError, setUidError] = useState("")

  // Advanced Search State
  const [selectedMandal, setSelectedMandal] = useState("")
  const [selectedSecretariat, setSelectedSecretariat] = useState("")
  const [selectedPhc, setSelectedPhc] = useState("")
  const [advancedSearchResult, setAdvancedSearchResult] = useState<AdvancedSearchResult | null>(null)
  const [isAdvancedSearching, setIsAdvancedSearching] = useState(false)
  const [advancedError, setAdvancedError] = useState("")

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Table Search State (for client-side filtering of results)
  const [tableSearchTerm] = useState("")

  // Real-time Text Search State (searches entire database)
  const [textSearchQuery, setTextSearchQuery] = useState("")
  const [textSearchResult, setTextSearchResult] = useState<AdvancedSearchResult | null>(null)
  const [isTextSearching, setIsTextSearching] = useState(false)
  const [textSearchError, setTextSearchError] = useState("")
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Location Options State
  const [mandals, setMandals] = useState<LocationOption[]>([])
  const [secretariats, setSecretariats] = useState<LocationOption[]>([])
  const [phcs, setPhcs] = useState<LocationOption[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)

  // Assigned Secretariats State (for Field Officers)
  const [assignedSecretariats, setAssignedSecretariats] = useState<AssignedSecretariat[]>([])
  const [, setIsLoadingAssignments] = useState(false)

  // Secretariat Statistics State
  const [secretariatStats, setSecretariatStats] = useState<SecretariatStats | null>(null)

  // Active Tab
  const [activeTab, setActiveTab] = useState("uid")

  // Load assigned secretariats and secretariat stats for Field Officer on component mount
  useEffect(() => {
    loadAssignedSecretariats()
    loadSecretariatStats()
  }, [])

  // Auto-select mandal and secretariat for Field Officers
  useEffect(() => {
    if (assignedSecretariats.length > 0) {
      // Get unique mandals from assigned secretariats
      const uniqueMandals = [...new Set(assignedSecretariats.map((s) => s.mandalName))]

      // If only one mandal, auto-select it
      if (uniqueMandals.length === 1 && !selectedMandal) {
        setSelectedMandal(uniqueMandals[0])
      }
    }
  }, [assignedSecretariats, selectedMandal])

  // Load secretariats when mandal changes
  useEffect(() => {
    if (selectedMandal) {
      loadSecretariats(selectedMandal)
      setSelectedSecretariat("")
      setSelectedPhc("")
    } else {
      setSecretariats([])
      setPhcs([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMandal])

  // Auto-select secretariat if only one is assigned for the selected mandal
  useEffect(() => {
    if (selectedMandal && secretariats.length > 0 && !selectedSecretariat) {
      // Get assigned secretariats for the selected mandal
      const assignedForMandal = assignedSecretariats.filter(
        (s) => s.mandalName === selectedMandal
      )

      // If only one secretariat is assigned for this mandal, auto-select it
      if (assignedForMandal.length === 1) {
        setSelectedSecretariat(assignedForMandal[0].secName)
      }
    }
  }, [secretariats, selectedMandal, assignedSecretariats, selectedSecretariat])

  // Load PHCs when secretariat changes
  useEffect(() => {
    if (selectedSecretariat) {
      loadPhcs(selectedMandal, selectedSecretariat)
      setSelectedPhc("")
    } else {
      setPhcs([])
    }
  }, [selectedSecretariat, selectedMandal])

  const loadAssignedSecretariats = async () => {
    setIsLoadingAssignments(true)
    try {
      const response = await fetch("/api/field-officer/assigned-secretariats")
      const data = await response.json()

      if (response.ok) {
        // Ensure secretariats is an array of objects with mandalName and secName
        const secretariats = Array.isArray(data.secretariats) ? data.secretariats : []

        // Validate format
        const validSecretariats = secretariats.filter(
          (s: unknown): s is AssignedSecretariat =>
            typeof s === 'object' &&
            s !== null &&
            'mandalName' in s &&
            'secName' in s &&
            typeof (s as AssignedSecretariat).mandalName === 'string' &&
            typeof (s as AssignedSecretariat).secName === 'string'
        )

        setAssignedSecretariats(validSecretariats)

        // Set mandals based on assigned secretariats
        const uniqueMandals = data.uniqueMandals || []
        setMandals(uniqueMandals.map((m: string) => ({ name: m })))
      } else {
        // Clear assignments on error
        setAssignedSecretariats([])
        toast.error("Failed to load assigned secretariats", {
          description: typeof data.error === 'string' ? data.error : "Please contact your administrator",
        })
      }
    } catch {
      // Clear assignments on error
      setAssignedSecretariats([])
      toast.error("Network error", {
        description: "Failed to load assigned secretariats",
      })
    } finally {
      setIsLoadingAssignments(false)
    }
  }

  // Load secretariat-wide statistics
  const loadSecretariatStats = async () => {
    try {
      const response = await fetch("/api/field-officer/secretariat-stats")
      const data = await response.json()

      if (response.ok) {
        setSecretariatStats(data.stats)
      } else {
        console.error("Failed to load secretariat stats:", data.error)
        // Don't show error toast - stats are optional
      }
    } catch (error) {
      console.error("Network error loading secretariat stats:", error)
      // Don't show error toast - stats are optional
    }
  }

  // Removed unused loadMandals function

  const loadSecretariats = async (mandal: string) => {
    setIsLoadingLocations(true)
    try {
      const response = await fetch(`/api/locations/secretariats?mandal=${encodeURIComponent(mandal)}`)
      const data = await response.json()
      if (response.ok) {
        // Filter secretariats based on assigned secretariats for Field Officers
        let filteredSecretariats = data.secretariats

        if (assignedSecretariats.length > 0) {
          const assignedSecNames = assignedSecretariats
            .filter((s) => s.mandalName === mandal)
            .map((s) => s.secName)

          filteredSecretariats = data.secretariats.filter((sec: LocationOption) =>
            assignedSecNames.includes(sec.name)
          )
        }

        setSecretariats(filteredSecretariats)
      } else {
        toast.error("Failed to load secretariats", {
          description: data.error || "Please try again",
        })
      }
    } catch {
      toast.error("Network error", {
        description: "Failed to load secretariats",
      })
    } finally {
      setIsLoadingLocations(false)
    }
  }

  const loadPhcs = async (mandal: string, secretariat: string) => {
    setIsLoadingLocations(true)
    try {
      const response = await fetch(
        `/api/locations/phcs?mandal=${encodeURIComponent(mandal)}&secretariat=${encodeURIComponent(secretariat)}`
      )
      const data = await response.json()
      if (response.ok) {
        setPhcs(data.phcs)
      } else {
        toast.error("Failed to load PHCs", {
          description: data.error || "Please try again",
        })
      }
    } catch {
      toast.error("Network error", {
        description: "Failed to load PHCs",
      })
    } finally {
      setIsLoadingLocations(false)
    }
  }

  const handleUidSearch = async () => {
    if (!searchUid.trim()) {
      setUidError("Please enter a UID (Aadhaar number)")
      toast.error("Validation Error", {
        description: "Please enter a UID to search",
      })
      return
    }

    // Validate UID format (12 digits)
    if (!/^\d{12}$/.test(searchUid.trim())) {
      setUidError("UID must be exactly 12 digits")
      toast.error("Invalid UID Format", {
        description: "UID (Aadhaar) must be exactly 12 digits",
      })
      return
    }

    setIsUidSearching(true)
    setUidError("")

    try {
      const response = await fetch(`/api/residents/search?uid=${searchUid.trim()}&mode=uid`)
      const data = await response.json()

      if (!response.ok) {
        setUidError(data.error || "Search failed")
        setUidSearchResult(null)
        toast.error("Search Failed", {
          description: data.error || "Resident not found",
        })
      } else {
        setUidSearchResult(data)
        toast.success("Resident Found!", {
          description: `Found ${data.totalMembers} member(s) in household ${data.householdId}`,
        })
      }
    } catch {
      setUidError("Network error. Please try again.")
      setUidSearchResult(null)
      toast.error("Network Error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsUidSearching(false)
    }
  }

  const handleAdvancedSearch = async (page = 1) => {
    if (!selectedMandal && !selectedSecretariat && !selectedPhc) {
      setAdvancedError("Please select at least one filter")
      toast.error("Validation Error", {
        description: "Please select at least one filter to search",
      })
      return
    }

    setIsAdvancedSearching(true)
    setAdvancedError("")

    try {
      const params = new URLSearchParams({ mode: "advanced" })
      if (selectedMandal) params.append("mandal", selectedMandal)
      if (selectedSecretariat) params.append("secretariat", selectedSecretariat)
      if (selectedPhc) params.append("phc", selectedPhc)
      params.append("page", page.toString())
      params.append("limit", pageSize.toString())

      const response = await fetch(`/api/residents/search?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        setAdvancedError(data.error || "Search failed")
        setAdvancedSearchResult(null)
        toast.error("Search Failed", {
          description: data.error || "No residents found",
        })
      } else {
        setAdvancedSearchResult(data)
        setCurrentPage(page)
        toast.success("Search Complete!", {
          description: `Found ${data.totalResidents} resident(s)`,
        })
      }
    } catch {
      setAdvancedError("Network error. Please try again.")
      setAdvancedSearchResult(null)
      toast.error("Network Error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsAdvancedSearching(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    handleAdvancedSearch(newPage)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)

    // If text search is active, re-run text search with new page size
    if (textSearchQuery && textSearchQuery.trim().length >= 2) {
      performTextSearch(textSearchQuery, 1)
    } else {
      handleAdvancedSearch(1)
    }
  }

  const handleUidUpdateSuccess = () => {
    if (searchUid) {
      handleUidSearch()
    }
    // Reload secretariat stats after update
    loadSecretariatStats()
  }

  const handleAdvancedUpdateSuccess = () => {
    handleAdvancedSearch()
    // Reload secretariat stats after update
    loadSecretariatStats()
  }

  // Real-time text search with debouncing
  // If Advanced Filter is active, search is scoped to those filters (mandal, secretariat, PHC)
  // Otherwise, search the entire database (with role-based access control)
  const performTextSearch = useCallback(async (searchQuery: string, page = 1) => {
    if (!searchQuery || searchQuery.trim().length < 4) {
      setTextSearchResult(null)
      setTextSearchError("")
      return
    }

    setIsTextSearching(true)
    setTextSearchError("")

    try {
      const params = new URLSearchParams({
        mode: "text",
        q: searchQuery.trim(),
        page: page.toString(),
        limit: pageSize.toString(),
      })

      // If Advanced Filter is active, add location filters to scope the search
      // This ensures we search within the filtered subset (e.g., 2631 residents)
      // instead of searching the entire database
      if (advancedSearchResult) {
        if (selectedMandal) {
          params.append("mandal", selectedMandal)
        }
        if (selectedSecretariat) {
          params.append("secretariat", selectedSecretariat)
        }
        if (selectedPhc) {
          params.append("phc", selectedPhc)
        }
      }

      const response = await fetch(`/api/residents/search?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        setTextSearchError(data.error || "Search failed")
        setTextSearchResult(null)
        if (data.error !== "No residents found matching your search") {
          toast.error("Search Failed", {
            description: data.error || "No residents found",
          })
        }
      } else {
        setTextSearchResult(data)
        setCurrentPage(page)
      }
    } catch {
      setTextSearchError("Network error. Please try again.")
      setTextSearchResult(null)
      toast.error("Network Error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsTextSearching(false)
    }
  }, [pageSize, advancedSearchResult, selectedMandal, selectedSecretariat, selectedPhc])

  // Debounced text search effect
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // If search query is empty or less than 4 characters, clear results
    if (!textSearchQuery || textSearchQuery.trim().length < 4) {
      setTextSearchResult(null)
      setTextSearchError("")
      return
    }

    // Set a new timeout for debounced search (1500ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      performTextSearch(textSearchQuery, 1)
    }, 1500)

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [textSearchQuery, performTextSearch])

  // Filter residents based on table search term (client-side filtering)
  const filterResidents = (residents: Resident[]): Resident[] => {
    if (!tableSearchTerm.trim()) {
      return residents
    }

    const searchLower = tableSearchTerm.toLowerCase().trim()

    return residents.filter((resident) => {
      // Search across multiple fields
      const searchableFields = [
        resident.name,
        resident.uid,
        resident.hhId,
        resident.residentId,
        resident.citizenMobile,
        resident.healthId,
        resident.gender,
        resident.age?.toString(),
        resident.mandalName,
        resident.secName,
        resident.phcName,
      ]

      return searchableFields.some((field) =>
        field?.toLowerCase().includes(searchLower)
      )
    })
  }

  // Get filtered residents for display
  const getFilteredResidents = (): Resident[] => {
    // If text search is active (user is typing in search box)
    if (textSearchQuery && textSearchQuery.trim().length >= 4) {
      // If we have text search results, use those
      if (textSearchResult) {
        return textSearchResult.residents
      }
      // If text search returned no results (404), return empty array
      return []
    }

    // Otherwise use advanced search results with client-side filtering
    if (!advancedSearchResult) return []
    return filterResidents(advancedSearchResult.residents)
  }

  // Get the current search result for pagination and counts
  const getCurrentSearchResult = (): AdvancedSearchResult | null => {
    // If text search is active and has results, use those
    if (textSearchQuery && textSearchQuery.trim().length >= 4 && textSearchResult) {
      return textSearchResult
    }
    // If text search is active but no results, return null (will show "no results")
    if (textSearchQuery && textSearchQuery.trim().length >= 4 && !textSearchResult && !isTextSearching) {
      return null
    }
    // Otherwise use advanced search results
    return advancedSearchResult
  }

  const clearUidSearch = () => {
    setSearchUid("")
    setUidSearchResult(null)
    setUidError("")
  }

  const clearAdvancedSearch = () => {
    setSelectedMandal("")
    setSelectedSecretariat("")
    setSelectedPhc("")
    setAdvancedSearchResult(null)
    setAdvancedError("")
    setTextSearchQuery("") // Also clear text search
    setTextSearchResult(null)
    setTextSearchError("")
  }

  return (
    <DashboardLayout requiredRole="FIELD_OFFICER">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Field Officer Dashboard</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              Search and update resident information
            </p>
          </div>
        </div>

        {/* Tabs for Search Methods */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-full md:max-w-md">
            <TabsTrigger value="uid" className="flex items-center gap-1 md:gap-2 text-sm md:text-base">
              <Search className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">UID Search</span>
              <span className="sm:hidden">UID</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1 md:gap-2 text-sm md:text-base">
              <Filter className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Advanced Filter</span>
              <span className="sm:hidden">Filter</span>
            </TabsTrigger>
          </TabsList>

          {/* UID Search Tab */}
          <TabsContent value="uid" className="space-y-4 md:space-y-6">
            {/* Search Section */}
            <Card className="border-2 border-orange-200 shadow-lg">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Search className="h-5 w-5 md:h-6 md:w-6 text-orange-600" />
                  Search Resident by UID
                </CardTitle>
                <CardDescription className="text-sm">
                  Enter the 12-digit Aadhaar number (UID) to search for a resident and their household members
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="uid-search" className="text-sm md:text-base">UID (Aadhaar Number)</Label>
                      <Input
                        id="uid-search"
                        placeholder="Enter 12-digit UID"
                        value={searchUid}
                        onChange={(e) => {
                          setSearchUid(e.target.value)
                          setUidError("")
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUidSearch()
                          }
                        }}
                        className="text-base md:text-lg h-11 md:h-auto"
                        maxLength={12}
                        disabled={isUidSearching}
                      />
                    </div>
                    <div className="flex md:items-end gap-2 w-full md:w-auto">
                      <Button
                        onClick={handleUidSearch}
                        disabled={isUidSearching}
                        className="bg-orange-600 hover:bg-orange-700 flex-1 md:flex-none h-11 md:h-11 md:px-6"
                        size="lg"
                      >
                        {isUidSearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                            <span className="hidden sm:inline text-base">Searching...</span>
                            <span className="sm:hidden">Search...</span>
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                            <span className="text-base">Search</span>
                          </>
                        )}
                      </Button>
                      {uidSearchResult && (
                        <Button
                          onClick={clearUidSearch}
                          variant="outline"
                          size="lg"
                          className="h-11 md:h-11 md:px-6"
                        >
                          <span className="text-base">Clear</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {uidError && (
                    <div className="flex items-center gap-2 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm md:text-base">
                      <AlertCircle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                      <span>{uidError}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* UID Search Results */}
            {uidSearchResult && (
              <Card className="border-2 border-green-200 shadow-lg">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Users className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                    Household Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <ResidentsTable
                    residents={uidSearchResult.householdMembers}
                    searchedResidentId={uidSearchResult.searchedResident.residentId}
                    householdId={uidSearchResult.householdId}
                    onUpdateSuccess={handleUidUpdateSuccess}
                  />
                </CardContent>
              </Card>
            )}

            {/* Empty State for UID Search */}
            {!uidSearchResult && !uidError && (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-8 md:py-12 px-4 text-center">
                  <Search className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mb-3 md:mb-4" />
                  <h3 className="text-base md:text-lg font-semibold text-gray-700 mb-2">
                    No Search Results
                  </h3>
                  <p className="text-sm md:text-base text-gray-500 max-w-md">
                    Enter a UID (Aadhaar number) in the search box above to find residents and update their information.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Advanced Filter Tab */}
          <TabsContent value="advanced" className="space-y-4 md:space-y-6">
            {/* Filter Section */}
            <Card className="border-2 border-green-200 shadow-lg">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Filter className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                  Advanced Filter Search
                </CardTitle>
                <CardDescription className="text-sm">
                  Use location filters to search residents (Mandal → Secretariat → PHC)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-6">
                  {/* Location Filters Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Mandal Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="mandal-filter" className="text-sm md:text-base">
                        Mandal
                        {assignedSecretariats.length > 0 && (
                          <span className="ml-2 text-xs text-gray-500">(Assigned)</span>
                        )}
                      </Label>
                      <Select
                        value={selectedMandal}
                        onValueChange={setSelectedMandal}
                        disabled={
                          isLoadingLocations ||
                          isAdvancedSearching ||
                          assignedSecretariats.length > 0
                        }
                      >
                        <SelectTrigger
                          id="mandal-filter"
                          className={`h-11 md:h-auto ${
                            assignedSecretariats.length > 0
                              ? "bg-gray-100 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <SelectValue placeholder="Select Mandal" />
                        </SelectTrigger>
                        <SelectContent>
                          {mandals.map((mandal) => (
                            <SelectItem key={mandal.name} value={mandal.name}>
                              {mandal.name}
                              {mandal.residentCount && ` (${mandal.residentCount} residents)`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assignedSecretariats.length > 0 && (
                        <p className="text-xs text-blue-600">
                          This is your assigned mandal and cannot be changed
                        </p>
                      )}
                    </div>

                    {/* Secretariat Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="secretariat-filter" className="text-sm md:text-base">
                        Secretariat
                        {assignedSecretariats.length > 0 && (
                          <span className="ml-2 text-xs text-gray-500">(Assigned)</span>
                        )}
                      </Label>
                      <Select
                        value={selectedSecretariat}
                        onValueChange={setSelectedSecretariat}
                        disabled={
                          !selectedMandal ||
                          isLoadingLocations ||
                          isAdvancedSearching ||
                          (assignedSecretariats.length > 0 && secretariats.length === 1)
                        }
                      >
                        <SelectTrigger
                          id="secretariat-filter"
                          className={`h-11 md:h-auto ${
                            assignedSecretariats.length > 0 && secretariats.length === 1
                              ? "bg-gray-100 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <SelectValue placeholder="Select Secretariat" />
                        </SelectTrigger>
                        <SelectContent>
                          {secretariats.map((sec) => (
                            <SelectItem key={sec.name} value={sec.name}>
                              {sec.name}
                              {sec.residentCount && ` (${sec.residentCount} residents)`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedMandal && assignedSecretariats.length === 0 && (
                        <p className="text-xs text-gray-500">Select a mandal first</p>
                      )}
                      {assignedSecretariats.length > 0 && secretariats.length > 0 && (
                        <p className="text-xs text-blue-600">
                          {secretariats.length === 1
                            ? "This is your assigned secretariat"
                            : `You can select from ${secretariats.length} assigned secretariats`}
                        </p>
                      )}
                    </div>

                    {/* PHC Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="phc-filter" className="text-sm md:text-base">PHC (Primary Health Center)</Label>
                      <Select
                        value={selectedPhc}
                        onValueChange={setSelectedPhc}
                        disabled={!selectedSecretariat || isLoadingLocations || isAdvancedSearching}
                      >
                        <SelectTrigger id="phc-filter" className="h-11 md:h-auto">
                          <SelectValue placeholder="Select PHC" />
                        </SelectTrigger>
                        <SelectContent>
                          {phcs.map((phc) => (
                            <SelectItem key={phc.name} value={phc.name}>
                              {phc.name} ({phc.residentCount} residents)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedSecretariat && (
                        <p className="text-xs text-gray-500">Select a secretariat first</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => handleAdvancedSearch()}
                      disabled={isAdvancedSearching || (!selectedMandal && !selectedSecretariat && !selectedPhc)}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto h-11 md:h-11 md:px-6"
                      size="lg"
                    >
                      {isAdvancedSearching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                          <span className="hidden sm:inline text-base">Searching...</span>
                          <span className="sm:hidden">Search...</span>
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                          <span className="text-base">Search Residents</span>
                        </>
                      )}
                    </Button>
                    {advancedSearchResult && (
                      <Button
                        onClick={clearAdvancedSearch}
                        variant="outline"
                        size="lg"
                        className="w-full sm:w-auto h-11 md:h-11 md:px-6"
                      >
                        <span className="text-base">Clear Filters</span>
                      </Button>
                    )}
                  </div>

                  {advancedError && (
                    <div className="flex items-center gap-2 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm md:text-base">
                      <AlertCircle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                      <span>{advancedError}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Advanced Search Results */}
            {advancedSearchResult && (
              <Card className="border-2 border-orange-200 shadow-lg">
                <CardHeader className="p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                        <Users className="h-5 w-5 md:h-6 md:w-6 text-orange-600" />
                        Search Results
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <div className="space-y-1 text-xs md:text-sm">
                          {advancedSearchResult.filters.mandal && (
                            <div>
                              <strong>Mandal:</strong> {advancedSearchResult.filters.mandal}
                            </div>
                          )}
                          {advancedSearchResult.filters.secretariat && (
                            <div>
                              <strong>Secretariat:</strong> {advancedSearchResult.filters.secretariat}
                            </div>
                          )}
                          {advancedSearchResult.filters.phc && (
                            <div>
                              <strong>PHC:</strong> {advancedSearchResult.filters.phc}
                            </div>
                          )}
                        </div>
                      </CardDescription>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-xl md:text-2xl font-bold text-orange-600">
                        {advancedSearchResult.totalResidents}
                      </div>
                      <div className="text-xs md:text-sm text-gray-600">
                        {advancedSearchResult.totalResidents === 1 ? "Resident" : "Residents"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 md:p-6">
                  {/* Secretariat Statistics - Hidden on mobile */}
                  {secretariatStats && (
                    <div className="hidden md:block mb-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-700">
                          Secretariat Overview
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          All Residents
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Residents */}
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">Total Residents</p>
                                <p className="text-3xl font-bold text-gray-900">{secretariatStats.total}</p>
                              </div>
                              <Users className="h-10 w-10 text-blue-600 opacity-75" />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Mobile Numbers Updated */}
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">Mobile Updated</p>
                                <p className="text-3xl font-bold text-green-600">{secretariatStats.mobileUpdated}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {secretariatStats.total > 0 ? Math.round((secretariatStats.mobileUpdated / secretariatStats.total) * 100) : 0}% complete
                                </p>
                              </div>
                              <CheckCircle2 className="h-10 w-10 text-green-600 opacity-75" />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              {secretariatStats.mobileUpdated}/{secretariatStats.total}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Mobile Numbers Pending */}
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">Mobile Pending</p>
                                <p className="text-3xl font-bold text-orange-600">{secretariatStats.mobilePending}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {secretariatStats.total > 0 ? Math.round((secretariatStats.mobilePending / secretariatStats.total) * 100) : 0}% pending
                                </p>
                              </div>
                              <Phone className="h-10 w-10 text-orange-600 opacity-75" />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              {secretariatStats.mobilePending}/{secretariatStats.total}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Health IDs Updated */}
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">Health ID Updated</p>
                                <p className="text-3xl font-bold text-purple-600">{secretariatStats.healthIdUpdated}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {secretariatStats.total > 0 ? Math.round((secretariatStats.healthIdUpdated / secretariatStats.total) * 100) : 0}% complete
                                </p>
                              </div>
                              <CreditCard className="h-10 w-10 text-purple-600 opacity-75" />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              {secretariatStats.healthIdUpdated}/{secretariatStats.total}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Search and Page Size Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                    {/* Real-time Search Input */}
                    <div className="flex-1 w-full sm:max-w-md">
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder={
                              advancedSearchResult
                                ? "Search within filtered results..."
                                : "Search by name, UID, phone..."
                            }
                            value={textSearchQuery}
                            onChange={(e) => setTextSearchQuery(e.target.value)}
                            className="pl-10 pr-10 h-11 md:h-auto text-sm md:text-base"
                            disabled={isTextSearching}
                          />
                          {isTextSearching && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-orange-600" />
                          )}
                          {textSearchQuery && !isTextSearching && (
                            <button
                              onClick={() => setTextSearchQuery("")}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 w-11 h-11 flex items-center justify-center"
                              aria-label="Clear search"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {textSearchError && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {textSearchError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2 justify-end sm:justify-start">
                      <Label htmlFor="page-size" className="text-xs md:text-sm whitespace-nowrap">
                        Show:
                      </Label>
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => handlePageSizeChange(parseInt(value))}
                      >
                        <SelectTrigger id="page-size" className="w-20 md:w-24 h-11 md:h-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">per page</span>
                    </div>
                  </div>

                  {/* Result Count */}
                  <div className="text-xs md:text-sm text-gray-600">
                    {(() => {
                      const isTextSearch = textSearchQuery && textSearchQuery.trim().length >= 4

                      // If text search is active
                      if (isTextSearch) {
                        if (isTextSearching) {
                          const scope = advancedSearchResult ? " within filtered results" : ""
                          return `Searching${scope} for "${textSearchQuery}"...`
                        }
                        if (textSearchResult) {
                          const scope = advancedSearchResult ? " (within filtered results)" : ""
                          return `Found ${textSearchResult.totalResidents} resident(s) matching "${textSearchQuery}"${scope}`
                        }
                        // No results found
                        const scope = advancedSearchResult ? " within filtered results" : ""
                        return `No residents found${scope} matching "${textSearchQuery}"`
                      }

                      // Advanced search results
                      const currentResult = getCurrentSearchResult()
                      if (!currentResult) return "No results"

                      const filteredResidents = getFilteredResidents()
                      const totalOnPage = filteredResidents.length
                      const totalAll = currentResult.totalResidents

                      if (tableSearchTerm) {
                        return `Showing ${totalOnPage} of ${totalAll} residents (filtered)`
                      }
                      return `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalAll)} of ${totalAll} results`
                    })()}
                  </div>

                  {/* Results Table */}
                  {(() => {
                    const filteredResidents = getFilteredResidents()
                    const isTextSearch = textSearchQuery && textSearchQuery.trim().length >= 4

                    if (isTextSearching) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Loader2 className="h-12 w-12 mx-auto mb-3 text-orange-600 animate-spin" />
                          <p className="font-medium">Searching...</p>
                          <p className="text-sm">
                            {advancedSearchResult
                              ? "Searching within filtered results"
                              : "Please wait"}
                          </p>
                        </div>
                      )
                    }

                    if (filteredResidents.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Search className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                          <p className="font-medium">No residents found</p>
                          <p className="text-sm">
                            {isTextSearch
                              ? (advancedSearchResult
                                  ? `No results matching "${textSearchQuery}" within the filtered ${advancedSearchResult.totalResidents} residents. Try a different search term.`
                                  : `No results matching "${textSearchQuery}". Try a different search term.`)
                              : "Try adjusting your search filters"}
                          </p>
                        </div>
                      )
                    }

                    return (
                      <ResidentsTable
                        residents={filteredResidents}
                        onUpdateSuccess={handleAdvancedUpdateSuccess}
                      />
                    )
                  })()}

                  {/* Pagination Controls */}
                  {(() => {
                    const currentResult = getCurrentSearchResult()
                    if (!currentResult || currentResult.pagination.totalPages <= 1) return null

                    const isTextSearch = textSearchQuery && textSearchQuery.trim().length >= 2
                    const isSearching = isTextSearch ? isTextSearching : isAdvancedSearching

                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                        <div className="text-xs md:text-sm text-gray-600 order-2 sm:order-1">
                          Page {currentResult.pagination.currentPage} of{" "}
                          {currentResult.pagination.totalPages}
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (isTextSearch) {
                                performTextSearch(textSearchQuery, currentPage - 1)
                              } else {
                                handlePageChange(currentPage - 1)
                              }
                            }}
                            disabled={
                              !currentResult.pagination.hasPreviousPage ||
                              isSearching
                            }
                            className="h-11 md:h-auto px-2 md:px-4"
                          >
                            <ChevronLeft className="h-4 w-4 md:mr-1" />
                            <span className="hidden md:inline">Previous</span>
                          </Button>

                          {/* Page Numbers */}
                          <div className="hidden sm:flex items-center gap-1">
                            {Array.from(
                              { length: currentResult.pagination.totalPages },
                              (_, i) => i + 1
                            )
                              .filter((page) => {
                                // Show first page, last page, current page, and pages around current
                                const current = currentResult.pagination.currentPage
                                return (
                                  page === 1 ||
                                  page === currentResult.pagination.totalPages ||
                                  (page >= current - 1 && page <= current + 1)
                                )
                              })
                              .map((page, index, array) => {
                              // Add ellipsis if there's a gap
                              const prevPage = array[index - 1]
                              const showEllipsis = prevPage && page - prevPage > 1

                              return (
                                <div key={page} className="flex items-center gap-1">
                                  {showEllipsis && (
                                    <span className="px-1 md:px-2 text-gray-400 text-sm">...</span>
                                  )}
                                  <Button
                                    variant={
                                      page === currentResult.pagination.currentPage
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => {
                                      if (isTextSearch) {
                                        performTextSearch(textSearchQuery, page)
                                      } else {
                                        handlePageChange(page)
                                      }
                                    }}
                                    disabled={isSearching}
                                    className="min-w-[2rem] md:min-w-[2.5rem] h-11 md:h-auto"
                                  >
                                    {page}
                                  </Button>
                                </div>
                              )
                            })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (isTextSearch) {
                              performTextSearch(textSearchQuery, currentPage + 1)
                            } else {
                              handlePageChange(currentPage + 1)
                            }
                          }}
                          disabled={
                            !currentResult.pagination.hasNextPage ||
                            isSearching
                          }
                          className="h-11 md:h-auto px-2 md:px-4"
                        >
                          <span className="hidden md:inline">Next</span>
                          <ChevronRight className="h-4 w-4 md:ml-1" />
                        </Button>
                      </div>
                    </div>
                  )})()}
                </CardContent>
              </Card>
            )}

            {/* Empty State for Advanced Search */}
            {!advancedSearchResult && !advancedError && (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-8 md:py-12 px-4 text-center">
                  <Filter className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mb-3 md:mb-4" />
                  <h3 className="text-base md:text-lg font-semibold text-gray-700 mb-2">
                    No Search Results
                  </h3>
                  <p className="text-sm md:text-base text-gray-500 max-w-md">
                    Select filters above (Mandal, Secretariat, or PHC) to search for residents in specific locations.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

