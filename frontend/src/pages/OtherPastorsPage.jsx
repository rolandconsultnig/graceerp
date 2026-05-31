import { Link } from 'react-router-dom';
import { CHURCH_NAME, CHURCH_LOCATION, CHURCH_LOGO_SRC } from '../constants/branding';
import { OTHER_PASTORS, PRESIDING_PASTOR } from '../data/otherPastors';

function initials(name) {
  return name
    .replace(/^(Pastor|Rev\.|Deacon)\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PastorCard({ pastor }) {
  return (
    <article className="group rounded-2xl border border-[#C9973A]/25 bg-[#1a0f28]/80 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition hover:border-[#E8C46A]/45 hover:bg-[#221433]/90">
      <div className="mb-5 flex items-start gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-[#0F0816] shadow-inner"
          style={{ background: 'linear-gradient(135deg, #E8C46A, #C9973A)' }}
          aria-hidden
        >
          {initials(pastor.name)}
        </div>
        <div className="min-w-0">
          <h3
            className="text-lg font-semibold leading-snug text-[#FAF7F0]"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            {pastor.name}
          </h3>
          <p className="mt-1 text-sm font-medium text-[#E8C46A]">{pastor.title}</p>
          <p className="mt-1 text-xs text-[#FAF7F0]/55">{pastor.branch}</p>
        </div>
      </div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#C9973A]/90">
        {pastor.focus}
      </p>
      <p className="text-sm leading-relaxed text-[#FAF7F0]/72">{pastor.bio}</p>
    </article>
  );
}

export default function OtherPastorsPage() {
  return (
    <div
      className="min-h-screen text-[#FAF7F0]"
      style={{
        background: 'radial-gradient(ellipse at top, #2a1545 0%, #0F0816 55%, #08040f 100%)',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
      />

      <header className="border-b border-[#C9973A]/20 bg-[#0F0816]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={CHURCH_LOGO_SRC}
              alt=""
              className="h-12 w-12 rounded-lg bg-white p-1 object-contain ring-1 ring-[#C9973A]/30"
            />
            <div>
              <p
                className="text-sm font-semibold leading-tight text-[#FAF7F0] sm:text-base"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                {CHURCH_NAME}
              </p>
              <p className="text-xs text-[#E8C46A]/80">{CHURCH_LOCATION}</p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] sm:gap-5 sm:text-[11px]">
            <Link to="/" className="text-[#FAF7F0]/70 transition hover:text-[#E8C46A]">
              Home
            </Link>
            <Link to="/#pastor" className="text-[#FAF7F0]/70 transition hover:text-[#E8C46A]">
              Our Shepherd
            </Link>
            <Link to="/login" className="rounded-lg px-4 py-2 text-[#0F0816] shadow-md transition hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #E8C46A, #C9973A)', fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-12 max-w-3xl">
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#E8C46A]"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Leadership
          </p>
          <h1
            className="mb-4 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Our Pastoral Team
          </h1>
          <p className="text-base leading-relaxed text-[#FAF7F0]/75 sm:text-lg" style={{ fontFamily: "'Lora', Georgia, serif" }}>
            Alongside {PRESIDING_PASTOR.name}, our presiding pastor, these ministers and leaders shepherd
            branches, cells, and ministries across the DCC — one fold under one Shepherd.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#E8C46A] transition hover:text-[#FAF7F0]"
          >
            ← Meet our presiding pastor on the home page
          </Link>
        </div>

        <div className="mb-10 rounded-2xl border border-[#E8C46A]/30 bg-gradient-to-br from-[#2a1545]/80 to-[#1a0f28]/60 p-6 sm:p-8">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E8C46A]/90"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Leadership
          </p>
          <h2
            className="mt-3 text-2xl font-bold text-[#FAF7F0] sm:text-3xl"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            {PRESIDING_PASTOR.shepherdTitle}
          </h2>
          <p className="mt-2 text-sm font-medium text-[#E8C46A]">{PRESIDING_PASTOR.titleTag}</p>
          <p
            className="mt-4 text-xl font-semibold text-[#FAF7F0] sm:text-2xl"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            {PRESIDING_PASTOR.name}
          </p>
        </div>

        <h2
          className="mb-6 text-xl font-semibold text-[#E8C46A] sm:text-2xl"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          Other Pastors & Ministers
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_PASTORS.map((pastor) => (
            <PastorCard key={pastor.id} pastor={pastor} />
          ))}
        </div>

        <p
          className="mt-14 text-center text-sm italic text-[#FAF7F0]/50"
          style={{ fontFamily: "'Lora', Georgia, serif" }}
        >
          One Fold, One Shepherd · John 10:16
        </p>
      </main>
    </div>
  );
}
