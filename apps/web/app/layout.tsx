import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LaColla · Gestiona la teua colla',
  description: 'La plataforma digital per gestionar colles: events, membres, votacions, forum i molt més.',
  openGraph: {
    title: 'LaColla',
    description: 'La plataforma digital per a colles valencianes i catalanes.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
