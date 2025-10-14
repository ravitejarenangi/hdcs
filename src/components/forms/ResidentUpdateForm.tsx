"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, CreditCard, User, MapPin, Calendar, Users } from "lucide-react"
import { toast } from "sonner"

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
    control,
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      citizenMobile: resident.citizenMobile || "",
      healthId: formatHealthId(resident.healthId || ""),
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
          citizenMobile: data.citizenMobile || null,
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
                {...register("citizenMobile")}
                placeholder="Enter 10-digit mobile number"
                className={`${
                  resident.citizenMobile
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-white"
                }`}
                disabled={isUpdating}
              />
              {resident.citizenMobile && (
                <p className="text-xs text-gray-500">
                  Current: <strong>{resident.citizenMobile}</strong>
                </p>
              )}
              {errors.citizenMobile && (
                <p className="text-xs text-red-500">
                  {errors.citizenMobile.message}
                </p>
              )}
            </div>

            {/* Health ID Field */}
            <div className="space-y-2">
              <Label htmlFor={`health-${resident.residentId}`} className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                Health ID (ABHA)
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
                    className={`${
                      resident.healthId
                        ? "bg-yellow-50 border-yellow-300"
                        : "bg-white"
                    }`}
                    disabled={isUpdating}
                    maxLength={17}
                  />
                )}
              />
              {resident.healthId && (
                <p className="text-xs text-gray-500">
                  Current: <strong>{formatHealthId(resident.healthId)}</strong>
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

