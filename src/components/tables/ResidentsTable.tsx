"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Edit2, Save, X, User, MapPin, Users, Home, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"
import { HouseholdMembersDialog } from "@/components/dialogs/HouseholdMembersDialog"

// Helper function to mask UID (show only last 4 digits)
function maskUID(uid: string | null): string {
  if (!uid) return "Not set"
  if (uid.length <= 4) return uid
  return "*".repeat(uid.length - 4) + uid.slice(-4)
}

// Helper function to validate mobile number patterns
function isValidMobilePattern(mobile: string): boolean {
  // Check if all digits are the same (e.g., 9999999999, 8888888888)
  const allSameDigit = /^(\d)\1{9}$/.test(mobile)
  if (allSameDigit) return false

  // Check for repetitive patterns (e.g., 9999998888, 7777776666)
  const repetitivePattern = /^(\d)\1{4,}(\d)\2{3,}$/.test(mobile)
  if (repetitivePattern) return false

  // Check for simple sequential patterns (e.g., 1234567890, 0987654321)
  const digits = mobile.split('').map(Number)
  let isAscending = true
  let isDescending = true

  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) isAscending = false
    if (digits[i] !== digits[i - 1] - 1) isDescending = false
  }

  if (isAscending || isDescending) return false

  return true
}

// Helper functions for Health ID formatting
function formatHealthId(healthId: string): string {
  // Remove all non-digit characters
  const digits = healthId.replace(/\D/g, '')

  // Format as XX-XXXX-XXXX-XXXX (14 digits)
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
  }

  // Return as-is if not 14 digits
  return healthId
}

function isValidHealthIdFormat(healthId: string): boolean {
  // Remove formatting
  const digits = healthId.replace(/\D/g, '')

  // Must be exactly 14 digits
  return digits.length === 14 && /^\d{14}$/.test(digits)
}

// No zod schema needed - using useState like HouseholdMemberEditForm

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
}

interface ResidentsTableProps {
  residents: Resident[]
  searchedResidentId?: string
  householdId?: string
  onUpdateSuccess: () => void
}

// Type definitions for sorting
type SortField = 'name' | 'residentId' | 'citizenMobile' | 'healthId' | 'secName'
type SortDirection = 'asc' | 'desc'

export function ResidentsTable({
  residents,
  searchedResidentId,
  householdId,
  onUpdateSuccess,
}: ResidentsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null)
  const [householdMembers, setHouseholdMembers] = useState<Resident[]>([])
  const [isLoadingHousehold, setIsLoadingHousehold] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Form state using useState (like HouseholdMemberEditForm)
  const [citizenMobile, setCitizenMobile] = useState("")
  const [healthId, setHealthId] = useState("")
  const [errors, setErrors] = useState<{ citizenMobile?: string; healthId?: string }>({})

  const startEditing = (resident: Resident) => {
    console.log('🟡 Starting edit for resident:', resident.residentId)
    setEditingId(resident.residentId)
    setCitizenMobile(resident.citizenMobile || "")
    setHealthId(formatHealthId(resident.healthId || ""))
    setErrors({})
  }

  const cancelEditing = () => {
    setEditingId(null)
    setCitizenMobile("")
    setHealthId("")
    setErrors({})
  }

  const handleMobileChange = useCallback((value: string) => {
    // Remove all non-digit characters and limit to 10 digits
    const filtered = value.replace(/\D/g, '').slice(0, 10)
    setCitizenMobile(filtered)
    setErrors(prev => ({ ...prev, citizenMobile: undefined }))
  }, [])

  const handleHealthIdChange = useCallback((value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')

    // Limit to 14 digits
    const limitedDigits = digits.slice(0, 14)

    // Format as XX-XXXX-XXXX-XXXX
    let formatted = limitedDigits
    if (limitedDigits.length > 2) {
      formatted = `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2)}`
    }
    if (limitedDigits.length > 6) {
      formatted = `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2, 6)}-${limitedDigits.slice(6)}`
    }
    if (limitedDigits.length > 10) {
      formatted = `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2, 6)}-${limitedDigits.slice(6, 10)}-${limitedDigits.slice(10, 14)}`
    }

    setHealthId(formatted)
    setErrors(prev => ({ ...prev, healthId: undefined }))
  }, [])

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to ascending
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sort residents - memoized to prevent unnecessary re-renders
  const sortedResidents = useMemo(() => {
    return [...residents].sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
          break
        case 'residentId':
          aValue = a.residentId || ''
          bValue = b.residentId || ''
          break
        case 'citizenMobile':
          aValue = a.citizenMobile?.toLowerCase() || ''
          bValue = b.citizenMobile?.toLowerCase() || ''
          break
        case 'healthId':
          aValue = a.healthId?.toLowerCase() || ''
          bValue = b.healthId?.toLowerCase() || ''
          break
        case 'secName':
          aValue = a.secName?.toLowerCase() || ''
          bValue = b.secName?.toLowerCase() || ''
          break
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [residents, sortField, sortDirection])

  const handleSubmit = async (e: React.FormEvent, resident: Resident) => {
    e.preventDefault()
    console.log('🟢 Form submitted!', { citizenMobile, healthId, editingId })

    if (!editingId) {
      console.log('❌ No editingId, aborting')
      return
    }

    const newErrors: { citizenMobile?: string; healthId?: string } = {}

    // Validate mobile number
    if (citizenMobile) {
      const regex = /^[6-9]\d{9}$/
      if (!regex.test(citizenMobile)) {
        newErrors.citizenMobile = "Mobile number must be 10 digits starting with 6-9"
      } else if (!isValidMobilePattern(citizenMobile)) {
        newErrors.citizenMobile = "Mobile number cannot be repetitive or sequential (e.g., 9999999999, 9999998888)"
      }
    }

    // Validate health ID
    if (healthId && !isValidHealthIdFormat(healthId)) {
      newErrors.healthId = "Health ID must be 14 digits (format: XX-XXXX-XXXX-XXXX)"
    }

    if (Object.keys(newErrors).length > 0) {
      console.log('❌ Validation errors:', newErrors)
      setErrors(newErrors)
      return
    }

    console.log('✅ Validation passed, preparing update...')

    // Prepare data for update
    const updateData: { citizenMobile?: string | null; healthId?: string | null } = {}

    if (citizenMobile !== (resident.citizenMobile || "")) {
      updateData.citizenMobile = citizenMobile || null
    }

    if (healthId) {
      const formattedHealthId = healthId.replace(/-/g, '')
      if (formattedHealthId !== (resident.healthId || "")) {
        updateData.healthId = formattedHealthId
      }
    } else if (resident.healthId) {
      updateData.healthId = null
    }

    setIsUpdating(true)

    try {
      console.log('📤 Sending PUT request to:', `/api/residents/${editingId}`)
      const response = await fetch(`/api/residents/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()
      console.log('📥 Response received:', { ok: response.ok, result })

      if (response.ok) {
        toast.success("Updated successfully!", {
          description: `${result.changesLogged} field(s) updated`,
        })
        setEditingId(null)
        setCitizenMobile("")
        setHealthId("")
        setErrors({})
        onUpdateSuccess()
      } else {
        // Check for mobile duplicate limit error
        if (result.error === "MOBILE_DUPLICATE_LIMIT_EXCEEDED") {
          toast.error("Mobile Number Limit Exceeded", {
            description: result.message || "This mobile number is already used by 5 residents in this secretariat.",
            duration: 6000, // Show for 6 seconds
          })
        } else {
          toast.error("Update failed", {
            description: result.message || result.error || "Please try again",
          })
        }
      }
    } catch (error) {
      console.error('❌ Network error:', error)
      toast.error("Network error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Fetch household members when resident details is clicked
  const fetchHouseholdMembers = async (hhId: string) => {
    setIsLoadingHousehold(true)

    try {
      const response = await fetch(`/api/residents/household/${hhId}`)
      const data = await response.json()

      if (response.ok) {
        setHouseholdMembers(data.members)
      } else {
        toast.error("Failed to load household members", {
          description: data.error || "Please try again",
        })
      }
    } catch (error) {
      toast.error("Network error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsLoadingHousehold(false)
    }
  }

  // Handle opening resident details modal
  const handleOpenResidentDetails = (resident: Resident) => {
    setSelectedResident(resident)
    fetchHouseholdMembers(resident.hhId)
  }

  // Handle closing resident details modal
  const handleCloseResidentDetails = () => {
    setSelectedResident(null)
    setHouseholdMembers([])
    setEditingMemberId(null)
  }

  // Update a household member
  const updateHouseholdMember = async (
    residentId: string,
    data: { citizenMobile?: string | null; healthId?: string | null }
  ) => {
    setIsUpdating(true)

    try {
      const response = await fetch(`/api/residents/${residentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success("Updated successfully!", {
          description: `${result.changesLogged} field(s) updated`,
        })

        // Refresh household members
        if (selectedResident) {
          await fetchHouseholdMembers(selectedResident.hhId)
        }

        // Refresh main table
        onUpdateSuccess()

        setEditingMemberId(null)
      } else {
        // Check for mobile duplicate limit error
        if (result.error === "MOBILE_DUPLICATE_LIMIT_EXCEEDED") {
          toast.error("Mobile Number Limit Exceeded", {
            description: result.message || "This mobile number is already used by 5 residents in this secretariat.",
            duration: 6000, // Show for 6 seconds
          })
        } else {
          toast.error("Update failed", {
            description: result.message || result.error || "Please try again",
          })
        }
      }
    } catch {
      toast.error("Network error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsUpdating(false)
    }
  }



  return (
    <>
      {householdId && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-green-600" />
            <strong>Household ID:</strong> {householdId}
            <span className="ml-4">
              <strong>Total Members:</strong> {residents.length}
            </span>
          </div>
        </div>
      )}

      {/* Mobile view - Card layout */}
      <div className="md:hidden space-y-4">
        {sortedResidents.map((resident) => (
          <Card
            key={resident.residentId}
            className={`${
              resident.residentId === searchedResidentId
                ? "border-2 border-orange-500 bg-orange-50/50"
                : "border border-gray-200"
            } ${editingId !== resident.residentId ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            onClick={() => {
              // Only open details if not in edit mode
              if (editingId !== resident.residentId) {
                handleOpenResidentDetails(resident)
              }
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-orange-600" />
                    {resident.name}
                    {resident.residentId === searchedResidentId && (
                      <Badge variant="default" className="ml-2 bg-orange-600">
                        Searched
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <div><strong>UID:</strong> {maskUID(resident.uid)}</div>
                    <div><strong>Age:</strong> {resident.age || "N/A"} | <strong>Gender:</strong> {resident.gender || "N/A"}</div>
                    {resident.secName && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {resident.secName}, {resident.mandalName}
                      </div>
                    )}
                    {resident.phcName && <div><strong>PHC:</strong> {resident.phcName}</div>}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent onClick={(e) => e.stopPropagation()}>
              {editingId === resident.residentId ? (
                <form
                  onSubmit={(e) => handleSubmit(e, resident)}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`mobile-${resident.residentId}`} className="text-xs">
                      Mobile Number
                    </Label>
                    <Input
                      id={`mobile-${resident.residentId}`}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={citizenMobile}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      placeholder="Enter 10-digit mobile number"
                      disabled={isUpdating}
                      className={`text-sm ${errors.citizenMobile ? 'border-red-500' : ''}`}
                      maxLength={10}
                      autoComplete="off"
                    />
                    {errors.citizenMobile && (
                      <p className="text-xs text-red-500 font-medium">
                        ⚠️ {errors.citizenMobile}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`health-${resident.residentId}`} className="text-xs">
                      Health ID
                    </Label>
                    <Input
                      id={`health-${resident.residentId}`}
                      type="text"
                      inputMode="numeric"
                      value={healthId}
                      onChange={(e) => handleHealthIdChange(e.target.value)}
                      placeholder="XX-XXXX-XXXX-XXXX"
                      disabled={isUpdating}
                      className={`text-sm ${errors.healthId ? 'border-red-500' : ''}`}
                      maxLength={17}
                      autoComplete="off"
                    />
                    {errors.healthId && (
                      <p className="text-xs text-red-500">{errors.healthId}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isUpdating || (citizenMobile === (resident.citizenMobile || "") && healthId === formatHealthId(resident.healthId || ""))}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={isUpdating}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Mobile:</span>
                    <span className="font-medium">{resident.citizenMobile || "0"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Health ID:</span>
                    <span className="font-medium">{resident.healthId ? formatHealthId(resident.healthId) : "Not set"}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation() // Prevent card click
                      startEditing(resident)
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Edit Details
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop view - Table layout */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead
                className="font-semibold cursor-pointer hover:bg-gray-100 transition-colors text-center"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center justify-center gap-1">
                  Name
                  {sortField === 'name' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-4 w-4 text-orange-600" /> :
                      <ArrowDown className="h-4 w-4 text-orange-600" />
                  )}
                  {sortField !== 'name' && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
                </div>
              </TableHead>
              <TableHead className="font-semibold text-center">UID</TableHead>
              <TableHead className="font-semibold text-center">Age</TableHead>
              <TableHead className="font-semibold text-center">Gender</TableHead>
              <TableHead
                className="font-semibold cursor-pointer hover:bg-gray-100 transition-colors text-center"
                onClick={() => handleSort('citizenMobile')}
              >
                <div className="flex items-center justify-center gap-1">
                  Mobile Number
                  {sortField === 'citizenMobile' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-4 w-4 text-orange-600" /> :
                      <ArrowDown className="h-4 w-4 text-orange-600" />
                  )}
                  {sortField !== 'citizenMobile' && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
                </div>
              </TableHead>
              <TableHead
                className="font-semibold cursor-pointer hover:bg-gray-100 transition-colors text-center"
                onClick={() => handleSort('healthId')}
              >
                <div className="flex items-center justify-center gap-1">
                  Health ID
                  {sortField === 'healthId' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-4 w-4 text-orange-600" /> :
                      <ArrowDown className="h-4 w-4 text-orange-600" />
                  )}
                  {sortField !== 'healthId' && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
                </div>
              </TableHead>
              <TableHead
                className="font-semibold cursor-pointer hover:bg-gray-100 transition-colors text-center"
                onClick={() => handleSort('secName')}
              >
                <div className="flex items-center justify-center gap-1">
                  Location
                  {sortField === 'secName' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-4 w-4 text-orange-600" /> :
                      <ArrowDown className="h-4 w-4 text-orange-600" />
                  )}
                  {sortField !== 'secName' && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
                </div>
              </TableHead>
              <TableHead className="font-semibold text-center">PHC</TableHead>
              <TableHead className="font-semibold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedResidents.map((resident) => (
              <TableRow
                key={resident.residentId}
                className={
                  resident.residentId === searchedResidentId
                    ? "bg-orange-50 border-l-4 border-l-orange-600"
                    : ""
                }
              >
                <TableCell className="font-medium text-center">
                  <div className="flex items-center justify-center gap-2">
                    {resident.name}
                    {resident.residentId === searchedResidentId && (
                      <Badge variant="default" className="bg-orange-600 text-xs">
                        Searched
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-center whitespace-nowrap">{maskUID(resident.uid)}</TableCell>
                <TableCell className="text-center">{resident.age || "N/A"}</TableCell>
                <TableCell className="text-center">{resident.gender || "N/A"}</TableCell>
                <TableCell className="text-center">
                  {editingId === resident.residentId ? (
                    <div className="space-y-1 flex flex-col items-center">
                      <Input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={citizenMobile}
                        onChange={(e) => handleMobileChange(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-36 text-sm"
                        disabled={isUpdating}
                        maxLength={10}
                      />
                      {errors.citizenMobile && (
                        <p className="text-xs text-red-500">{errors.citizenMobile}</p>
                      )}
                    </div>
                  ) : (
                    <span className={resident.citizenMobile ? "font-medium" : "text-gray-400"}>
                      {resident.citizenMobile || "0"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === resident.residentId ? (
                    <div className="space-y-1 flex flex-col items-center">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={healthId}
                        onChange={(e) => handleHealthIdChange(e.target.value)}
                        placeholder="XX-XXXX-XXXX-XXXX"
                        className="w-44 text-sm"
                        disabled={isUpdating}
                        maxLength={17}
                      />
                      {errors.healthId && (
                        <p className="text-xs text-red-500">{errors.healthId}</p>
                      )}
                    </div>
                  ) : (
                    <span className={resident.healthId ? "font-medium" : "text-gray-400"}>
                      {resident.healthId ? formatHealthId(resident.healthId) : "Not set"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-center">
                  {resident.secName ? `${resident.secName}, ${resident.mandalName}` : "N/A"}
                </TableCell>
                <TableCell className="text-xs text-center">{resident.phcName || "N/A"}</TableCell>
                <TableCell>
                  {editingId === resident.residentId ? (
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        onClick={(e) => handleSubmit(e, resident)}
                        disabled={isUpdating || (citizenMobile === (resident.citizenMobile || "") && healthId === formatHealthId(resident.healthId || ""))}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={isUpdating}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        onClick={() => startEditing(resident)}
                        className="bg-orange-600 hover:bg-orange-700"
                        title="Edit Details"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenResidentDetails(resident)}
                        title="View Household Members"
                      >
                        <Users className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Household Members Dialog - Mobile-Optimized */}
      <HouseholdMembersDialog
        open={!!selectedResident}
        onOpenChange={(open) => {
          if (!open) handleCloseResidentDetails()
        }}
        selectedResident={selectedResident}
        householdMembers={householdMembers}
        isLoading={isLoadingHousehold}
        editingResidentId={editingMemberId}
        updatingResidentId={isUpdating ? editingMemberId : null}
        onEdit={(residentId) => setEditingMemberId(residentId)}
        onCancelEdit={() => setEditingMemberId(null)}
        onUpdate={updateHouseholdMember}
      />
    </>
  )
}

