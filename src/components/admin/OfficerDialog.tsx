"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface Officer {
  id: string
  username: string
  fullName: string
  mobileNumber?: string | null
  role: string
  mandalName?: string | null
  assignedSecretariats?: string | null
  isActive: boolean
}

interface OfficerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  officer?: Officer | null
  onSuccess: () => void
}

interface Mandal {
  name: string
  residentCount: number
}

interface Secretariat {
  name: string
  mandalName: string
  residentCount: number
}

export function OfficerDialog({
  open,
  onOpenChange,
  officer,
  onSuccess,
}: OfficerDialogProps) {
  const isEdit = !!officer

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
    role: "FIELD_OFFICER" as "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER",
    mandalName: "",
    assignedSecretariats: [] as string[],
    isActive: true,
  })

  const [mandals, setMandals] = useState<Mandal[]>([])
  const [secretariats, setSecretariats] = useState<Secretariat[]>([])
  const [loadingMandals, setLoadingMandals] = useState(false)
  const [loadingSecretariats, setLoadingSecretariats] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch mandals and secretariats when dialog opens
  useEffect(() => {
    if (open) {
      fetchMandals()
      fetchSecretariats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reset form when dialog opens/closes or officer changes
  useEffect(() => {
    if (open) {
      if (officer) {
        const assignedSecs = officer.assignedSecretariats
          ? JSON.parse(officer.assignedSecretariats)
          : []
        setFormData({
          fullName: officer.fullName,
          username: officer.username,
          mobileNumber: officer.mobileNumber || "",
          password: "",
          confirmPassword: "",
          role: officer.role as "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER",
          mandalName: officer.mandalName || "",
          assignedSecretariats: assignedSecs,
          isActive: officer.isActive,
        })
      } else {
        setFormData({
          fullName: "",
          username: "",
          mobileNumber: "",
          password: "",
          confirmPassword: "",
          role: "FIELD_OFFICER",
          mandalName: "",
          assignedSecretariats: [],
          isActive: true,
        })
      }
      setErrors({})
    }
  }, [open, officer])

  const fetchMandals = async () => {
    try {
      setLoadingMandals(true)
      const response = await fetch("/api/admin/mandals")

      if (!response.ok) {
        throw new Error("Failed to fetch mandals")
      }

      const data = await response.json()
      setMandals(data.mandals || [])
    } catch (error) {
      console.error("Error fetching mandals:", error)
      toast.error("Failed to load mandals")
    } finally {
      setLoadingMandals(false)
    }
  }

  const fetchSecretariats = async () => {
    try {
      setLoadingSecretariats(true)
      const response = await fetch("/api/admin/secretariats")

      if (!response.ok) {
        throw new Error("Failed to fetch secretariats")
      }

      const data = await response.json()
      setSecretariats(data.secretariats || [])
    } catch (error) {
      console.error("Error fetching secretariats:", error)
      toast.error("Failed to load secretariats")
    } finally {
      setLoadingSecretariats(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate full name
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required"
    } else if (formData.fullName.trim().length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters"
    }

    // Validate mobile number (optional, but must be 10 digits if provided)
    if (formData.mobileNumber.trim()) {
      if (!/^[0-9]{10}$/.test(formData.mobileNumber.trim())) {
        newErrors.mobileNumber = "Mobile number must be exactly 10 digits"
      }
    }

    // Role-specific validation
    if (formData.role === "PANCHAYAT_SECRETARY") {
      if (!formData.mandalName) {
        newErrors.mandalName = "Mandal is required for Panchayat Secretary"
      }
    } else if (formData.role === "FIELD_OFFICER") {
      if (formData.assignedSecretariats.length === 0) {
        newErrors.assignedSecretariats = "At least one secretariat must be assigned"
      }
    }

    // Validate username (only for create)
    if (!isEdit) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required"
      } else if (formData.username.trim().length < 4) {
        newErrors.username = "Username must be at least 4 characters"
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = "Username can only contain letters, numbers, and underscores"
      }

      // Validate password (only for create)
      if (!formData.password) {
        newErrors.password = "Password is required"
      } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters"
      } else if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = "Password must contain at least one uppercase letter"
      } else if (!/[0-9]/.test(formData.password)) {
        newErrors.password = "Password must contain at least one number"
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        newErrors.password = "Password must contain at least one special character"
      }

      // Validate confirm password
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm password"
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (isEdit) {
        // Update existing user
        const updatePayload: {
          fullName: string
          mobileNumber: string | null
          isActive: boolean
          mandalName?: string | null
          assignedSecretariats?: string[]
        } = {
          fullName: formData.fullName,
          mobileNumber: formData.mobileNumber.trim() || null,
          isActive: formData.isActive,
        }

        // Add role-specific fields
        if (formData.role === "PANCHAYAT_SECRETARY") {
          updatePayload.mandalName = formData.mandalName || null
        } else if (formData.role === "FIELD_OFFICER") {
          updatePayload.assignedSecretariats = formData.assignedSecretariats
        }

        const response = await fetch(`/api/admin/officers/${officer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update user")
        }

        toast.success("User updated successfully")
      } else {
        // Create new user
        const createPayload: {
          fullName: string
          username: string
          mobileNumber: string | null
          password: string
          role: string
          mandalName?: string
          assignedSecretariats?: string[]
        } = {
          fullName: formData.fullName,
          username: formData.username,
          mobileNumber: formData.mobileNumber.trim() || null,
          password: formData.password,
          role: formData.role,
        }

        // Add role-specific fields
        if (formData.role === "PANCHAYAT_SECRETARY") {
          createPayload.mandalName = formData.mandalName
        } else if (formData.role === "FIELD_OFFICER") {
          createPayload.assignedSecretariats = formData.assignedSecretariats
        }

        const response = await fetch("/api/admin/officers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create user")
        }

        toast.success("User created successfully")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Submit error:", error)
      toast.error(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSecretariat = (secretariatName: string) => {
    setFormData((prev) => {
      const current = prev.assignedSecretariats
      if (current.includes(secretariatName)) {
        return {
          ...prev,
          assignedSecretariats: current.filter((s) => s !== secretariatName),
        }
      } else {
        return {
          ...prev,
          assignedSecretariats: [...current, secretariatName],
        }
      }
    })
  }

  const removeSecretariat = (secretariatName: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedSecretariats: prev.assignedSecretariats.filter((s) => s !== secretariatName),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit User" : "Add New User"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update user information"
              : "Create a new user account"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              placeholder="Enter full name"
              className={errors.fullName ? "border-red-500" : ""}
            />
            {errors.fullName && (
              <p className="text-sm text-red-500">{errors.fullName}</p>
            )}
          </div>

          {/* Mobile Number */}
          <div className="space-y-2">
            <Label htmlFor="mobileNumber">Mobile Number</Label>
            <Input
              id="mobileNumber"
              value={formData.mobileNumber}
              onChange={(e) =>
                setFormData({ ...formData, mobileNumber: e.target.value })
              }
              placeholder="Enter 10-digit mobile number"
              className={errors.mobileNumber ? "border-red-500" : ""}
              maxLength={10}
            />
            {errors.mobileNumber && (
              <p className="text-sm text-red-500">{errors.mobileNumber}</p>
            )}
            <p className="text-xs text-gray-500">
              10-digit mobile number (optional)
            </p>
          </div>

          {/* Role (only for create) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER",
                    mandalName: "",
                    assignedSecretariats: [],
                  })
                }
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="ADMIN">Admin</option>
                <option value="PANCHAYAT_SECRETARY">Panchayat Secretary</option>
                <option value="FIELD_OFFICER">Field Officer</option>
              </select>
            </div>
          )}

          {/* Mandal (for PANCHAYAT_SECRETARY) */}
          {formData.role === "PANCHAYAT_SECRETARY" && (
            <div className="space-y-2">
              <Label htmlFor="mandalName">
                Assigned Mandal <span className="text-red-500">*</span>
              </Label>
              {loadingMandals ? (
                <p className="text-sm text-gray-500">Loading mandals...</p>
              ) : (
                <select
                  id="mandalName"
                  value={formData.mandalName}
                  onChange={(e) =>
                    setFormData({ ...formData, mandalName: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-md ${
                    errors.mandalName ? "border-red-500" : ""
                  }`}
                >
                  <option value="">Select a mandal</option>
                  {mandals.map((mandal) => (
                    <option key={mandal.name} value={mandal.name}>
                      {mandal.name} ({mandal.residentCount.toLocaleString()} residents)
                    </option>
                  ))}
                </select>
              )}
              {errors.mandalName && (
                <p className="text-sm text-red-500">{errors.mandalName}</p>
              )}
            </div>
          )}

          {/* Assigned Secretariats (for FIELD_OFFICER) */}
          {formData.role === "FIELD_OFFICER" && (
            <div className="space-y-2">
              <Label>
                Assigned Secretariats <span className="text-red-500">*</span>
              </Label>

              {/* Selected Secretariats */}
              {formData.assignedSecretariats.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50">
                  {formData.assignedSecretariats.map((sec) => (
                    <div
                      key={sec}
                      className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                    >
                      <span>{sec}</span>
                      <button
                        type="button"
                        onClick={() => removeSecretariat(sec)}
                        className="hover:bg-orange-200 rounded-full p-0.5"
                      >
                        <span className="text-xs">×</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Secretariat Selection */}
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                {loadingSecretariats ? (
                  <p className="text-sm text-gray-500">Loading secretariats...</p>
                ) : secretariats.length === 0 ? (
                  <p className="text-sm text-gray-500">No secretariats found</p>
                ) : (
                  <div className="space-y-2">
                    {secretariats.map((sec) => (
                      <label
                        key={`${sec.mandalName}-${sec.name}`}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.assignedSecretariats.includes(sec.name)}
                          onChange={() => toggleSecretariat(sec.name)}
                          className="h-4 w-4 text-orange-600 rounded"
                        />
                        <span className="text-sm flex-1">
                          {sec.name} ({sec.mandalName})
                        </span>
                        <span className="text-xs text-gray-500">
                          {sec.residentCount.toLocaleString()}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {errors.assignedSecretariats && (
                <p className="text-sm text-red-500">{errors.assignedSecretariats}</p>
              )}
            </div>
          )}

          {/* Username (only for create) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Enter username"
                className={errors.username ? "border-red-500" : ""}
              />
              {errors.username && (
                <p className="text-sm text-red-500">{errors.username}</p>
              )}
            </div>
          )}

          {/* Password (only for create) */}
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter password"
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
                <p className="text-xs text-gray-500">
                  Min 8 chars, 1 uppercase, 1 number, 1 special character
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm password"
                  className={errors.confirmPassword ? "border-red-500" : ""}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          {/* Status (only for edit) */}
          {isEdit && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Status</Label>
                <p className="text-sm text-gray-500">
                  Enable or disable this officer account
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-orange-500 to-green-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{isEdit ? "Update Officer" : "Create Officer"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

