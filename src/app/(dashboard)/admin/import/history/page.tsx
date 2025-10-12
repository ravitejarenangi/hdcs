"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface ImportHistory {
  id: string
  fileName: string
  fileSize: number
  totalRecords: number
  successRecords: number
  failedRecords: number
  duplicateRecords: number
  importMode: string
  status: string
  importedAt: string
  importedBy: string
  username: string
}

export default function ImportHistoryPage() {
  const [history, setHistory] = useState<ImportHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/admin/import/history")

      if (!response.ok) {
        throw new Error("Failed to fetch import history")
      }

      const data = await response.json()
      setHistory(data)
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error("Failed to load import history")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            Success
          </Badge>
        )
      case "partial":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertCircle className="mr-1 h-3 w-3" />
            Partial
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getImportModeLabel = (mode: string) => {
    switch (mode) {
      case "add":
        return "Add New Only"
      case "update":
        return "Update Only"
      case "add_update":
        return "Add & Update"
      default:
        return mode
    }
  }

  return (
    <DashboardLayout requiredRole="ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Import History</h1>
            <p className="text-gray-600 mt-1">
              View all previous data imports
            </p>
          </div>
        </div>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
            <CardDescription>Last 50 import operations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No import history found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left font-semibold">Date & Time</th>
                      <th className="p-3 text-left font-semibold">File Name</th>
                      <th className="p-3 text-left font-semibold">Imported By</th>
                      <th className="p-3 text-left font-semibold">Mode</th>
                      <th className="p-3 text-right font-semibold">Total</th>
                      <th className="p-3 text-right font-semibold">Success</th>
                      <th className="p-3 text-right font-semibold">Failed</th>
                      <th className="p-3 text-right font-semibold">Duplicates</th>
                      <th className="p-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          {format(new Date(item.importedAt), "MMM dd, yyyy HH:mm")}
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{item.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {(item.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{item.importedBy}</p>
                            <p className="text-xs text-gray-500">@{item.username}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {getImportModeLabel(item.importMode)}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium">
                          {item.totalRecords}
                        </td>
                        <td className="p-3 text-right text-green-600 font-medium">
                          {item.successRecords}
                        </td>
                        <td className="p-3 text-right text-red-600 font-medium">
                          {item.failedRecords}
                        </td>
                        <td className="p-3 text-right text-yellow-600 font-medium">
                          {item.duplicateRecords}
                        </td>
                        <td className="p-3">
                          {getStatusBadge(item.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

