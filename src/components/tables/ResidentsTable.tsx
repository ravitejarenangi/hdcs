"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { Edit2, Save, X, Phone, CreditCard, User, MapPin, Calendar, Users, Home, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

// Validation schema
const updateSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9")
    .optional()
    .or(z.literal("")),
  healthId: z
    .string()
    .min(1, "Health ID cannot be empty")
    .max(50, "Health ID too long")
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
  mobileNumber: string | null
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
                <div className="font-mono text-sm">{person.uid || <span className="text-gray-400">Not set</span>}</div>
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
                  {person.mobileNumber || <span className="text-gray-400">Not set</span>}
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
  onUpdate: (residentId: string, data: { mobileNumber?: string | null; healthId?: string | null }) => Promise<void>
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
  const [mobileNumber, setMobileNumber] = useState(member.mobileNumber || "")
  const [healthId, setHealthId] = useState(member.healthId || "")
  const [errors, setErrors] = useState<{ mobileNumber?: string; healthId?: string }>({})

  const validateMobileNumber = (value: string): boolean => {
    if (!value) return true // Empty is valid
    const regex = /^[6-9]\d{9}$/
    return regex.test(value)
  }

  const handleSave = async () => {
    const newErrors: { mobileNumber?: string; healthId?: string } = {}

    if (mobileNumber && !validateMobileNumber(mobileNumber)) {
      newErrors.mobileNumber = "Mobile number must be 10 digits starting with 6-9"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    await onUpdate(member.residentId, {
      mobileNumber: mobileNumber || null,
      healthId: healthId || null,
    })
  }

  const handleCancel = () => {
    setMobileNumber(member.mobileNumber || "")
    setHealthId(member.healthId || "")
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
              <div><strong>UID:</strong> {member.uid || "N/A"}</div>
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
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value)
                      setErrors({ ...errors, mobileNumber: undefined })
                    }}
                    placeholder="Enter 10-digit mobile number"
                    disabled={isUpdating}
                    className={errors.mobileNumber ? "border-red-500" : ""}
                  />
                  {errors.mobileNumber && (
                    <p className="text-xs text-red-600 mt-1">{errors.mobileNumber}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm font-medium">
                  {member.mobileNumber || <span className="text-gray-400">Not set</span>}
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
                <Input
                  id={`health-${member.residentId}`}
                  value={healthId}
                  onChange={(e) => setHealthId(e.target.value)}
                  placeholder="Enter Health ID"
                  disabled={isUpdating}
                />
              ) : (
                <div className="text-sm font-medium">
                  {member.healthId || <span className="text-gray-400">Not set</span>}
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

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
  })

  const startEditing = (resident: Resident) => {
    setEditingId(resident.residentId)
    reset({
      mobileNumber: resident.mobileNumber || "",
      healthId: resident.healthId || "",
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    reset()
  }

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
          mobileNumber: data.mobileNumber || null,
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
        toast.error("Update failed", {
          description: result.error || "Please try again",
        })
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
    data: { mobileNumber?: string | null; healthId?: string | null }
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
        toast.error("Update failed", {
          description: result.error || "Please try again",
        })
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
      {residents.map((resident) => (
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
                  <div><strong>UID:</strong> {resident.uid || "N/A"}</div>
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
                    {...register("mobileNumber")}
                    placeholder="10-digit mobile"
                    className="text-sm"
                    disabled={isUpdating}
                  />
                  {errors.mobileNumber && (
                    <p className="text-xs text-red-500">{errors.mobileNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`health-${resident.residentId}`} className="text-xs">
                    Health ID
                  </Label>
                  <Input
                    id={`health-${resident.residentId}`}
                    {...register("healthId")}
                    placeholder="Health ID"
                    className="text-sm"
                    disabled={isUpdating}
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
                  <span className="font-medium">{resident.mobileNumber || "Not set"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Health ID:</span>
                  <span className="font-medium">{resident.healthId || "Not set"}</span>
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

  // Desktop view - Table layout
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">UID</TableHead>
            <TableHead className="font-semibold">Age</TableHead>
            <TableHead className="font-semibold">Gender</TableHead>
            <TableHead className="font-semibold">Mobile Number</TableHead>
            <TableHead className="font-semibold">Health ID</TableHead>
            <TableHead className="font-semibold">Location</TableHead>
            <TableHead className="font-semibold">PHC</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {residents.map((resident) => (
            <TableRow
              key={resident.residentId}
              className={
                resident.residentId === searchedResidentId
                  ? "bg-orange-50 border-l-4 border-l-orange-600"
                  : ""
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {resident.name}
                  {resident.residentId === searchedResidentId && (
                    <Badge variant="default" className="bg-orange-600 text-xs">
                      Searched
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{resident.uid || "N/A"}</TableCell>
              <TableCell>{resident.age || "N/A"}</TableCell>
              <TableCell>{resident.gender || "N/A"}</TableCell>
              <TableCell>
                {editingId === resident.residentId ? (
                  <div className="space-y-1">
                    <Input
                      {...register("mobileNumber")}
                      placeholder="10-digit mobile"
                      className="w-36 text-sm"
                      disabled={isUpdating}
                    />
                    {errors.mobileNumber && (
                      <p className="text-xs text-red-500">{errors.mobileNumber.message}</p>
                    )}
                  </div>
                ) : (
                  <span className={resident.mobileNumber ? "font-medium" : "text-gray-400"}>
                    {resident.mobileNumber || "Not set"}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {editingId === resident.residentId ? (
                  <div className="space-y-1">
                    <Input
                      {...register("healthId")}
                      placeholder="Health ID"
                      className="w-36 text-sm"
                      disabled={isUpdating}
                    />
                    {errors.healthId && (
                      <p className="text-xs text-red-500">{errors.healthId.message}</p>
                    )}
                  </div>
                ) : (
                  <span className={resident.healthId ? "font-medium" : "text-gray-400"}>
                    {resident.healthId || "Not set"}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                {resident.secName ? `${resident.secName}, ${resident.mandalName}` : "N/A"}
              </TableCell>
              <TableCell className="text-xs">{resident.phcName || "N/A"}</TableCell>
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

