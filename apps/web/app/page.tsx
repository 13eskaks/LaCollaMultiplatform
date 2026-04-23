import Link from 'next/link'

const FEATURES = [
  { icon: '📢', title: 'Anuncis i comunicats', desc: 'Informa tots els membres de les novetats de la colla en un clic.' },
  { icon: '📅', title: 'Gestió d\'events', desc: 'Crea, comparteix i controla l\'assistència als actes de la colla.' },
  { icon: '🗳️', title: 'Votacions', desc: 'Pren decisions de forma democràtica i transparent. Sí/No o múltiples opcions.' },
  { icon: '💬', title: 'Fòrum intern', desc: 'Espai de conversa per a membres. Fils de debat, anuncis fixats i molt més.' },
  { icon: '👥', title: 'Directori de membres', desc: 'Coneix qui forma la colla. Junta, nous membres i historial d\'ingressos.' },
  { icon: '🧹', title: 'Torns de neteja', desc: 'Organitza i assigna els torns automàticament. Notificació automàtica al responsable.' },
  { icon: '💶', title: 'Caixa i quotes', desc: 'Registra ingressos i despeses. Gestiona les quotes anuals dels membres.' },
  { icon: '📸', title: 'Galeria de fotos', desc: 'Guarda els millors moments de la colla. Comparteix i descarrega fàcilment.' },
]

const PLANS = [
  {
    name: 'Bàsic',
    price: 'Gratuït',
    period: '',
    desc: 'Per a colles que comencen',
    features: ['Fins a 30 membres', 'Events i assistència', 'Anuncis interns', 'Fòrum bàsic'],
    cta: 'Crea la teua colla',
    href: '/auth/register',
    highlighted: false,
  },
  {
    name: 'Colla Pro',
    price: 'Des de 9,99€',
    period: '/mes',
    desc: 'Per a colles actives',
    features: ['Membres il·limitats', 'Tots els mòduls', 'Votacions avançades', 'Galeria il·limitada', 'Suport prioritari'],
    cta: 'Prova 30 dies gratis',
    href: '/auth/register?pla=pro',
    highlighted: true,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌩</span>
            <span className="text-xl font-bold text-gray-900">LaColla</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#funcions" className="hover:text-gray-900">Funcions</a>
            <a href="#preus" className="hover:text-gray-900">Preus</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2">
              Entrar
            </Link>
            <Link href="/auth/register" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Crea la teua colla
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-blue-50 to-white text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-blue-100 text-blue-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            La plataforma per a colles valencianes i catalanes
          </span>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Gestiona la teua colla<br />
            <span className="text-blue-600">sense esforç</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 leading-relaxed">
            Des dels events fins a les votacions, des dels torns fins a la caixa.
            Tot el que necessita la teua colla en una sola app.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-lg font-semibold px-8 py-4 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
            >
              Comença gratis →
            </Link>
            <a
              href="#funcions"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 text-lg font-semibold px-8 py-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
            >
              Veure funcions
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-4">Sense targeta de crèdit · Cancel·la quan vulgues</p>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-12 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-12 text-center">
          {[
            { num: '+200', label: 'Colles registrades' },
            { num: '+8.000', label: 'Membres actius' },
            { num: '+15.000', label: 'Events gestionats' },
          ].map(({ num, label }) => (
            <div key={label}>
              <p className="text-4xl font-bold text-gray-900">{num}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funcions" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Tot el que necessita la teua colla</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">Una plataforma completa per gestionar cada aspecte de la teua colla de manera senzilla i moderna.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-2xl p-6 hover:bg-blue-50 transition group">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-700">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App mockup section */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wide">App mòbil nativa</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-6">Disponible per a iOS i Android</h2>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              La nostra app mòbil permet als membres estar sempre connectats amb la colla.
              Notificacions en temps real, accés als events i participació en votacions
              des del teu telèfon.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Notificacions push instantànies',
                'Funcionament offline',
                'Interfície en català i valencià',
                'Disseny intuïtiu per a tothom',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <span className="text-blue-600 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-800 transition">
                <span className="text-xl"></span> App Store
              </div>
              <div className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-800 transition">
                <span className="text-xl">▶</span> Google Play
              </div>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="w-64 h-[520px] bg-gray-900 rounded-[48px] p-3 shadow-2xl relative">
              <div className="w-full h-full bg-gradient-to-b from-blue-600 to-blue-800 rounded-[38px] overflow-hidden flex flex-col items-center justify-center gap-4 p-6">
                <span className="text-6xl">🌩</span>
                <p className="text-white text-2xl font-bold">LaColla</p>
                <p className="text-blue-200 text-sm text-center">La teua colla al teu abast</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="preus" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Preus senzills i transparents</h2>
            <p className="text-xl text-gray-500">Comença gratis. Creix quan la teua colla creixi.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border-2 relative ${plan.highlighted
                  ? 'border-blue-600 bg-blue-600 text-white shadow-2xl shadow-blue-600/30'
                  : 'border-gray-200 bg-white'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                    MÉS POPULAR
                  </span>
                )}
                <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                  {plan.desc}
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={plan.highlighted ? 'text-blue-200' : 'text-gray-500'}>{plan.period}</span>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-3 text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                      <span className={plan.highlighted ? 'text-white font-bold' : 'text-blue-600 font-bold'}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-semibold transition ${plan.highlighted
                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-4 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Preparat per digitalitzar la teua colla?</h2>
          <p className="text-xl text-blue-200 mb-10">Uneix-te a les colles que ja gestionen el seu dia a dia amb LaColla.</p>
          <Link
            href="/auth/register"
            className="inline-block bg-white text-blue-600 text-lg font-bold px-10 py-4 rounded-xl hover:bg-blue-50 transition shadow-xl"
          >
            Crea la teua colla gratis →
          </Link>
          <p className="text-sm text-blue-300 mt-4">30 dies de prova gratuïts · Sense compromís</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌩</span>
            <span className="text-white font-bold">LaColla</span>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm justify-center">
            <Link href="/legal/privacitat" className="hover:text-white transition">Privacitat</Link>
            <Link href="/legal/termes" className="hover:text-white transition">Termes d'ús</Link>
            <a href="mailto:hola@lacolla.app" className="hover:text-white transition">Contacte</a>
          </nav>
          <p className="text-sm">© {new Date().getFullYear()} LaColla · Fet amb ❤️ al País Valencià</p>
        </div>
      </footer>
    </div>
  )
}
