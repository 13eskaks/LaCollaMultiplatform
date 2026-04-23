import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'LaColla Admin',
  robots: 'noindex, nofollow',
}

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',      icon: '📊' },
  { href: '/colles',        label: 'Colles',          icon: '🌩' },
  { href: '/usuaris',       label: 'Usuaris',         icon: '👥' },
  { href: '/anunciants',    label: 'Anunciants',      icon: '📢' },
  { href: '/subscripcions', label: 'Subscripcions',   icon: '💳' },
  { href: '/beta',          label: 'Beta',            icon: '🧪' },
  { href: '/log',           label: 'Log d\'accions',  icon: '📋' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body className="bg-gray-50 min-h-screen">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-5 border-b border-gray-100">
              <p className="font-bold text-gray-900">LaColla</p>
              <p className="text-xs text-gray-400">Panell d'administració</p>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-100">
              <a href="/auth/signout" className="text-xs text-gray-400 hover:text-gray-600">
                Tancar sessió
              </a>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
