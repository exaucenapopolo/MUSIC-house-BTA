import { useState } from 'react';
import { Clock3, Music2, Play, Plus, Tag } from 'lucide-react';
import type { Service } from './domain';
import { formatXaf } from './domain';

function youtubeEmbedUrl(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('www.') ? 'https://' + raw : raw);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (/^\/(embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split('/').filter(Boolean)[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id)
      ? 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1'
      : '';
  } catch { return ''; }
}

export function getYouTubeEmbedUrl(value?: string): string {
  return youtubeEmbedUrl(value);
}

export default function ServiceCatalog({ role, rows, whatsappNumber, onBook, onAdd, onEdit, onToggle }: {
  role: string; rows: Service[]; whatsappNumber: string;
  onBook: (row: Service) => void; onAdd: () => void;
  onEdit: (row: Service) => void; onToggle: (row: Service) => void;
}) {
  const canManage = role === 'manager' || role === 'producer';
  const [selected, setSelected] = useState<Service | null>(null);
  const visible = rows.filter((row) => canManage || row.isActive);
  const phone = String(whatsappNumber || '').replace(/\D/g, '');
  const selectedYoutube = youtubeEmbedUrl(selected?.youtubeUrl);
  const selectedPrice = selected ? Math.round(Number(selected.priceXaf) * (100 - (Number(selected.discountPercent) || 0)) / 100) : 0;
  const waMessage = selected ? 'Bonjour MUSIC HOUSE BTA, je souhaite avoir des informations sur la prestation « ' + selected.name + ' » avant de réserver.' : 'Bonjour MUSIC HOUSE BTA, j’aimerais avoir des informations sur vos prestations.';

  return <>
    <header className="page-header">
      <div><span className="eyebrow">{canManage ? 'OFFRE DU STUDIO' : 'YOUNG FOREVER RECORDS'}</span>
        <h1>{canManage ? 'Catalogue des prestations' : 'Nos prestations'}</h1>
        <p>{canManage ? 'Présentez chaque service avec son affiche, sa vidéo, ses points forts et ses conditions.' : 'Explorez nos services, découvrez les réalisations en vidéo et choisissez l’accompagnement qui correspond à votre projet.'}</p>
      </div>
      {canManage && <div className="page-actions"><button className="button primary" onClick={onAdd}><Plus size={16}/> Nouvelle prestation</button></div>}
    </header>

    {!canManage && <div className="catalog-intro">
      <div><span className="eyebrow">VOTRE PROCHAIN SON COMMENCE ICI</span><h2>Une équipe, des idées, un son qui vous ressemble.</h2><p>Découvrez notre approche avant de choisir votre prestation. Chaque demande est étudiée par le studio avant confirmation du créneau.</p></div>
      <div className="catalog-intro-mark"><Music2 size={38}/><span>MUSIC HOUSE BTA</span></div>
    </div>}

    <div className="media-service-grid">
      {visible.map((row) => {
        const discount = Math.max(0, Math.min(90, Number(row.discountPercent) || 0));
        const finalPrice = Math.round(Number(row.priceXaf) * (100 - discount) / 100);
        return <article className="media-service-card" key={row.id}>
          <button className="media-service-cover" onClick={() => setSelected(row)} aria-label={'Découvrir ' + row.name}>
            {row.imageUrl ? <img src={row.imageUrl} alt={row.name} loading="lazy"/> : <div className="media-service-placeholder"><Music2 size={42}/><span>YOUNG FOREVER RECORDS</span></div>}
            <span className="media-service-cover-shade"/>
            <span className="media-service-category">{row.category}</span>
            {row.youtubeUrl && <span className="media-service-video"><Play size={14} fill="currentColor"/> Vidéo disponible</span>}
          </button>
          <div className="media-service-body">
            <div className="media-service-heading"><div><h3>{row.name}</h3><p>{row.description || 'Une prestation réalisée par notre équipe.'}</p></div></div>
            {Array.isArray(row.highlights) && row.highlights.length > 0 && <ul className="media-service-highlights">{row.highlights.slice(0,3).map((item,i)=><li key={i}>{item}</li>)}</ul>}
            <div className="media-service-bottom">
              <div className="media-service-price"><span>Tarif</span><strong>{formatXaf(finalPrice)}</strong>{discount > 0 && <small><s>{formatXaf(row.priceXaf)}</s> · -{discount}%</small>}</div>
              <button className="button secondary" onClick={() => setSelected(row)}>Découvrir <Play size={13}/></button>
            </div>
            {row.durationMinutes ? <div className="media-service-duration"><Clock3 size={13}/> Durée indicative : {row.durationMinutes} minutes</div> : null}
            {role === 'client' && <button className="button primary media-service-book" onClick={() => onBook(row)}>Demander cette prestation</button>}
            {canManage && <div className="media-service-admin"><span className={row.isActive ? 'service-live' : 'service-inactive'}>{row.isActive ? 'Visible aux artistes' : 'Masquée'}</span><button className="text-link" onClick={() => onEdit(row)}>Modifier</button><button className="text-link" onClick={() => onToggle(row)}>{row.isActive ? 'Masquer' : 'Publier'}</button></div>}
          </div>
        </article>;
      })}
    </div>
    {!visible.length && <div className="empty-state"><div className="empty-icon"><Music2 size={20}/></div><h3>Aucune prestation publiée</h3><p>Les prestations du studio apparaîtront ici dès leur publication.</p></div>}
    {!canManage && phone && <div className="catalog-contact"><div><b>Une question avant de réserver ?</b><p>Échangez directement avec l’équipe du studio sur WhatsApp.</p></div><a className="button secondary" href={'https://wa.me/' + phone + '?text=' + encodeURIComponent(waMessage)} target="_blank" rel="noreferrer">Contacter le studio</a></div>}

    {selected && <div className="modal-backdrop service-detail-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelected(null);}}>
      <section className="service-detail-modal" role="dialog" aria-modal="true" aria-label={selected.name}>
        <header className="service-detail-header"><div><span className="eyebrow">PRESTATION DU STUDIO</span><h2>{selected.name}</h2></div><button className="icon-button" onClick={()=>setSelected(null)} aria-label="Fermer">×</button></header>
        {selected.imageUrl && <div className="service-detail-image"><img src={selected.imageUrl} alt={selected.name}/></div>}
        {selectedYoutube && <div className="service-video-frame"><iframe src={selectedYoutube} title={'Présentation vidéo : ' + selected.name} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>}
        <div className="service-detail-content">
          <span className="service-category">{selected.category}</span>
          <p className="service-detail-description">{selected.description || 'Notre équipe vous accompagne pour donner vie à votre projet musical.'}</p>
          {Array.isArray(selected.highlights) && selected.highlights.length > 0 && <div className="service-detail-points"><h3>Ce qui est compris</h3>{selected.highlights.map((item,i)=><div key={i}><Tag size={14}/><span>{item}</span></div>)}</div>}
          <div className="service-detail-summary"><div><span>Tarif affiché</span><b>{formatXaf(selectedPrice)}</b></div><div><span>Durée indicative</span><b>{selected.durationMinutes ? selected.durationMinutes + ' min' : 'À convenir'}</b></div></div>
          <p className="service-detail-note">Après votre demande, le manager vérifie le créneau et vous indique le montant de l’acompte nécessaire pour confirmer votre présence.</p>
          <div className="service-detail-actions">
            {role === 'client' && <button className="button primary" onClick={()=>{const row=selected;setSelected(null);onBook(row);}}>Demander cette prestation</button>}
            {canManage && <button className="button primary" onClick={()=>{const row=selected;setSelected(null);onEdit(row);}}>Modifier la prestation</button>}
            {phone && <a className="button secondary" href={'https://wa.me/' + phone + '?text=' + encodeURIComponent(waMessage)} target="_blank" rel="noreferrer">Poser une question sur WhatsApp</a>}
          </div>
        </div>
      </section>
    </div>}
  </>;
}
