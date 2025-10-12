"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { X } from "lucide-react"

interface Officer {
  id: string
  username: string
  fullName: string
  mobileNumber?: string | null
  assignedSecretariats?: string | null
  isActive: boolean
}

interface OfficerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  officer?: Officer | null
  onSuccess: () => void
}

interface Secretariat {
  name: string
  residentCount: number
}

export default function OfficerDialog({
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
    assignedSecretariats: [] as string[],
    isActive: true,
  })

  const [secretariats, setSecretariats] = useState<Secretariat[]>([])
  const [loadingSecretariats, setLoadingSecretariats] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Fetch secretariats
  useEffect(() => {
    if (open) {
      fetchSecretariats()
    }
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
          assignedSecretariats: [],
          isActive: true,
        })
      }
      setErrors({})
    }
  }, [open, officer])

  const fetchSecretariats = async () => {
    try {
      setLoadingSecretariats(true)
      const response = await fetch("/api/panchayat/secretariats")

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

    // Validate assigned secretariats
    if (formData.assignedSecretariats.length === 0) {
      newErrors.assignedSecretariats = "At least one secretariat must be assigned"
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

      // Validate password
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
      if (formData.password !== formData.confirmPassword) {
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

    try {
      setLoading(true)

      if (isEdit) {
        // Update existing officer
        const response = await fetch(`/api/panchayat/officers/${officer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formData.fullName,
            mobileNumber: formData.mobileNumber.trim() || null,
            assignedSecretariats: formData.assignedSecretariats,
            isActive: formData.isActive,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update officer")
        }

        toast.success("Officer updated successfully")
      } else {
        // Create new officer
        const response = await fetch("/api/panchayat/officers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formData.fullName,
            username: formData.username,
            mobileNumber: formData.mobileNumber.trim() || null,
            password: formData.password,
            assignedSecretariats: formData.assignedSecretariats,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create officer")
        }

        toast.success("Officer created successfully")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Submit error:", error)
      toast.error(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Field Officer" : "Add New Field Officer"}
          </DialogTitle>
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
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Enter full name"
              className={errors.fullName ? "border-red-500" : ""}
            />
            {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
          </div>

          {/* Mobile Number */}
          <div className="space-y-2">
            <Label htmlFor="mobileNumber">Mobile Number</Label>
            <Input
              id="mobileNumber"
              value={formData.mobileNumber}
              onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
              placeholder="Enter 10-digit mobile number"
              className={errors.mobileNumber ? "border-red-500" : ""}
              maxLength={10}
            />
            {errors.mobileNumber && (
              <p className="text-sm text-red-500">{errors.mobileNumber}</p>
            )}
            <p className="text-xs text-gray-500">10-digit mobile number (optional)</p>
          </div>

          {/* Username (only for create) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                className={errors.username ? "border-red-500" : ""}
              />
              {errors.username && <p className="text-sm text-red-500">{errors.username}</p>}
              <p className="text-xs text-gray-500">
                At least 4 characters, letters, numbers, and underscores only
              </p>
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
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
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

          {/* Assigned Secretariats */}
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
                      <X className="h-3 w-3" />
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
                <p className="text-sm text-gray-500">No secretariats found in your mandal</p>
              ) : (
                <div className="space-y-2">
                  {secretariats.map((sec) => (
                    <label
                      key={sec.name}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignedSecretariats.includes(sec.name)}
                        onChange={() => toggleSecretariat(sec.name)}
                        className="h-4 w-4 text-orange-600 rounded"
                      />
                      <span className="text-sm flex-1">{sec.name}</span>
                      <span className="text-xs text-gray-500">
                        ({sec.residentCount.toLocaleString()} residents)
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {errors.assignedSecretariats && (
              <p className="text-sm text-red-500">{errors.assignedSecretariats}</p>
            )}
            <p className="text-xs text-gray-500">
              Select one or more secretariats to assign to this officer
            </p>
          </div>

          {/* Active Status (only for edit) */}
          {isEdit && (
            <div className="flex items-center justify-between p-4 border rounded-md">
              <div>
                <Label htmlFor="isActive">Active Status</Label>
                <p className="text-sm text-gray-500">
                  Inactive officers cannot log in to the system
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-green-600 text-white"
            >
              {loading ? "Saving..." : isEdit ? "Update Officer" : "Create Officer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

