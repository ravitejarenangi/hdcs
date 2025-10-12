"use client"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-3 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs md:text-sm text-gray-600">
          {/* Copyright Section */}
          <div className="text-center md:text-left">
            <p>
              © {currentYear} All rights reserved by{" "}
              <span className="font-semibold text-gray-800">
                HEALTH, MEDICAL & FAMILY WELFARE DEPARTMENT
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

