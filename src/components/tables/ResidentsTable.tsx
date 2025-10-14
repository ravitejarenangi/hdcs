"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit2, Save, X, Phone, CreditCard, User, MapPin, Calendar, Users, Home, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"

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

// Validation schema
const updateSchema = z.object({
  citizenMobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9")
    .refine(
      (val) => !val || isValidMobilePattern(val),
      "Mobile number cannot be repetitive or sequential (e.g., 9999999999, 9999998888)"
    )
    .optional()
    .or(z.literal("")),
  healthId: z
    .string()
    .refine(
      (val) => !val || isValidHealthIdFormat(val),
      "Health ID must be 14 digits (format: XX-XXXX-XXXX-XXXX)"
    )
    // Health IDs are stored WITH dashes in database to match existing data
    .optional()
    .or(z.literal("")),
})

type UpdateFormData = z.infer<typeof updateSchema>

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

// Searched Person Details Component
interface SearchedPersonDetailsProps {
  person: Resident
}

function SearchedPersonDetails({ person }: SearchedPersonDetailsProps) {
  return (
    <Card className="border-2 border-blue-500 bg-blue-50/30 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-blue-600" />
          Searched Person Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Column 1 - Basic Info */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Name</div>
                <div className="font-semibold text-base">{person.name}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Resident ID</div>
                <div className="font-mono text-sm">{person.residentId}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">UID</div>
                <div className="font-mono text-sm">{maskUID(person.uid)}</div>
              </div>
            </div>
          </div>

          {/* Column 2 - Personal Details */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Age</div>
                <div className="text-sm">{person.age || <span className="text-gray-400">N/A</span>}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Gender</div>
                <div className="text-sm">{person.gender || <span className="text-gray-400">N/A</span>}</div>
              </div>
            </div>

            {person.dob && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-gray-600 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-600 font-medium">Date of Birth</div>
                  <div className="text-sm">{new Date(person.dob).toLocaleDateString("en-IN")}</div>
                </div>
              </div>
            )}
          </div>

          {/* Column 3 - Contact & Health Info */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Mobile Number</div>
                <div className="text-sm font-medium">
                  {person.citizenMobile || <span className="text-gray-400">0</span>}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Health ID</div>
                <div className="text-sm font-medium">
                  {person.healthId || <span className="text-gray-400">Not set</span>}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Home className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-xs text-gray-600 font-medium">Household ID</div>
                <div className="font-mono text-sm">{person.hhId}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Location Info - Full Width */}
        {(person.mandalName || person.secName || person.phcName) && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {person.mandalName && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Mandal</div>
                    <div className="text-sm">{person.mandalName}</div>
                  </div>
                </div>
              )}

              {person.secName && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Secretariat</div>
                    <div className="text-sm">{person.secName}</div>
                  </div>
                </div>
              )}

              {person.phcName && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-600 font-medium">PHC</div>
                    <div className="text-sm">{person.phcName}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Household Member Card Component
interface HouseholdMemberCardProps {
  member: Resident
  isSelected: boolean
  isEditing: boolean
  isUpdating: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (residentId: string, data: { citizenMobile?: string | null; healthId?: string | null }) => Promise<void>
}

function HouseholdMemberCard({
  member,
  isSelected,
  isEditing,
  isUpdating,
  onEdit,
  onCancelEdit,
  onUpdate,
}: HouseholdMemberCardProps) {
  const [citizenMobile, setCitizenMobile] = useState(member.citizenMobile || "")
  const [healthId, setHealthId] = useState(formatHealthId(member.healthId || ""))
  const [errors, setErrors] = useState<{ citizenMobile?: string; healthId?: string }>({})

  const validateMobileNumber = (value: string): boolean => {
    if (!value) return true // Empty is valid
    const regex = /^[6-9]\d{9}$/
    return regex.test(value)
  }

  const handleHealthIdChange = (value: string) => {
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
    setErrors({ ...errors, healthId: undefined })
  }

  const handleSave = async () => {
    const newErrors: { citizenMobile?: string; healthId?: string } = {}

    if (citizenMobile && !validateMobileNumber(citizenMobile)) {
      newErrors.citizenMobile = "Mobile number must be 10 digits starting with 6-9"
    }

    if (healthId && !isValidHealthIdFormat(healthId)) {
      newErrors.healthId = "Health ID must be 14 digits (format: XX-XXXX-XXXX-XXXX)"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    await onUpdate(member.residentId, {
      citizenMobile: citizenMobile || null,
      healthId: healthId || null, // Save WITH dashes to match existing data
    })
  }

  const handleCancel = () => {
    setCitizenMobile(member.citizenMobile || "")
    setHealthId(formatHealthId(member.healthId || ""))
    setErrors({})
    onCancelEdit()
  }

  return (
    <Card
      className={`${
        isSelected
          ? "border-2 border-orange-500 bg-orange-50/50"
          : "border border-gray-200"
      }`}
    >
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column - Basic Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-600" />
              <div>
                <div className="font-semibold text-base">{member.name}</div>
                {isSelected && (
                  <Badge className="mt-1 bg-orange-600">Selected Resident</Badge>
                )}
              </div>
            </div>

            <div className="text-sm space-y-1 text-gray-700">
              <div><strong>UID:</strong> {maskUID(member.uid)}</div>
              <div><strong>Age:</strong> {member.age || "N/A"}</div>
              <div><strong>Gender:</strong> {member.gender || "N/A"}</div>
              {member.dob && (
                <div><strong>DOB:</strong> {new Date(member.dob).toLocaleDateString("en-IN")}</div>
              )}
            </div>
          </div>

          {/* Right Column - Editable Fields */}
          <div className="space-y-3">
            {/* Mobile Number */}
            <div className="space-y-1">
              <Label htmlFor={`mobile-${member.residentId}`} className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-green-600" />
                Mobile Number
              </Label>
              {isEditing ? (
                <div>
                  <Input
                    id={`mobile-${member.residentId}`}
                    value={citizenMobile}
                    onChange={(e) => {
                      setCitizenMobile(e.target.value)
                      setErrors({ ...errors, citizenMobile: undefined })
                    }}
                    placeholder="Enter 10-digit mobile number"
                    disabled={isUpdating}
                    className={errors.citizenMobile ? "border-red-500" : ""}
                  />
                  {errors.citizenMobile && (
                    <p className="text-xs text-red-600 mt-1">{errors.citizenMobile}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm font-medium">
                  {member.citizenMobile || <span className="text-gray-400">0</span>}
                </div>
              )}
            </div>

            {/* Health ID */}
            <div className="space-y-1">
              <Label htmlFor={`health-${member.residentId}`} className="flex items-center gap-2 text-sm">
                <CreditCard className="h-3 w-3 text-blue-600" />
                Health ID
              </Label>
              {isEditing ? (
                <div>
                  <Input
                    id={`health-${member.residentId}`}
                    value={healthId}
                    onChange={(e) => handleHealthIdChange(e.target.value)}
                    placeholder="XX-XXXX-XXXX-XXXX"
                    disabled={isUpdating}
                    className={errors.healthId ? "border-red-500" : ""}
                    maxLength={17} // 14 digits + 3 dashes
                  />
                  {errors.healthId && (
                    <p className="text-xs text-red-600 mt-1">{errors.healthId}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm font-medium">
                  {member.healthId ? formatHealthId(member.healthId) : <span className="text-gray-400">Not set</span>}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {isUpdating ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isUpdating}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={onEdit}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
  const [householdError, setHouseholdError] = useState("")
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
  })

  const startEditing = (resident: Resident) => {
    setEditingId(resident.residentId)
    reset({
      citizenMobile: resident.citizenMobile || "",
      healthId: formatHealthId(resident.healthId || ""),
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    reset()
  }

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

  // Sort residents
  const sortedResidents = [...residents].sort((a, b) => {
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

  const onSubmit = async (data: UpdateFormData) => {
    if (!editingId) return

    setIsUpdating(true)

    try {
      const response = await fetch(`/api/residents/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          citizenMobile: data.citizenMobile || null,
          healthId: data.healthId || null,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success("Updated successfully!", {
          description: `${result.changesLogged} field(s) updated`,
        })
        setEditingId(null)
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
    } catch {
      toast.error("Network error", {
        description: "Please check your connection and try again",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-IN")
  }

  // Fetch household members when resident details is clicked
  const fetchHouseholdMembers = async (hhId: string) => {
    setIsLoadingHousehold(true)
    setHouseholdError("")

    try {
      const response = await fetch(`/api/residents/household/${hhId}`)
      const data = await response.json()

      if (response.ok) {
        setHouseholdMembers(data.members)
      } else {
        setHouseholdError(data.error || "Failed to load household members")
        toast.error("Failed to load household members", {
          description: data.error || "Please try again",
        })
      }
    } catch (error) {
      setHouseholdError("Network error")
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
    setHouseholdError("")
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

  // Mobile view - Card layout
  const MobileView = () => (
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
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`mobile-${resident.residentId}`} className="text-xs">
                    Mobile Number
                  </Label>
                  <Input
                    id={`mobile-${resident.residentId}`}
                    {...register("citizenMobile")}
                    placeholder="10-digit mobile"
                    className="text-sm"
                    disabled={isUpdating}
                  />
                  {errors.citizenMobile && (
                    <p className="text-xs text-red-500">{errors.citizenMobile.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`health-${resident.residentId}`} className="text-xs">
                    Health ID
                  </Label>
                  <Controller
                    name="healthId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id={`health-${resident.residentId}`}
                        value={field.value || ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                          let formatted = digits
                          if (digits.length > 2) {
                            formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`
                          }
                          if (digits.length > 6) {
                            formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
                          }
                          if (digits.length > 10) {
                            formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
                          }
                          field.onChange(formatted)
                        }}
                        placeholder="XX-XXXX-XXXX-XXXX"
                        className="text-sm"
                        disabled={isUpdating}
                        maxLength={17}
                      />
                    )}
                  />
                  {errors.healthId && (
                    <p className="text-xs text-red-500">{errors.healthId.message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdating || !isDirty}
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
  )

  // Sortable column header component
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="font-semibold cursor-pointer hover:bg-gray-100 transition-colors text-center"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ?
            <ArrowUp className="h-4 w-4 text-orange-600" /> :
            <ArrowDown className="h-4 w-4 text-orange-600" />
        )}
        {sortField !== field && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
      </div>
    </TableHead>
  )

  // Desktop view - Table layout
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <SortableHeader field="name">Name</SortableHeader>
            <TableHead className="font-semibold text-center">UID</TableHead>
            <TableHead className="font-semibold text-center">Age</TableHead>
            <TableHead className="font-semibold text-center">Gender</TableHead>
            <SortableHeader field="citizenMobile">Mobile Number</SortableHeader>
            <SortableHeader field="healthId">Health ID</SortableHeader>
            <SortableHeader field="secName">Location</SortableHeader>
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
                      {...register("citizenMobile")}
                      placeholder="10-digit mobile"
                      className="w-36 text-sm"
                      disabled={isUpdating}
                    />
                    {errors.citizenMobile && (
                      <p className="text-xs text-red-500">{errors.citizenMobile.message}</p>
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
                    <Controller
                      name="healthId"
                      control={control}
                      render={({ field }) => (
                        <Input
                          value={field.value || ""}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                            let formatted = digits
                            if (digits.length > 2) {
                              formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`
                            }
                            if (digits.length > 6) {
                              formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
                            }
                            if (digits.length > 10) {
                              formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
                            }
                            field.onChange(formatted)
                          }}
                          placeholder="XX-XXXX-XXXX-XXXX"
                          className="w-44 text-sm"
                          disabled={isUpdating}
                          maxLength={17}
                        />
                      )}
                    />
                    {errors.healthId && (
                      <p className="text-xs text-red-500">{errors.healthId.message}</p>
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
                      onClick={handleSubmit(onSubmit)}
                      disabled={isUpdating || !isDirty}
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
  )

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

      <MobileView />
      <DesktopView />

      {/* Household Members Dialog */}
      <Dialog open={!!selectedResident} onOpenChange={handleCloseResidentDetails}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-orange-600" />
              Household Information
            </DialogTitle>
            {selectedResident && (
              <div className="text-sm text-gray-600 mt-2">
                <div><strong>Household ID:</strong> {selectedResident.hhId}</div>
                <div><strong>Total Members:</strong> {householdMembers.length}</div>
              </div>
            )}
          </DialogHeader>

          {isLoadingHousehold ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600">Loading household members...</span>
            </div>
          ) : householdError ? (
            <div className="flex items-center justify-center py-12 text-red-600">
              <AlertCircle className="h-8 w-8 mr-3" />
              <span>{householdError}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Searched Person Details Section */}
              {selectedResident && (
                <SearchedPersonDetails person={selectedResident} />
              )}

              {/* Household Members Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold">All Household Members</h3>
                  <Badge variant="secondary" className="ml-2">
                    {householdMembers.length} {householdMembers.length === 1 ? 'Member' : 'Members'}
                  </Badge>
                </div>

                <div className="space-y-4">
                  {householdMembers.map((member) => (
                    <HouseholdMemberCard
                      key={member.residentId}
                      member={member}
                      isSelected={member.residentId === selectedResident?.residentId}
                      isEditing={editingMemberId === member.residentId}
                      isUpdating={isUpdating}
                      onEdit={() => setEditingMemberId(member.residentId)}
                      onCancelEdit={() => setEditingMemberId(null)}
                      onUpdate={updateHouseholdMember}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

