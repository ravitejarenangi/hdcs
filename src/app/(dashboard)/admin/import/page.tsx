"use client"

import { useState, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
  History,
} from "lucide-react"
import * as XLSX from "xlsx"

interface PreviewData {
  headers: string[]
  rows: unknown[][]
}

interface ImportResult {
  totalRecords: number
  successRecords: number
  failedRecords: number
  duplicateRecords: number
  errors: Array<{ row: number; error: string }>
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<"add" | "update" | "add_update">("add_update")
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0]
    if (!uploadedFile) return

    // Validate file type
    const fileExtension = uploadedFile.name.split(".").pop()?.toLowerCase()
    if (!["csv", "xlsx", "xls"].includes(fileExtension || "")) {
      toast.error("Invalid file type. Please upload CSV or Excel files only.")
      return
    }

    // Validate file size (max 10MB)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.")
      return
    }

    setFile(uploadedFile)
    setImportResult(null)

    // Generate preview
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) return

        let parsedData: unknown[][] = []

        if (fileExtension === "csv") {
          const text = data as string
          const rows = text.split("\n").map((row) => row.split(","))
          parsedData = rows
        } else {
          const workbook = XLSX.read(data, { type: "binary" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          parsedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
        }

        if (parsedData.length > 0) {
          setPreview({
            headers: parsedData[0] as string[],
            rows: parsedData.slice(1, 11), // First 10 rows
          })
        }
      } catch (error) {
        console.error("Preview error:", error)
        toast.error("Failed to preview file")
      }
    }

    if (fileExtension === "csv") {
      reader.readAsText(uploadedFile)
    } else {
      reader.readAsBinaryString(uploadedFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  })

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file to import")
      return
    }

    setIsUploading(true)
    setImportResult(null)

    try {
      toast.loading("Importing data...", { id: "import-loading" })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("importMode", importMode)

      const response = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Import failed")
      }

      const result: ImportResult = await response.json()
      setImportResult(result)

      if (result.failedRecords === 0) {
        toast.success(
          `Successfully imported ${result.successRecords} record(s)`,
          { id: "import-loading", duration: 5000 }
        )
      } else if (result.successRecords > 0) {
        toast.warning(
          `Partially imported: ${result.successRecords} success, ${result.failedRecords} failed`,
          { id: "import-loading", duration: 5000 }
        )
      } else {
        toast.error(`Import failed: ${result.failedRecords} record(s) failed`, {
          id: "import-loading",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to import data", {
        id: "import-loading",
        duration: 5000,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setImportResult(null)
  }

  const downloadTemplate = () => {
    const template = [
      [
        "resident_id",
        "uid",
        "hh_id",
        "name",
        "dob",
        "gender",
        "mobile_number",
        "health_id",
        "mandal_name",
        "phc_name",
        "rural_urban",
        "age",
      ],
      [
        "RES001",
        "123456789012",
        "HH001",
        "John Doe",
        "1990-01-01",
        "MALE",
        "9876543210",
        "HEALTH001",
        "Mandal1",
        "PHC1",
        "rural",
        "34",
      ],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template")

    XLSX.writeFile(workbook, "resident_import_template.xlsx")
    toast.success("Template downloaded successfully")
  }

  return (
    <DashboardLayout requiredRole="ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Data Import</h1>
            <p className="text-gray-600 mt-1">
              Bulk import resident data from CSV or Excel files
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button
              onClick={() => window.location.href = "/admin/import/history"}
              variant="outline"
              className="border-gray-300"
            >
              <History className="mr-2 h-4 w-4" />
              Import History
            </Button>
          </div>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Upload a CSV or Excel file containing resident data. Maximum file size: 10MB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-300 hover:border-orange-400 hover:bg-gray-50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              {isDragActive ? (
                <p className="text-lg text-orange-600">Drop the file here...</p>
              ) : (
                <div>
                  <p className="text-lg text-gray-700 mb-2">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported formats: CSV, XLSX, XLS
                  </p>
                </div>
              )}
            </div>

            {/* Selected File */}
            {file && (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-600">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Remove
                </Button>
              </div>
            )}

            {/* Import Mode */}
            <div className="space-y-2">
              <Label>Import Mode</Label>
              <Select value={importMode} onValueChange={(value: "add" | "update" | "add_update") => setImportMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add New Only (Skip Existing)</SelectItem>
                  <SelectItem value="update">Update Existing Only (Skip New)</SelectItem>
                  <SelectItem value="add_update">Add & Update (Upsert)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {importMode === "add" && "Only new residents will be added. Existing residents will be skipped."}
                {importMode === "update" && "Only existing residents will be updated. New residents will be skipped."}
                {importMode === "add_update" && "New residents will be added and existing residents will be updated."}
              </p>
            </div>

            {/* Import Button */}
            <Button
              onClick={handleImport}
              disabled={!file || isUploading}
              className="w-full bg-gradient-to-r from-orange-500 to-green-600"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Import Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>First 10 rows of the uploaded file</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      {preview.headers.map((header, index) => (
                        <th key={index} className="border p-2 text-left font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {(row as unknown[]).map((cell, cellIndex) => (
                          <td key={cellIndex} className="border p-2">
                            {String(cell || "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Result */}
        {importResult && (
          <Card className={`border-2 ${
            importResult.failedRecords === 0
              ? "border-green-200 bg-green-50"
              : importResult.successRecords > 0
              ? "border-yellow-200 bg-yellow-50"
              : "border-red-200 bg-red-50"
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.failedRecords === 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : importResult.successRecords > 0 ? (
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                Import Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold">{importResult.totalRecords}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Success</p>
                  <p className="text-2xl font-bold text-green-600">{importResult.successRecords}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{importResult.failedRecords}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duplicates</p>
                  <p className="text-2xl font-bold text-yellow-600">{importResult.duplicateRecords}</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Errors (showing first 10):</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((error, index) => (
                      <p key={index} className="text-sm text-red-600">
                        Row {error.row}: {error.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

