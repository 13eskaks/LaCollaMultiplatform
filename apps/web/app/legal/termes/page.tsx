import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termes d\'ús · LaColla',
}

export default function TermesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-blue-600 text-sm hover:underline mb-8 block">← Tornar a l'inici</Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">Termes d'ús</h1>
        <p className="text-gray-500 mb-10">Darrera actualització: {new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Acceptació dels termes</h2>
            <p>En accedir i utilitzar LaColla acceptes aquests termes d'ús. Si no estàs d'acord amb algun dels termes, et demanem que no facis ús del servei.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Descripció del servei</h2>
            <p>LaColla és una plataforma de gestió per a colles. El servei inclou la gestió de membres, events, votacions, anuncis, fòrum i altres eines de gestió interna.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Compte d'usuari</h2>
            <p>Ets responsable de mantenir la confidencialitat de les teves credencials d'accés i de totes les activitats que es realitzen amb el teu compte. Has de notificar-nos immediatament qualsevol ús no autoritzat del teu compte.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Contingut de l'usuari</h2>
            <p>Ets responsable del contingut que publiques a la plataforma. Queda prohibit publicar contingut il·legal, difamatori, pornogràfic, que inciti a l'odi o que vulneri drets de tercers.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Plans i pagaments</h2>
            <p>El pla Bàsic és gratuït. Els plans de pagament es renoven automàticament. Pots cancel·lar en qualsevol moment. No es realitzen reemborsaments per períodes ja facturats, excepte per errors del servei.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Limitació de responsabilitat</h2>
            <p>LaColla no es fa responsable de les pèrdues de dades degudes a fallades tècniques, la conducta dels usuaris, la disponibilitat del servei o qualsevol dany indirecte derivat de l'ús de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. Modificacions</h2>
            <p>Ens reservem el dret de modificar aquests termes en qualsevol moment. Les modificacions entraran en vigor 30 dies després de la seva publicació. El continued ús del servei implica l'acceptació dels nous termes.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. Contacte</h2>
            <p>Per a qualsevol consulta sobre aquests termes, contacta'ns a <a href="mailto:legal@lacolla.app" className="text-blue-600 hover:underline">legal@lacolla.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
