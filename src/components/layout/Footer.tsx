"use client"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-3 py-1.5 md:px-4 lg:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-1 text-[10px] md:text-xs text-gray-600">
          {/* Copyright Section */}
          <div className="text-center md:text-left">
            <p>
              © {currentYear} All rights reserved by{" "}
              <span className="font-semibold text-gray-800">
                HEALTH, MEDICAL & FAMILY WELFARE DEPARTMENT, A.P
              </span>
            </p>
          </div>

          {/* Developed By Section */}
          <div className="text-center md:text-right">
            <p>
              Developed and maintained by{" "}
              <span className="font-semibold text-gray-800">
                DRDA Technical Team, Chittoor
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

