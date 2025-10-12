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
import { Edit2, Save, X, Phone, CreditCard, User, MapPin, Calendar, Users, Home } from "lucide-react"
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

export function ResidentsTable({
  residents,
  searchedResidentId,
  householdId,
  onUpdateSuccess,
}: ResidentsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null)

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
          }`}
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
          <CardContent>
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
                  onClick={() => startEditing(resident)}
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
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedResident(resident)}
                    >
                      <User className="h-3 w-3" />
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

      {/* Resident Details Dialog */}
      <Dialog open={!!selectedResident} onOpenChange={() => setSelectedResident(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resident Details</DialogTitle>
          </DialogHeader>
          {selectedResident && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Name:</strong> {selectedResident.name}
                </div>
                <div>
                  <strong>UID:</strong> {selectedResident.uid || "N/A"}
                </div>
                <div>
                  <strong>Resident ID:</strong> {selectedResident.residentId}
                </div>
                <div>
                  <strong>Household ID:</strong> {selectedResident.hhId}
                </div>
                <div>
                  <strong>DOB:</strong> {formatDate(selectedResident.dob)}
                </div>
                <div>
                  <strong>Age:</strong> {selectedResident.age || "N/A"}
                </div>
                <div>
                  <strong>Gender:</strong> {selectedResident.gender || "N/A"}
                </div>
                <div>
                  <strong>Mobile:</strong> {selectedResident.mobileNumber || "N/A"}
                </div>
                <div>
                  <strong>Health ID:</strong> {selectedResident.healthId || "N/A"}
                </div>
                <div>
                  <strong>District:</strong> {selectedResident.distName || "N/A"}
                </div>
                <div>
                  <strong>Mandal:</strong> {selectedResident.mandalName || "N/A"}
                </div>
                <div>
                  <strong>Secretariat:</strong> {selectedResident.secName || "N/A"}
                </div>
                <div>
                  <strong>PHC:</strong> {selectedResident.phcName || "N/A"}
                </div>
                <div>
                  <strong>Area Type:</strong> {selectedResident.ruralUrban === "R" ? "Rural" : selectedResident.ruralUrban === "U" ? "Urban" : "N/A"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

