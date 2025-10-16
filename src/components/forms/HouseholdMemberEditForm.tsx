"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Phone, CreditCard, Save, X } from "lucide-react"

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

  return !(isAscending || isDescending)
}

// Helper function to validate health ID format
function isValidHealthIdFormat(healthId: string): boolean {
  const digitsOnly = healthId.replace(/-/g, '')
  return digitsOnly.length === 14 && /^\d+$/.test(digitsOnly)
}

// Helper function to format health ID
function formatHealthId(healthId: string | null): string {
  if (!healthId) return ""
  const digits = healthId.replace(/-/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
}

interface HouseholdMemberEditFormProps {
  member: {
    residentId: string
    name: string
    citizenMobile: string | null
    healthId: string | null
  }
  isUpdating: boolean
  onSave: (data: { citizenMobile?: string | null; healthId?: string | null }) => Promise<void>
  onCancel: () => void
}

export function HouseholdMemberEditForm({
  member,
  isUpdating,
  onSave,
  onCancel,
}: HouseholdMemberEditFormProps) {
  const [citizenMobile, setCitizenMobile] = useState(member.citizenMobile || "")
  const [healthId, setHealthId] = useState(formatHealthId(member.healthId || ""))
  const [errors, setErrors] = useState<{ citizenMobile?: string; healthId?: string }>({})

  // Reset form when member changes
  useEffect(() => {
    setCitizenMobile(member.citizenMobile || "")
    setHealthId(formatHealthId(member.healthId || ""))
    setErrors({})
  }, [member.residentId, member.citizenMobile, member.healthId])

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

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🟢 HouseholdMemberEditForm - handleSubmit called', { citizenMobile, healthId })
    e.preventDefault()

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

    // Validate ABHA ID
    if (healthId && !isValidHealthIdFormat(healthId)) {
      newErrors.healthId = "ABHA ID must be 14 digits (format: XX-XXXX-XXXX-XXXX)"
    }

    if (Object.keys(newErrors).length > 0) {
      console.log('❌ Validation errors:', newErrors)
      setErrors(newErrors)
      return
    }

    console.log('✅ Validation passed, preparing update...')

    // Prepare data for update
    const updateData: { citizenMobile?: string | null; healthId?: string | null } = {}
    
    if (citizenMobile !== (member.citizenMobile || "")) {
      updateData.citizenMobile = citizenMobile || null
    }
    
    if (healthId) {
      const formattedHealthId = healthId.replace(/-/g, '')
      if (formattedHealthId !== (member.healthId || "")) {
        updateData.healthId = formattedHealthId
      }
    } else if (member.healthId) {
      updateData.healthId = null
    }

    await onSave(updateData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mobile Number */}
      <div className="space-y-2">
        <Label htmlFor={`mobile-${member.residentId}`} className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-green-600" />
          Mobile Number
        </Label>
        <Input
          id={`mobile-${member.residentId}`}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={citizenMobile}
          onChange={(e) => handleMobileChange(e.target.value)}
          placeholder="Enter 10-digit mobile number"
          disabled={isUpdating}
          className={errors.citizenMobile ? "border-red-500" : ""}
          maxLength={10}
          autoComplete="off"
        />
        {errors.citizenMobile && (
          <p className="text-sm text-red-600">{errors.citizenMobile}</p>
        )}
      </div>

      {/* ABHA ID */}
      <div className="space-y-2">
        <Label htmlFor={`health-${member.residentId}`} className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-600" />
          ABHA ID
        </Label>
        <Input
          id={`health-${member.residentId}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9-]*"
          value={healthId}
          onChange={(e) => handleHealthIdChange(e.target.value)}
          placeholder="XX-XXXX-XXXX-XXXX"
          disabled={isUpdating}
          className={errors.healthId ? "border-red-500" : ""}
          maxLength={17}
          autoComplete="off"
        />
        {errors.healthId && (
          <p className="text-sm text-red-600">{errors.healthId}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={isUpdating}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {isUpdating ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isUpdating}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </form>
  )
}

