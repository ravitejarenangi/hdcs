"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
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
}

interface ExportFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyFilters: (filters: ExportFilters) => void
  availableMandals: string[]
  availableOfficers: string[]
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
  })

  // Initialize mandals and officers to "all" when dialog opens
  useEffect(() => {
    if (open && filters.mandals.length === 0 && availableMandals.length > 0) {
      setFilters((prev) => ({
        ...prev,
        mandals: [...availableMandals],
        officers: [...availableOfficers],
      }))
    }
  }, [open, availableMandals, availableOfficers, filters.mandals.length])

  const resetFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      mandals: [...availableMandals],
      officers: [...availableOfficers],
      mobileStatus: "all",
      healthIdStatus: "all",
      ruralUrban: ["rural", "urban"],
      completionRateMin: 0,
      completionRateMax: 100,
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
    setFilters((prev) => ({
      ...prev,
      mandals: prev.mandals.includes(mandal)
        ? prev.mandals.filter((m) => m !== mandal)
        : [...prev.mandals, mandal],
    }))
  }

  const toggleAllMandals = () => {
    setFilters((prev) => ({
      ...prev,
      mandals: prev.mandals.length === availableMandals.length ? [] : [...availableMandals],
    }))
  }

  const toggleOfficerSelection = (officer: string) => {
    setFilters((prev) => ({
      ...prev,
      officers: prev.officers.includes(officer)
        ? prev.officers.filter((o) => o !== officer)
        : [...prev.officers, officer],
    }))
  }

  const toggleAllOfficers = () => {
    setFilters((prev) => ({
      ...prev,
      officers: prev.officers.length === availableOfficers.length ? [] : [...availableOfficers],
    }))
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
              <Button variant="outline" size="sm" onClick={toggleAllMandals}>
                {filters.mandals.length === availableMandals.length ? "Deselect All" : "Select All"}
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
                Field Officers ({filters.officers.length} of {availableOfficers.length} selected)
              </Label>
              <Button variant="outline" size="sm" onClick={toggleAllOfficers}>
                {filters.officers.length === availableOfficers.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableOfficers.map((officer) => (
                  <div key={officer} className="flex items-center space-x-2">
                    <Checkbox
                      id={`officer-${officer}`}
                      checked={filters.officers.includes(officer)}
                      onCheckedChange={() => toggleOfficerSelection(officer)}
                    />
                    <label
                      htmlFor={`officer-${officer}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {officer}
                    </label>
                  </div>
                ))}
              </div>
            </div>
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
                <Label>Health ID</Label>
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
                    <SelectItem value="with">With Health ID</SelectItem>
                    <SelectItem value="without">Without Health ID</SelectItem>
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

