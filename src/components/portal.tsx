"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, Bookmark, BriefcaseBusiness, Check, ChevronDown, Clock3, ExternalLink, GraduationCap, MapPin, Menu, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users, X } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { getDeadline } from "@/lib/opportunities";

const SAVED_KEY = "oportunia-saved";
const ALERT_KEY = "oportunia-alert";

function opportunityDeadline(opportunity: Opportunity) {
  const deadline = getDeadline(opportunity.closingDate);
  return opportunity.status === "closed" ? { ...deadline, closed: true, urgent: false, label: "Convocatoria cerrada" } : deadline;
}

export function TrackOpportunity({ id }: { id: string }) {
  useEffect(() => { trackEvent("view", id); }, [id]);
  return null;
}

function trackEvent(name: "view" | "official_click" | "save", opportunityId: string) {
  const params = new URLSearchParams(window.location.search);
  void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, opportunityId, source: params.get("utm_source") || undefined, medium: params.get("utm_medium") || undefined, campaign: params.get("utm_campaign") || undefined, content: params.get("utm_content") || undefined }), keepalive: true }).catch(() => {});
}

export function OfficialLink({ id, url, demo, closed }: { id: string; url: string; demo: boolean; closed: boolean }) {
  return <a className="button button-primary official-button" href={url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("official_click", id)}>{demo ? "Visitar entidad oficial" : closed ? "Consultar fuente oficial" : "Ir a la fuente oficial"}<ExternalLink size={17} /></a>;
}

export function AdSlot() {
  return <aside className="ad-slot" aria-label="Espacio publicitario reservado"><span>Publicidad</span><small>Espacio reservado · Sin anuncios por ahora</small></aside>;
}

export function Brand() {
  return <Link href="/" className="brand" aria-label="Oportunia, inicio"><Image src="/logo_oportunia.png" alt="Logotipo de Oportunia" width={180} height={60} priority style={{ width: "auto", height: "38px" }} /></Link>;
}

export function Header() {
  const pathname = usePathname();
  const opportunitiesActive = pathname === "/" || pathname.startsWith("/convocatorias/");
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState(false);
  return <><header className="site-header"><div className="container header-inner"><Brand /><nav className={open ? "navigation is-open" : "navigation"} aria-label="Navegación principal"><Link href="/#oportunidades" className={opportunitiesActive ? "nav-current" : undefined} aria-current={opportunitiesActive ? "page" : undefined} onClick={() => setOpen(false)}>Oportunidades</Link><Link href="/como-funciona" className={pathname === "/como-funciona" ? "nav-current" : undefined} aria-current={pathname === "/como-funciona" ? "page" : undefined} onClick={() => setOpen(false)}>Cómo funciona</Link><Link href="/guardadas" className={`saved-nav ${pathname === "/guardadas" ? "nav-current" : ""}`} aria-current={pathname === "/guardadas" ? "page" : undefined} onClick={() => setOpen(false)}><Bookmark size={17} /> Guardadas</Link></nav><button className="button button-primary header-alert" onClick={() => setAlert(true)}><Bell size={16} /> Crear mi alerta</button><button className="icon-button mobile-menu" aria-label="Abrir navegación" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div></header><AlertDialog open={alert} onClose={() => setAlert(false)} /></>;
}

export function Footer() {
  return <footer className="site-footer"><div className="container footer-main"><div><Brand /><p>Oportunidades claras.<br />Decisiones informadas.</p></div><div className="footer-note"><span>Hecho para tu próximo paso, en Perú.</span><p>Oportunia reúne información. La postulación siempre se realiza en la fuente oficial.</p></div><Link href="/como-funciona">Conoce cómo funciona <ArrowUpRight size={15} /></Link></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Oportunia</span><span>Sin cobros a postulantes. Con información que importa.</span><Link href="/admin">Acceso editorial</Link></div></footer>;
}

export function AlertDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [done, setDone] = useState(false);
  useEffect(() => { if (open) { setDone(false); dialog.current?.showModal(); } else dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="alert-dialog"><button className="icon-button dialog-close" aria-label="Cerrar" onClick={onClose}><X size={21} /></button>{done ? <div className="alert-success"><span className="feature-icon"><Check size={28} /></span><h2 id={titleId}>Tu próximo paso, más cerca.</h2><p>Guardamos tus preferencias en este navegador. El envío de alertas estará disponible próximamente.</p><button className="button button-primary" onClick={onClose}>Seguir explorando <ArrowRight size={17} /></button></div> : <><span className="feature-icon"><Bell size={24} /></span><p className="eyebrow">A TU MEDIDA</p><h2 id={titleId}>Que tu oportunidad<br />te encuentre.</h2><p>Elige qué te interesa. Por ahora guardaremos tus preferencias en este dispositivo, sin enviar correos.</p><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { localStorage.setItem(ALERT_KEY, JSON.stringify(Object.fromEntries(data))); setDone(true); } catch { window.alert("No pudimos guardar tus preferencias. Revisa el almacenamiento del navegador."); } }}><label>Carrera o perfil<input name="career" placeholder="Ej. Administración, Ingeniería…" required /></label><label>Región<select name="region"><option>Todo el Perú</option><option>Lima</option><option>Arequipa</option><option>Cusco</option><option>La Libertad</option><option>Piura</option></select></label><label>Modalidad<select name="modality"><option>Cualquier modalidad</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select></label><button className="button button-primary" type="submit">Guardar mis preferencias <ArrowRight size={17} /></button><small>Sin registro. Puedes cambiarlas cuando quieras.</small></form></>}</dialog>;
}

function useSaved() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => { try { const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); if (Array.isArray(value)) setSaved(value.filter((item): item is string => typeof item === "string")); } catch { /* Invalid stored preferences are ignored. */ } }, []);
  function toggle(id: string) {
    const adding = !saved.includes(id);
    const next = adding ? [...saved, id] : saved.filter((item) => item !== id);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* Session state still works if browser storage is disabled. */ }
    if (adding) trackEvent("save", id);
  }
  return { saved, toggle };
}

export function SaveButton({ id }: { id: string }) {
  const { saved, toggle } = useSaved();
  return <button className="button button-secondary" aria-pressed={saved.includes(id)} onClick={() => toggle(id)}><Bookmark size={17} fill={saved.includes(id) ? "currentColor" : "none"} />{saved.includes(id) ? "Guardada" : "Guardar convocatoria"}</button>;
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="button button-secondary" onClick={async () => { try { if (navigator.share) await navigator.share({ title, url: window.location.href }); else { await navigator.clipboard.writeText(window.location.href); setCopied(true); } } catch { setCopied(false); } }}><ArrowUpRight size={17} />{copied ? "Enlace copiado" : "Compartir"}</button>;
}

function HeroArt() {
  return <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-dot dot-one" /><div className="art-dot dot-two" /><div className="art-star">✳</div><div className="floating-tag tag-profile"><span className="tag-check"><Check size={13} /></span>Tu perfil tiene potencial</div><div className="hero-job"><div className="hero-job-top"><span className="mini-entity"><GraduationCap size={25} /></span><span className="tiny-status">TU PRÓXIMO PASO</span><Bookmark size={16} /></div><h3>Ese lugar donde<br />quieres crecer.</h3><div className="hero-job-tags"><span>Tu carrera</span><span>Tu región</span></div><div className="hero-job-bottom"><span><span className="live-dot" />Nuevas posibilidades</span><span className="art-arrow"><ArrowUpRight size={23} /></span></div></div><div className="floating-tag tag-source"><ShieldCheck size={21} /><div><strong>Una fuente. Más confianza.</strong><span>La información para decidir.</span></div></div><div className="art-caption">EL FUTURO EMPIEZA CON UN PASO</div></div>;
}

export function OpportunityCard({ opportunity, saved, onSave }: { opportunity: Opportunity; saved: boolean; onSave: () => void }) {
  const deadline = opportunityDeadline(opportunity);
  const entityName = opportunity.entityShort || opportunity.entity.slice(0, 3).toUpperCase();
  return <article className="opportunity-card"><div className="card-top"><div className="entity-mark" style={{ "--entity-color": opportunity.color || "#1459b8" } as React.CSSProperties}>{entityName.slice(0, 7)}</div><div className="entity-name"><strong>{opportunity.entity}</strong><span>{opportunity.isDemo ? "Ejemplo editorial" : "Fuente revisada"}{!opportunity.isDemo && <ShieldCheck size={12} />}</span></div><button className={`icon-button bookmark-button ${saved ? "is-saved" : ""}`} aria-label={saved ? `Quitar ${opportunity.title} de guardadas` : `Guardar ${opportunity.title}`} aria-pressed={saved} onClick={onSave}><Bookmark size={19} fill={saved ? "currentColor" : "none"} /></button></div><div className="card-type"><span className={opportunity.type === "Prácticas" ? "badge badge-blue" : "badge"}>{opportunity.type === "Prácticas" ? <GraduationCap size={12} /> : <BriefcaseBusiness size={11} />}{opportunity.type}</span>{opportunity.featured && <span className="featured-label"><Sparkles size={11} />Destacada</span>}</div><h3><Link href={`/convocatorias/${opportunity.slug}`}>{opportunity.title}</Link></h3><p className="card-summary">{opportunity.summary}</p><div className="card-facts"><span><MapPin size={14} />{opportunity.region}<span className="fact-dot">·</span>{opportunity.modality}</span><span><Users size={14} />{opportunity.vacancies} {opportunity.vacancies === 1 ? "vacante" : "vacantes"}{opportunity.salary && <><span className="fact-dot">·</span><strong>{opportunity.salary}</strong></>}</span></div><div className="card-footer"><span className={`deadline ${deadline.closed ? "deadline-closed" : deadline.urgent ? "deadline-urgent" : ""}`}><Clock3 size={13} />{deadline.label}</span><Link href={`/convocatorias/${opportunity.slug}`}>Ver convocatoria <ArrowUpRight size={15} /></Link></div></article>;
}

export function OpportunityExplorer({ opportunities, onlySaved = false }: { opportunities: Opportunity[]; onlySaved?: boolean }) {
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [region, setRegion] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [career, setCareer] = useState("");
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alert, setAlert] = useState(false);
  const { saved, toggle } = useSaved();
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const regions = [...new Set(opportunities.map((opportunity) => opportunity.region))].sort();
  const levels = [...new Set(opportunities.map((opportunity) => opportunity.level))].filter(Boolean).sort();
  const careers = [...new Set(opportunities.flatMap((opportunity) => opportunity.careers))].sort();
  const visible = opportunities.filter((opportunity) => (!onlySaved || saved.includes(opportunity.id)) && (!query || normalize(`${opportunity.title} ${opportunity.entity} ${opportunity.careers.join(" ")}`).includes(normalize(query))) && (!region || opportunity.region === region) && (!types.length || types.includes(opportunity.type)) && (!modalities.length || modalities.includes(opportunity.modality)) && (!level || opportunity.level === level) && (!career || opportunity.careers.includes(career)) && (tab !== "closing" || (!opportunityDeadline(opportunity).closed && opportunityDeadline(opportunity).days <= 7)) && (tab !== "internships" || opportunity.type === "Prácticas"));
  visible.sort((a, b) => sort === "closing" ? a.closingDate.localeCompare(b.closingDate) : sort === "recent" ? (b.publishedAt || "").localeCompare(a.publishedAt || "") : Number(b.featured) - Number(a.featured));
  const activeFilters = types.length + modalities.length + Number(Boolean(region)) + Number(Boolean(level)) + Number(Boolean(career)) + Number(Boolean(query));
  function clear() { setQuery(""); setSearchInput(""); setRegion(""); setTypes([]); setModalities([]); setLevel(""); setCareer(""); setTab("all"); }
  function toggleFilter(value: string, items: string[], set: (items: string[]) => void) { set(items.includes(value) ? items.filter((item) => item !== value) : [...items, value]); }
  return <><Header />{!onlySaved ? <section className="hero"><div className="container hero-inner"><div className="hero-copy"><div className="hero-eyebrow"><span className="peru-flag" /> TALENTO PERUANO, NUEVAS POSIBILIDADES</div><h1>Tu próximo paso<br />empieza <span>aquí.</span></h1><p>Empleos, prácticas y oportunidades en Perú.<br className="desktop-break" /> La información que necesitas, para decidir a tiempo.</p><div className="hero-benefits"><span><ShieldCheck size={15} /> Fuentes oficiales</span><span><Clock3 size={15} /> Fechas claras</span><span><Check size={15} /> Sin costo para ti</span></div></div><HeroArt /><form className="hero-search" onSubmit={(event) => { event.preventDefault(); setQuery(searchInput); document.getElementById("oportunidades")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }}><label className="search-text"><Search size={21} /><span className="sr-only">Buscar por puesto, entidad o carrera</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="¿Qué oportunidad estás buscando?" /></label><label className="search-region"><MapPin size={19} /><span className="sr-only">Región</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">Todo el Perú</option>{regions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><button className="button button-primary" type="submit">Buscar oportunidades <ArrowRight size={17} /></button></form></div></section> : <section className="saved-hero container"><p className="eyebrow">TU ESPACIO</p><h1>Un paso más cerca.</h1><p>Tus oportunidades guardadas, reunidas aquí. Se conservan en este navegador.</p></section>}
    <div className="trust-strip"><div className="container"><span><span className="live-dot" />{opportunities.some((opportunity) => opportunity.isDemo) ? "Estás explorando nuestro catálogo de ejemplo" : "Oportunidades con información editorial"}</span><Link href="/como-funciona">Tu confianza es el punto de partida <ArrowRight size={13} /></Link></div></div>
    <main className="container catalog" id="oportunidades"><div className="catalog-heading"><div><p className="eyebrow">ENCUENTRA TU SIGUIENTE OPORTUNIDAD</p><h2>{onlySaved ? "Tus convocatorias guardadas" : "Un mundo de posibilidades."}</h2><p>{onlySaved ? "Vuelve a revisar los plazos antes de postular." : "Explora por tu perfil. Elige con información. Da el siguiente paso."}</p></div><span className="catalog-stamp"><span className="stamp-line" /><span>El talento está en ti.<br /><strong>El próximo paso, aquí.</strong></span></span></div>
    <div className="catalog-layout"><aside className={`filters ${filtersOpen ? "filters-open" : ""}`}><div className="filter-heading"><h3><SlidersHorizontal size={16} />Afina tu búsqueda</h3><button onClick={clear} disabled={!activeFilters}>Limpiar</button></div><fieldset><legend>Tipo de oportunidad</legend>{["Empleo público", "Prácticas", "Empleo privado", "Becas y programas"].map((item) => <label className="checkbox-label" key={item}><input type="checkbox" checked={types.includes(item)} onChange={() => toggleFilter(item, types, setTypes)} /><span>{item}</span><small>{opportunities.filter((opportunity) => opportunity.type === item).length}</small></label>)}</fieldset><fieldset><legend>Ubicación</legend><label className="select-control"><MapPin size={15} /><select aria-label="Filtrar por región" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">Todo el Perú</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label></fieldset><fieldset><legend>Modalidad</legend>{["Presencial", "Híbrido", "Remoto"].map((item) => <label className="checkbox-label" key={item}><input type="checkbox" checked={modalities.includes(item)} onChange={() => toggleFilter(item, modalities, setModalities)} /><span>{item}</span></label>)}</fieldset><fieldset><legend>Tu perfil</legend><label className="select-control"><select aria-label="Filtrar por nivel" value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Todos los niveles</option>{levels.map((item) => <option key={item}>{item}</option>)}</select></label><label className="select-control"><select aria-label="Filtrar por carrera" value={career} onChange={(event) => setCareer(event.target.value)}><option value="">Todas las carreras</option>{careers.map((item) => <option key={item}>{item}</option>)}</select></label></fieldset><div className="sidebar-alert"><span className="alert-bell"><Bell size={22} /></span><h3>Tu oportunidad.<br />En el momento justo.</h3><p>Guarda tus preferencias para encontrar lo que va contigo.</p><button onClick={() => setAlert(true)}>Crear mi alerta <ArrowRight size={15} /></button><small>Preferencias locales · Envíos próximamente</small></div></aside>
    <section className="results" aria-label="Resultados de convocatorias"><div className="results-tabs"><div role="group" aria-label="Selección rápida"><button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>Todas <span>{onlySaved ? opportunities.filter((opportunity) => saved.includes(opportunity.id)).length : opportunities.length}</span></button><button className={tab === "closing" ? "active" : ""} onClick={() => setTab("closing")}><Clock3 size={14} />Cierran pronto</button><button className={tab === "internships" ? "active" : ""} onClick={() => setTab("internships")}>Prácticas</button></div><button className="mobile-filter-button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} />Filtros</button></div><div className="results-toolbar"><p aria-live="polite"><strong>{visible.length}</strong> {visible.length === 1 ? "oportunidad para explorar" : "oportunidades para explorar"}{query && <span> para “{query}”</span>}</p><label>Ordenar:<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Destacadas</option><option value="closing">Próximos cierres</option><option value="recent">Más recientes</option></select><ArrowDown size={12} /></label></div>{activeFilters > 0 && <div className="active-filters"><span>{activeFilters} {activeFilters === 1 ? "filtro activo" : "filtros activos"}</span><button onClick={clear}>Quitar filtros <X size={12} /></button></div>}
    {visible.length ? <div className="opportunities-grid">{visible.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} saved={saved.includes(opportunity.id)} onSave={() => toggle(opportunity.id)} />)}</div> : <div className="empty-state"><Search size={31} /><h3>{onlySaved && !saved.length ? "Tu próxima oportunidad merece un lugar." : "Todavía no hay coincidencias."}</h3><p>{onlySaved && !saved.length ? "Toca el marcador de cualquier convocatoria para encontrarla aquí." : "Prueba con otra carrera, entidad o región. A veces el próximo paso está donde menos lo esperas."}</p>{onlySaved && !saved.length ? <Link className="button button-primary" href="/">Explorar oportunidades <ArrowRight size={16} /></Link> : <button className="button button-secondary" onClick={clear}>Limpiar filtros</button>}</div>}
    {visible.length > 0 && <div className="results-end"><span />Llegaste al final. Tu próximo paso está en tus manos.<span /></div>}<div className="catalog-help"><ShieldCheck size={26} /><div><strong>Información clara, decisiones tuyas.</strong><p>Revisa siempre las bases y los plazos en la fuente oficial antes de postular.</p></div><Link href="/como-funciona" aria-label="Cómo funciona Oportunia"><ArrowUpRight size={21} /></Link></div><AdSlot /></section></div></main><section className="bottom-cta container"><div className="cta-decoration"><Bell size={31} /><span /></div><div><p className="eyebrow">QUE LO BUENO NO SE TE PASE</p><h2>Tu próximo capítulo merece una oportunidad.</h2><p>Define tu perfil y prepárate para encontrar lo que sigue.</p></div><button className="button button-primary" onClick={() => setAlert(true)}>Crear mi alerta <ArrowRight size={17} /></button></section><Footer /><AlertDialog open={alert} onClose={() => setAlert(false)} /></>;
}
