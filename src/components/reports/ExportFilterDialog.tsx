"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarIcon, X, Filter, RotateCcw } from "lucide-react"
import { format } from "date-fns"

export interface ExportFilters {
  startDate: Date | null
  endDate: Date | null
  mandals: string[]
  officers: string[]
  mobileStatus: "all" | "with" | "without"
  healthIdStatus: "all" | "with" | "without"
  ruralUrban: string[]
  completionRateMin: number
  completionRateMax: number
  maskUid: boolean
}

export interface OfficerOption {
  userId: string
  username: string
  name: string
  mandals: string[] // Array of mandal names this officer is assigned to
}

interface ExportFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyFilters: (filters: ExportFilters) => void
  availableMandals: string[]
  availableOfficers: OfficerOption[]
  exportFormat: "excel" | "csv"
}

export function ExportFilterDialog({
  open,
  onOpenChange,
  onApplyFilters,
  availableMandals,
  availableOfficers,
  exportFormat,
}: ExportFilterDialogProps) {
  // Track if we've initialized the filters for this dialog session
  const initializedRef = useRef(false)

  const [filters, setFilters] = useState<ExportFilters>({
    startDate: null,
    endDate: null,
    mandals: [],
    officers: [],
    mobileStatus: "all",
    healthIdStatus: "all",
    ruralUrban: ["rural", "urban"],
    completionRateMin: 0,
    completionRateMax: 100,
    maskUid: false,
  })

  // Initialize mandals and officers to "all" when dialog opens
  useEffect(() => {
    if (open && !initializedRef.current && availableMandals.length > 0) {
      console.log("Initializing Export Filter Dialog:")
      console.log("  Setting all", availableMandals.length, "mandals as selected")
      console.log("  Setting all", availableOfficers.length, "officers as selected")

      setFilters((prev) => ({
        ...prev,
        mandals: [...availableMandals],
        officers: availableOfficers.map((o) => o.userId), // Use userId instead of username
      }))
      initializedRef.current = true
    } else if (!open) {
      // Reset initialization flag when dialog closes
      initializedRef.current = false
    }
  }, [open, availableMandals, availableOfficers])

  const resetFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      mandals: [...availableMandals],
      officers: availableOfficers.map((o) => o.userId), // Use userId instead of username
      mobileStatus: "all",
      healthIdStatus: "all",
      ruralUrban: ["rural", "urban"],
      completionRateMin: 0,
      completionRateMax: 100,
      maskUid: false,
    })
  }

  const handleApply = () => {
    // Validate date range
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      alert("Start date must be before end date")
      return
    }

    onApplyFilters(filters)
    onOpenChange(false)
  }

  const toggleMandalSelection = (mandal: string) => {
    setFilters((prev) => {
      const isDeselecting = prev.mandals.includes(mandal)
      const newMandals = isDeselecting
        ? prev.mandals.filter((m) => m !== mandal)
        : [...prev.mandals, mandal]

      // Calculate which officers should be visible with the new mandal selection
      const newFilteredOfficers = getFilteredOfficers(newMandals)
      const newFilteredOfficerIds = newFilteredOfficers.map((o) => o.userId)

      // Keep only the officers that are still visible after the mandal change
      // This ensures that filters.officers only contains officers that are in the filtered list
      const newOfficers = prev.officers.filter((userId) =>
        newFilteredOfficerIds.includes(userId)
      )



      return {
        ...prev,
        mandals: newMandals,
        officers: newOfficers,
      }
    })
  }

  const toggleAllMandals = () => {
    setFilters((prev) => {
      const isDeselectingAll = prev.mandals.length === availableMandals.length
      const newMandals = isDeselectingAll ? [] : [...availableMandals]



      // Calculate which officers should be visible with the new mandal selection
      const newFilteredOfficers = getFilteredOfficers(newMandals)
      const newFilteredOfficerIds = newFilteredOfficers.map((o) => o.userId)

      // Keep only the officers that are still visible after the mandal change
      const newOfficers = prev.officers.filter((userId) =>
        newFilteredOfficerIds.includes(userId)
      )

      return {
        ...prev,
        mandals: newMandals,
        officers: newOfficers,
      }
    })
  }

  // Get filtered officers based on selected mandals
  const getFilteredOfficers = (selectedMandals: string[]) => {
    if (selectedMandals.length === 0) {
      // No mandals selected, show all officers
      return availableOfficers
    }

    // If all mandals are selected, show all officers
    if (selectedMandals.length === availableMandals.length) {
      return availableOfficers
    }

    // Filter officers based on their assigned mandals
    const filtered = availableOfficers.filter((officer) => {
      // If officer has no mandals assigned, always show them
      // (they're not restricted to specific mandals)
      if (!officer.mandals || officer.mandals.length === 0) {
        return true
      }

      // Officer has mandals assigned - show them only if they work in
      // at least one of the selected mandals
      return officer.mandals.some((mandal) => selectedMandals.includes(mandal))
    })

    return filtered
  }

  // Get currently filtered officers based on selected mandals
  const filteredOfficers = getFilteredOfficers(filters.mandals)

  // Calculate selected count
  const selectedOfficersCount = useMemo(() => {
    const count = filters.officers.filter((userId) =>
      filteredOfficers.some((o) => o.userId === userId)
    ).length

    console.log("=== Selected Officers Count Calculation ===")
    console.log("filters.officers.length:", filters.officers.length)
    console.log("filteredOfficers.length:", filteredOfficers.length)
    console.log("selectedOfficersCount:", count)
    console.log("Sample filters.officers (first 5):", filters.officers.slice(0, 5))
    console.log("Sample filteredOfficers userIds (first 5):", filteredOfficers.slice(0, 5).map(o => o.userId))

    return count
  }, [filters.officers, filteredOfficers])


  const toggleOfficerSelection = (userId: string) => {
    console.log("=== toggleOfficerSelection ===")
    console.log("userId:", userId)
    console.log("Current filters.officers length:", filters.officers.length)
    console.log("Is userId in filters.officers?", filters.officers.includes(userId))

    setFilters((prev) => {
      const newOfficers = prev.officers.includes(userId)
        ? prev.officers.filter((o) => o !== userId)
        : [...prev.officers, userId]

      console.log("New filters.officers length:", newOfficers.length)
      console.log("Action:", prev.officers.includes(userId) ? "REMOVE" : "ADD")

      return {
        ...prev,
        officers: newOfficers,
      }
    })
  }

  const toggleAllOfficers = () => {
    setFilters((prev) => {
      // Check if all filtered officers are selected
      const filteredUserIds = filteredOfficers.map((o) => o.userId)
      const allFilteredSelected = filteredUserIds.every((userId) =>
        prev.officers.includes(userId)
      )

      if (allFilteredSelected) {
        // Deselect all filtered officers
        return {
          ...prev,
          officers: prev.officers.filter((userId) => !filteredUserIds.includes(userId)),
        }
      } else {
        // Select all filtered officers (merge with existing selections)
        const newOfficers = [...new Set([...prev.officers, ...filteredUserIds])]
        return {
          ...prev,
          officers: newOfficers,
        }
      }
    })
  }

  const toggleRuralUrban = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      ruralUrban: prev.ruralUrban.includes(value)
        ? prev.ruralUrban.filter((r) => r !== value)
        : [...prev.ruralUrban, value],
    }))
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.startDate || filters.endDate) count++
    if (filters.mandals.length < availableMandals.length) count++
    if (filters.officers.length < availableOfficers.length) count++
    if (filters.mobileStatus !== "all") count++
    if (filters.healthIdStatus !== "all") count++
    if (filters.ruralUrban.length < 2) count++
    if (filters.completionRateMin > 0 || filters.completionRateMax < 100) count++
    return count
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-orange-600" />
            Export Filters - {exportFormat.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Apply filters to export only the data you need. {getActiveFilterCount()} filter(s) active.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Date Range</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDate || undefined}
                      onSelect={(date) => setFilters((prev) => ({ ...prev, startDate: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDate || undefined}
                      onSelect={(date) => setFilters((prev) => ({ ...prev, endDate: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {filters.startDate || filters.endDate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters((prev) => ({ ...prev, startDate: null, endDate: null }))}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear dates
              </Button>
            ) : null}
          </div>

          {/* Mandal Multi-Select */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Mandals ({filters.mandals.length} of {availableMandals.length} selected)
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllMandals}
                disabled={availableMandals.length === 0}
              >
                {filters.mandals.length === availableMandals.length && availableMandals.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableMandals.map((mandal) => (
                  <div key={mandal} className="flex items-center space-x-2">
                    <Checkbox
                      id={`mandal-${mandal}`}
                      checked={filters.mandals.includes(mandal)}
                      onCheckedChange={() => toggleMandalSelection(mandal)}
                    />
                    <label
                      htmlFor={`mandal-${mandal}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {mandal}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Field Officer Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Field Officers ({selectedOfficersCount} of {filteredOfficers.length} selected)
              </Label>
              <Button variant="outline" size="sm" onClick={toggleAllOfficers}>
                {filteredOfficers.every((o) => filters.officers.includes(o.userId)) && filteredOfficers.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            {filters.mandals.length > 0 && filteredOfficers.length === 0 ? (
              <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                No field officers assigned to the selected mandal(s)
              </div>
            ) : (
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredOfficers.map((officer) => (
                    <div key={officer.userId} className="flex items-center space-x-2">
                      <Checkbox
                        id={`officer-${officer.userId}`}
                        checked={filters.officers.includes(officer.userId)}
                        onCheckedChange={() => toggleOfficerSelection(officer.userId)}
                      />
                      <label
                        htmlFor={`officer-${officer.userId}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        title={`${officer.name} (${officer.username}) - ${officer.mandals.join(", ")}`}
                      >
                        {officer.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Data Completion Filters */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Data Completion</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Select
                  value={filters.mobileStatus}
                  onValueChange={(value: "all" | "with" | "without") =>
                    setFilters((prev) => ({ ...prev, mobileStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Records</SelectItem>
                    <SelectItem value="with">With Mobile Number</SelectItem>
                    <SelectItem value="without">Without Mobile Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ABHA ID</Label>
                <Select
                  value={filters.healthIdStatus}
                  onValueChange={(value: "all" | "with" | "without") =>
                    setFilters((prev) => ({ ...prev, healthIdStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Records</SelectItem>
                    <SelectItem value="with">With ABHA ID</SelectItem>
                    <SelectItem value="without">Without ABHA ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Rural/Urban Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Area Type</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rural"
                  checked={filters.ruralUrban.includes("rural")}
                  onCheckedChange={() => toggleRuralUrban("rural")}
                />
                <label htmlFor="rural" className="text-sm font-medium cursor-pointer">
                  Rural
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="urban"
                  checked={filters.ruralUrban.includes("urban")}
                  onCheckedChange={() => toggleRuralUrban("urban")}
                />
                <label htmlFor="urban" className="text-sm font-medium cursor-pointer">
                  Urban
                </label>
              </div>
            </div>
          </div>

          {/* Aadhaar UID Masking Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Aadhaar Number (UID)</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="maskUid"
                checked={filters.maskUid}
                onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, maskUid: checked as boolean }))}
              />
              <label htmlFor="maskUid" className="text-sm font-medium cursor-pointer">
                Mask Aadhaar numbers (show only last 4 digits)
              </label>
            </div>
            <p className="text-xs text-gray-500">
              When unchecked, full Aadhaar numbers will be exported. When checked, only last 4 digits will be visible.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
          <Button
            onClick={handleApply}
            className="bg-gradient-to-r from-orange-500 to-green-600"
            disabled={filters.mandals.length === 0 && filters.officers.length === 0}
          >
            Apply Filters & Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

