"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, CreditCard, User, MapPin, Calendar, Users } from "lucide-react"
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
  // Demographic fields
  distName: string | null
  mandalName: string | null
  secName: string | null
  ruralUrban: string | null
  // Health fields
  age: number | null
  phcName: string | null
}

interface ResidentUpdateFormProps {
  resident: Resident
  onUpdateSuccess: () => void
  isSearchedResident: boolean
}

export function ResidentUpdateForm({
  resident,
  onUpdateSuccess,
  isSearchedResident,
}: ResidentUpdateFormProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      mobileNumber: resident.mobileNumber || "",
      healthId: resident.healthId || "",
    },
  })

  const onSubmit = async (data: UpdateFormData) => {
    setIsUpdating(true)

    try {
      const response = await fetch(`/api/residents/${resident.residentId}`, {
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
          description: `${result.changesLogged} field(s) updated for ${resident.name}`,
        })
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
    if (!date) return "Not available"
    return new Date(date).toLocaleDateString("en-IN")
  }

  return (
    <Card
      className={`${
        isSearchedResident
          ? "border-2 border-blue-500 bg-blue-50/50"
          : "border border-gray-200"
      } transition-all duration-200 hover:shadow-md`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-blue-600" />
              {resident.name}
              {isSearchedResident && (
                <Badge variant="default" className="ml-2">
                  Searched Resident
                </Badge>
              )}
            </CardTitle>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <strong>UID:</strong> {resident.uid || "Not available"}
              </div>
              <div className="flex items-center gap-2">
                <strong>Resident ID:</strong> {resident.residentId}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <strong>Household ID:</strong> {resident.hhId}
              </div>
              {resident.dob && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <strong>DOB:</strong> {formatDate(resident.dob)}
                  {resident.age && <span>(Age: {resident.age})</span>}
                </div>
              )}
              {resident.gender && (
                <div className="flex items-center gap-2">
                  <strong>Gender:</strong> {resident.gender}
                </div>
              )}
              {(resident.mandalName || resident.secName) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {resident.secName && <span>{resident.secName}</span>}
                  {resident.mandalName && <span>, {resident.mandalName}</span>}
                  {resident.distName && <span>, {resident.distName}</span>}
                </div>
              )}
              {resident.phcName && (
                <div className="flex items-center gap-2">
                  <strong>PHC:</strong> {resident.phcName}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mobile Number Field */}
            <div className="space-y-2">
              <Label htmlFor={`mobile-${resident.residentId}`} className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-600" />
                Mobile Number
              </Label>
              <Input
                id={`mobile-${resident.residentId}`}
                {...register("mobileNumber")}
                placeholder="Enter 10-digit mobile number"
                className={`${
                  resident.mobileNumber
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-white"
                }`}
                disabled={isUpdating}
              />
              {resident.mobileNumber && (
                <p className="text-xs text-gray-500">
                  Current: <strong>{resident.mobileNumber}</strong>
                </p>
              )}
              {errors.mobileNumber && (
                <p className="text-xs text-red-500">
                  {errors.mobileNumber.message}
                </p>
              )}
            </div>

            {/* Health ID Field */}
            <div className="space-y-2">
              <Label htmlFor={`health-${resident.residentId}`} className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                Health ID (ABHA)
              </Label>
              <Input
                id={`health-${resident.residentId}`}
                {...register("healthId")}
                placeholder="Enter Health ID"
                className={`${
                  resident.healthId
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-white"
                }`}
                disabled={isUpdating}
              />
              {resident.healthId && (
                <p className="text-xs text-gray-500">
                  Current: <strong>{resident.healthId}</strong>
                </p>
              )}
              {errors.healthId && (
                <p className="text-xs text-red-500">
                  {errors.healthId.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-between items-center pt-2">
            <Button
              type="submit"
              disabled={isUpdating || !isDirty}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                "Update Information"
              )}
            </Button>
            {!isDirty && (
              <p className="text-xs text-gray-500">
                Make changes to enable update
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

