"use client"

import { useState, useEffect } from "react"
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
import { Search, Filter, Loader2, AlertCircle, Users } from "lucide-react"
import { toast } from "sonner"

interface Resident {
  id: string
  residentId: string
  uid: string | null
  hhId: string
  name: string
  dob: Date | null
  gender: string | null
  mobileNumber: string | null
  healthId: string | null
  distName: string | null
  mandalName: string | null
  secName: string | null
  ruralUrban: string | null
  age: number | null
  phcName: string | null
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
  filters: {
    mandal: string | null
    secretariat: string | null
    phc: string | null
  }
}

interface LocationOption {
  name: string
  residentCount?: number
}

export default function FieldOfficerDashboard() {
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

  // Location Options State
  const [mandals, setMandals] = useState<LocationOption[]>([])
  const [secretariats, setSecretariats] = useState<LocationOption[]>([])
  const [phcs, setPhcs] = useState<LocationOption[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState("uid")

  // Load mandals on component mount
  useEffect(() => {
    loadMandals()
  }, [])

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
  }, [selectedMandal])

  // Load PHCs when secretariat changes
  useEffect(() => {
    if (selectedSecretariat) {
      loadPhcs(selectedMandal, selectedSecretariat)
      setSelectedPhc("")
    } else {
      setPhcs([])
    }
  }, [selectedSecretariat, selectedMandal])

  const loadMandals = async () => {
    setIsLoadingLocations(true)
    try {
      const response = await fetch("/api/locations/mandals")
      const data = await response.json()
      if (response.ok) {
        setMandals(data.mandals)
      } else {
        toast.error("Failed to load mandals", {
          description: data.error || "Please try again",
        })
      }
    } catch {
      toast.error("Network error", {
        description: "Failed to load mandals",
      })
    } finally {
      setIsLoadingLocations(false)
    }
  }

  const loadSecretariats = async (mandal: string) => {
    setIsLoadingLocations(true)
    try {
      const response = await fetch(`/api/locations/secretariats?mandal=${encodeURIComponent(mandal)}`)
      const data = await response.json()
      if (response.ok) {
        setSecretariats(data.secretariats)
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

  const handleAdvancedSearch = async () => {
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

  const handleUidUpdateSuccess = () => {
    if (searchUid) {
      handleUidSearch()
    }
  }

  const handleAdvancedUpdateSuccess = () => {
    handleAdvancedSearch()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUidSearch()
    }
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
  }

  return (
    <DashboardLayout requiredRole="FIELD_OFFICER">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Field Officer Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Search and update resident information
            </p>
          </div>
        </div>

        {/* Tabs for Search Methods */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="uid" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              UID Search
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filter
            </TabsTrigger>
          </TabsList>

          {/* UID Search Tab */}
          <TabsContent value="uid" className="space-y-6">
            {/* Search Section */}
            <Card className="border-2 border-orange-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Search className="h-6 w-6 text-orange-600" />
                  Search Resident by UID
                </CardTitle>
                <CardDescription>
                  Enter the 12-digit Aadhaar number (UID) to search for a resident and their household members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="uid-search">UID (Aadhaar Number)</Label>
                      <Input
                        id="uid-search"
                        placeholder="Enter 12-digit UID (e.g., 123456789012)"
                        value={searchUid}
                        onChange={(e) => {
                          setSearchUid(e.target.value)
                          setUidError("")
                        }}
                        onKeyPress={handleKeyPress}
                        className="text-lg"
                        maxLength={12}
                        disabled={isUidSearching}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        onClick={handleUidSearch}
                        disabled={isUidSearching}
                        className="bg-orange-600 hover:bg-orange-700"
                        size="lg"
                      >
                        {isUidSearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Search
                          </>
                        )}
                      </Button>
                      {uidSearchResult && (
                        <Button
                          onClick={clearUidSearch}
                          variant="outline"
                          size="lg"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {uidError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{uidError}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* UID Search Results */}
            {uidSearchResult && (
              <Card className="border-2 border-green-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Users className="h-6 w-6 text-green-600" />
                    Household Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Search Results
                  </h3>
                  <p className="text-gray-500 max-w-md">
                    Enter a UID (Aadhaar number) in the search box above to find residents and update their information.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Advanced Filter Tab */}
          <TabsContent value="advanced" className="space-y-6">
            {/* Filter Section */}
            <Card className="border-2 border-green-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Filter className="h-6 w-6 text-green-600" />
                  Advanced Filter Search
                </CardTitle>
                <CardDescription>
                  Select filters to search for residents by location (Mandal → Secretariat → PHC)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Mandal Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="mandal-filter">Mandal</Label>
                      <Select
                        value={selectedMandal}
                        onValueChange={setSelectedMandal}
                        disabled={isLoadingLocations || isAdvancedSearching}
                      >
                        <SelectTrigger id="mandal-filter">
                          <SelectValue placeholder="Select Mandal" />
                        </SelectTrigger>
                        <SelectContent>
                          {mandals.map((mandal) => (
                            <SelectItem key={mandal.name} value={mandal.name}>
                              {mandal.name} ({mandal.residentCount} residents)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Secretariat Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="secretariat-filter">Secretariat</Label>
                      <Select
                        value={selectedSecretariat}
                        onValueChange={setSelectedSecretariat}
                        disabled={!selectedMandal || isLoadingLocations || isAdvancedSearching}
                      >
                        <SelectTrigger id="secretariat-filter">
                          <SelectValue placeholder="Select Secretariat" />
                        </SelectTrigger>
                        <SelectContent>
                          {secretariats.map((sec) => (
                            <SelectItem key={sec.name} value={sec.name}>
                              {sec.name} ({sec.residentCount} residents)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedMandal && (
                        <p className="text-xs text-gray-500">Select a mandal first</p>
                      )}
                    </div>

                    {/* PHC Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="phc-filter">PHC (Primary Health Center)</Label>
                      <Select
                        value={selectedPhc}
                        onValueChange={setSelectedPhc}
                        disabled={!selectedSecretariat || isLoadingLocations || isAdvancedSearching}
                      >
                        <SelectTrigger id="phc-filter">
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

                  <div className="flex gap-2">
                    <Button
                      onClick={handleAdvancedSearch}
                      disabled={isAdvancedSearching || (!selectedMandal && !selectedSecretariat && !selectedPhc)}
                      className="bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      {isAdvancedSearching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Search Residents
                        </>
                      )}
                    </Button>
                    {advancedSearchResult && (
                      <Button
                        onClick={clearAdvancedSearch}
                        variant="outline"
                        size="lg"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  {advancedError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{advancedError}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Advanced Search Results */}
            {advancedSearchResult && (
              <Card className="border-2 border-orange-200 shadow-lg">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Users className="h-6 w-6 text-orange-600" />
                        Search Results
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <div className="space-y-1 text-sm">
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
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">
                        {advancedSearchResult.totalResidents}
                      </div>
                      <div className="text-sm text-gray-600">
                        {advancedSearchResult.totalResidents === 1 ? "Resident" : "Residents"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResidentsTable
                    residents={advancedSearchResult.residents}
                    onUpdateSuccess={handleAdvancedUpdateSuccess}
                  />
                </CardContent>
              </Card>
            )}

            {/* Empty State for Advanced Search */}
            {!advancedSearchResult && !advancedError && (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Filter className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Search Results
                  </h3>
                  <p className="text-gray-500 max-w-md">
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

