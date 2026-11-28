import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRight, Camera, ImagePlus, MapPin, Music2, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import type { StudioGalleryItem, StudioProfile, StudioTeamMember } from './domain';
import { uploadStudioImage } from './cloudinary';

const EMPTY_PROFILE: StudioProfile = {
  id: 'music-house-bta',
  name: 'Young Forever Records',
  slogan: 'Donnez vie à votre son.',
  description: '',
  location: 'Yaoundé, Cameroun',
  whatsappNumber: '',
  achievements: [],
  team: [],
  gallery: [],
};

export default function StudioProfilePage({ role, profile, bookingWhatsappNumber, onSave, onGoToServices }: {
  role: string;
  profile: StudioProfile | null;
  bookingWhatsappNumber?: string;
  onSave: (profile: StudioProfile) => Promise<void>;
  onGoToServices: () => void;
}) {
  const editable = role === 'manager';
  const [draft, setDraft] = useState<StudioProfile>(profile || EMPTY_PROFILE);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setDraft(profile || EMPTY_PROFILE); }, [profile]);

  function set<K extends keyof StudioProfile>(key: K, value: StudioProfile[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function uploadBrandImage(event: ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'coverUrl') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(field); setNotice('');
    try {
      const url = await uploadStudioImage(file, 'studio-profile');
      set(field, url);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Téléversement impossible.'); }
    finally { setUploading(''); }
  }
  async function uploadTeamPhoto(event: ChangeEvent<HTMLInputElement>, id: string) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading('team-' + id); setNotice('');
    try {
      const photoUrl = await uploadStudioImage(file, 'studio-team');
      set('team', (draft.team || []).map(member => member.id === id ? { ...member, photoUrl } : member));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Téléversement impossible.'); }
    finally { setUploading(''); }
  }
  async function addGallery(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length) return;
    setUploading('gallery'); setNotice('');
    try {
      const uploads = await Promise.all(files.map(async file => ({
        id: crypto.randomUUID(), url: await uploadStudioImage(file, 'studio-gallery'),
        caption: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      })));
      set('gallery', [...(draft.gallery || []), ...uploads]);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Une image de la galerie n’a pas pu être téléversée.'); }
    finally { setUploading(''); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) { setNotice('Le nom du studio est obligatoire.'); return; }
    setBusy(true); setNotice('');
    try {
      await onSave({
        ...draft, id: 'music-house-bta',
        achievements: (draft.achievements || []).filter(Boolean),
        team: draft.team || [], gallery: draft.gallery || [],
      });
      setNotice('Le profil public du studio a été enregistré.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  function addMember() {
    set('team', [...(draft.team || []), { id: crypto.randomUUID(), name: '', title: '', bio: '', photoUrl: '' }]);
  }
  function updateMember(id: string, patch: Partial<StudioTeamMember>) {
    set('team', (draft.team || []).map(member => member.id === id ? { ...member, ...patch } : member));
  }
  function removeMember(id: string) { set('team', (draft.team || []).filter(member => member.id !== id)); }
  function updateGallery(id: string, caption: string) {
    set('gallery', (draft.gallery || []).map(item => item.id === id ? { ...item, caption } : item));
  }
  function removeGallery(id: string) { set('gallery', (draft.gallery || []).filter(item => item.id !== id)); }

  const phone = String(profile?.whatsappNumber || bookingWhatsappNumber || '').replace(/\D/g, '');
  const contactText = 'Bonjour ' + (profile?.name || EMPTY_PROFILE.name) + ', je souhaite obtenir des informations sur le studio et vos prestations.';
  const publicProfile = profile || EMPTY_PROFILE;

  return <div className="studio-profile-page">
    <header className="page-header">
      <div><span className="eyebrow">IDENTITÉ & CONFIANCE</span><h1>{editable ? 'Profil du studio' : 'Notre studio'}</h1>
        <p>{editable ? 'Présentez votre studio, votre équipe et vos réalisations aux artistes.' : 'Découvrez le studio, les personnes qui vous accompagnent et quelques-unes de leurs réalisations.'}</p>
      </div>
      {editable && <span className="studio-profile-private"><ShieldCheck size={14}/> Modification réservée au manager</span>}
    </header>

    {editable ? <form className="studio-profile-editor" onSubmit={save}>
      <div className="studio-profile-hero-editor">
        <div className="studio-cover-editor" style={draft.coverUrl ? { backgroundImage: 'linear-gradient(90deg,rgba(15,17,24,.68),rgba(15,17,24,.08)),url(' + draft.coverUrl + ')' } : undefined}>
          <div><span className="eyebrow">IMAGE DE COUVERTURE</span><strong>{draft.name || 'Votre studio'}</strong><small>Une image qui représente votre identité musicale</small></div>
          <label className="button secondary"><Camera size={15}/> {uploading === 'coverUrl' ? 'Téléversement…' : 'Choisir la couverture'}<input hidden type="file" accept="image/*" onChange={event=>void uploadBrandImage(event,'coverUrl')}/></label>
        </div>
        <div className="studio-logo-editor">
          <div className="studio-logo-preview">{draft.logoUrl ? <img src={draft.logoUrl} alt="Logo du studio"/> : <span>LOGO</span>}</div>
          <div><b>Logo officiel</b><small>PNG ou JPG · 8 Mo maximum</small><label className="text-link">Téléverser le logo<input hidden type="file" accept="image/*" onChange={event=>void uploadBrandImage(event,'logoUrl')}/></label></div>
        </div>
      </div>

      <section className="settings-card">
        <div className="settings-card-header"><div><h3>Présentation générale</h3><p>Ces informations seront visibles par les artistes dans l’espace client.</p></div><span className="studio-editor-step">01 · IDENTITÉ</span></div>
        <div className="form-grid">
          <label className="field-wrap">Nom du studio<input className="field" value={draft.name} onChange={e=>set('name',e.target.value)} required/></label>
          <label className="field-wrap">Slogan<input className="field" value={draft.slogan || ''} onChange={e=>set('slogan',e.target.value)} placeholder="Une phrase qui représente votre studio"/></label>
          <label className="field-wrap">Ville / localisation<input className="field" value={draft.location || ''} onChange={e=>set('location',e.target.value)} placeholder="Yaoundé, Cameroun"/></label>
          <label className="field-wrap">WhatsApp du studio<input className="field" type="tel" value={draft.whatsappNumber || ''} onChange={e=>set('whatsappNumber',e.target.value)} placeholder="+237 6XX XX XX XX"/></label>
          <label className="field-wrap span-two">Description<textarea className="field textarea" rows={5} value={draft.description || ''} onChange={e=>set('description',e.target.value)} placeholder="Présentez votre studio, votre approche, votre équipement et ce qui vous distingue…"/></label>
          <label className="field-wrap span-two">Réalisations et références (une par ligne)<textarea className="field textarea" rows={4} value={(draft.achievements || []).join('\n')} onChange={e=>set('achievements',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))} placeholder="Singles accompagnés, clips, artistes, projets livrés…"/></label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header"><div><h3>Notre équipe</h3><p>Ajoutez le manager, les producteurs et les autres personnes qui accompagnent les artistes.</p></div><button type="button" className="button secondary" onClick={addMember}><Plus size={15}/> Ajouter un membre</button></div>
        <div className="studio-team-editor">
          {(draft.team || []).map(member=><div className="studio-team-edit-row" key={member.id}>
            <div className="studio-team-edit-photo">{member.photoUrl ? <img src={member.photoUrl} alt=""/> : <Users size={22}/>}<label title="Photo du membre"><Camera size={13}/><input hidden type="file" accept="image/*" onChange={event=>void uploadTeamPhoto(event,member.id)}/></label></div>
            <div className="studio-team-edit-fields">
              <input className="field" aria-label="Nom du membre" value={member.name} placeholder="Nom complet" onChange={e=>updateMember(member.id,{name:e.target.value})}/>
              <input className="field" aria-label="Fonction du membre" value={member.title} placeholder="Manager, Producteur, Ingénieur son…" onChange={e=>updateMember(member.id,{title:e.target.value})}/>
              <textarea className="field textarea" aria-label="Présentation du membre" rows={2} value={member.bio || ''} placeholder="Quelques mots sur son rôle…" onChange={e=>updateMember(member.id,{bio:e.target.value})}/>
            </div>
            <button type="button" className="icon-button danger-icon" onClick={()=>removeMember(member.id)} title="Retirer de la présentation"><Trash2 size={16}/></button>
          </div>)}
          {!draft.team?.length && <p className="small-note">Aucun membre présenté pour le moment. Ajoutez les personnes qui accompagnent les artistes.</p>}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header"><div><h3>Galerie et réalisations visuelles</h3><p>Ajoutez des flyers, photos du studio, pochettes, extraits d’événements et visuels de projets.</p></div><label className="button secondary"><ImagePlus size={15}/> {uploading === 'gallery' ? 'Téléversement…' : 'Ajouter des images'}<input hidden type="file" accept="image/*" multiple onChange={event=>void addGallery(event)}/></label></div>
        <div className="studio-gallery-editor">
          {(draft.gallery || []).map(item=><div className="studio-gallery-edit-card" key={item.id}><img src={item.url} alt={item.caption || 'Réalisation du studio'}/><input className="field" value={item.caption || ''} onChange={e=>updateGallery(item.id,e.target.value)} placeholder="Légende du visuel"/><button type="button" className="text-link" onClick={()=>removeGallery(item.id)}>Retirer</button></div>)}
          {!draft.gallery?.length && <p className="small-note">La galerie est vide. Les images que vous ajoutez ici seront présentées sur le profil public du studio.</p>}
        </div>
      </section>
      {notice && <div className={notice.includes('enregistré') ? 'alert success' : 'alert error'}>{notice}</div>}
      <div className="studio-save-bar"><span>Le profil public n’est modifié qu’après l’enregistrement.</span><button className="button primary" type="submit" disabled={busy || Boolean(uploading)}><Save size={16}/>{busy ? 'Enregistrement…' : 'Enregistrer le profil du studio'}</button></div>
    </form> : <>
      <section className="studio-public-hero">
        <div className="studio-public-cover" style={publicProfile.coverUrl ? { backgroundImage: 'linear-gradient(90deg,rgba(15,17,24,.78),rgba(15,17,24,.12)),url(' + publicProfile.coverUrl + ')' } : undefined}>
          <div className="studio-public-logo">{publicProfile.logoUrl ? <img src={publicProfile.logoUrl} alt="Logo"/> : <span><Music2 size={28}/></span>}</div>
          <div className="studio-public-hero-text"><span className="eyebrow">STUDIO DE PRODUCTION MUSICALE</span><h2>{publicProfile.name}</h2><p>{publicProfile.slogan || 'Donnez vie à votre son.'}</p></div>
        </div>
        <div className="studio-public-actions"><span><MapPin size={15}/>{publicProfile.location || 'Yaoundé, Cameroun'}</span><button className="button primary" onClick={onGoToServices}>Découvrir les prestations <ArrowUpRight size={15}/></button></div>
      </section>
      <section className="studio-public-section"><span className="eyebrow">QUI SOMMES-NOUS ?</span><h2>Un studio pensé pour votre musique.</h2><p className="studio-public-description">{publicProfile.description || 'Notre équipe accompagne les artistes dans la création, la production et la mise en valeur de leurs projets musicaux.'}</p>
        {!!publicProfile.achievements?.length && <div className="studio-achievements">{publicProfile.achievements.map((item,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{item}</p></div>)}</div>}
      </section>
      {!!publicProfile.team?.length && <section className="studio-public-section"><span className="eyebrow">LES PERSONNES DERRIÈRE LE SON</span><h2>Notre équipe</h2><div className="studio-public-team">{publicProfile.team.map(member=><article key={member.id}><div className="studio-member-photo">{member.photoUrl ? <img src={member.photoUrl} alt={member.name}/> : <Users size={26}/>}</div><div><h3>{member.name}</h3><b>{member.title}</b><p>{member.bio}</p></div></article>)}</div></section>}
      {!!publicProfile.gallery?.length && <section className="studio-public-section"><span className="eyebrow">EN IMAGES</span><h2>Quelques réalisations</h2><div className="studio-public-gallery">{publicProfile.gallery.map(item=><figure key={item.id}><img src={item.url} alt={item.caption || 'Réalisation du studio'}/>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div></section>}
      <section className="studio-public-contact"><div><span className="eyebrow">UN PROJET EN TÊTE ?</span><h2>Parlons de votre prochain morceau.</h2><p>Consultez nos prestations ou contactez directement l’équipe du studio.</p></div><div><button className="button primary" onClick={onGoToServices}>Voir les prestations</button>{phone && <a className="button secondary" href={'https://wa.me/' + phone + '?text=' + encodeURIComponent(contactText)} target="_blank" rel="noreferrer">Contacter sur WhatsApp</a>}</div></section>
    </>}
  </div>;
}
