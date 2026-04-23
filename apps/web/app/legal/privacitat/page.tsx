import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de privacitat · LaColla',
}

export default function PrivacitatPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-blue-600 text-sm hover:underline mb-8 block">← Tornar a l'inici</Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">Política de privacitat</h1>
        <p className="text-gray-500 mb-10">Darrera actualització: {new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Responsable del tractament</h2>
            <p>LaColla és responsable del tractament de les dades personals que recopila a través d'aquesta plataforma. Si tens qualsevol dubte, pots contactar-nos a <a href="mailto:privacitat@lacolla.app" className="text-blue-600 hover:underline">privacitat@lacolla.app</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Dades que recopilem</h2>
            <p>Recopilem les dades que tu ens proporcioneu directament (nom, email, telèfon opcional), dades d'ús de la plataforma (events creats, vots emesos, missatges al fòrum), i dades tècniques bàsiques (adreça IP, dispositiu, sistema operatiu).</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Finalitat del tractament</h2>
            <p>Les dades es tracten per: prestar el servei de gestió de colles, comunicar-te novetats de la plataforma (amb el teu consentiment), millorar la plataforma a partir de dades agregades i anònimes, i complir les obligacions legals aplicables.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Els teus drets</h2>
            <p>Tens dret a accedir, rectificar i suprimir les teves dades, a la portabilitat de les dades, a oposar-te al tractament i a la limitació del tractament. Pots exercir aquests drets contactant-nos a <a href="mailto:privacitat@lacolla.app" className="text-blue-600 hover:underline">privacitat@lacolla.app</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Conservació de les dades</h2>
            <p>Les dades es conserven mentre mantingues el compte actiu. Un cop elimines el compte, les dades s'eliminen en un termini de 30 dies, excepte quan existeixi una obligació legal de conservació.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Proveïdors externs</h2>
            <p>Utilitzem Supabase per a l'emmagatzematge de dades (UE), Expo para les notificacions push, i Stripe per als pagaments. Tots ells compten amb les garanties adequades per al tractament de dades personals.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
