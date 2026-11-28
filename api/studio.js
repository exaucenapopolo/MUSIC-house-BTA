import { randomBytes } from 'node:crypto';
import { getAdminServices } from './_lib/admin.js';

const MANAGER_EMAIL = String(process.env.MUSIC_HOUSE_MANAGER_EMAIL || 'exaucenapopolo2@gmail.com').trim().toLowerCase();
const APP_URL = String(process.env.APP_URL || process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '') || 'https://music-house-amber.vercel.app').replace(/\/$/, '');

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
  });
}

function dateLabel(value) {
  if (!value) return 'À préciser';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'À préciser';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Douala', dateStyle: 'full', timeStyle: 'short',
  }).format(date);
}

function emailHtml(title, intro, details, actionUrl, actionLabel, extraHtml) {
  const rows = (details || []).filter(function (item) { return item && item[1] !== undefined && item[1] !== null && item[1] !== ''; })
    .map(function (item) {
      return '<tr><td style="padding:10px 0;color:#64748b;font-size:12px;border-bottom:1px solid #edf0ec">' +
        escapeHtml(item[0]) + '</td><td align="right" style="padding:10px 0;color:#17231f;font-size:13px;font-weight:700;border-bottom:1px solid #edf0ec">' +
        escapeHtml(item[1]) + '</td></tr>';
    }).join('');
  const button = actionUrl ? '<p style="margin:24px 0 0"><a href="' + escapeHtml(actionUrl) +
    '" style="display:inline-block;padding:13px 20px;background:#a86a39;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px">' +
    escapeHtml(actionLabel || 'Ouvrir mon espace') + '</a></p>' : '';
  return '<!doctype html><html lang="fr"><meta charset="utf-8"><body style="margin:0;background:#f5f3ef;font-family:Arial,Helvetica,sans-serif;color:#20231f;padding:28px 12px">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">' +
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e9e4dc;border-radius:16px;overflow:hidden">' +
    '<tr><td style="padding:24px 28px;border-bottom:1px solid #f0ece6"><div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#a86a39">MUSIC HOUSE BTA</div><div style="margin-top:5px;font-size:11px;color:#879087">YOUNG FOREVER RECORDS · STUDIO YAOUNDÉ</div></td></tr>' +
    '<tr><td style="padding:28px"><h1 style="font-size:24px;line-height:1.35;margin:0 0 14px;color:#20231f">' + escapeHtml(title) +
    '</h1><p style="font-size:14px;line-height:1.75;color:#4b554d;margin:0 0 18px">' + escapeHtml(intro) + '</p>' +
    (rows ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf9f6;border:1px solid #eee9e0;border-radius:10px;padding:10px 16px">' + rows + '</table>' : '') +
    (extraHtml || '') + button + '<p style="margin:26px 0 0;color:#59645d;font-size:13px;line-height:1.7">Nous vous accompagnons à chaque étape de votre parcours musical.<br><strong>L’équipe MUSIC HOUSE BTA</strong></p></td></tr>' +
    '<tr><td style="padding:18px 28px;background:#faf9f6;border-top:1px solid #eee9e0;color:#899188;font-size:11px">Message automatique de suivi · MUSIC HOUSE BTA</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function getFromAddress() {
  const value = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (!value || /[\r\n]/.test(value)) throw new Error('RESEND_FROM_EMAIL est absente ou invalide.');
  const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
  if (emailPattern.test(value)) return 'MUSIC HOUSE BTA <' + value + '>';
  const match = value.match(/^([^<>\r\n]{1,80})<\s*([^<>\s]+)\s*>$/);
  if (match && emailPattern.test(match[2])) return match[1].trim() + ' <' + match[2] + '>';
  throw new Error('RESEND_FROM_EMAIL doit être une adresse valide ou « MUSIC HOUSE BTA <adresse@domaine> ».');
}

async function sendEmail(to, subject, html, idempotencyKey) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY est absente de la configuration serveur.');
  if (!to || !String(to).includes('@')) return { skipped: true };
  const headers = { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ from: getFromAddress(), to: [String(to)], subject: subject, html: html }),
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  const payload = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(String(payload.message || payload.error || 'Resend a répondu avec le statut ' + response.status).slice(0, 300));
  return { id: payload.id || null };
}

async function authenticate(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  const token = String(header || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    const error = new Error('Session Firebase requise.');
    error.status = 401;
    throw error;
  }
  const services = getAdminServices();
  const decoded = await services.auth.verifyIdToken(token);
  const account = await services.auth.getUser(decoded.uid);
  const profileSnap = await services.db.collection('users').doc(decoded.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  return {
    services: services,
    uid: decoded.uid,
    email: String(decoded.email || account.email || '').toLowerCase(),
    emailVerified: decoded.email_verified === true || account.emailVerified === true,
    role: ['manager', 'producer'].includes(String(decoded.role || account.customClaims && account.customClaims.role || '')) ? String(decoded.role || account.customClaims.role) : 'client',
    profile: profile,
  };
}

function requireRole(context, role) {
  if (context.role !== role) {
    const error = new Error('Cette opération est réservée au ' + (role === 'manager' ? 'manager du studio' : 'personnel autorisé') + '.');
    error.status = 403;
    throw error;
  }
}

async function getArtistContact(context, artistId, ownerUid) {
  let artist = null;
  if (artistId) {
    const snap = await context.services.db.collection('artists').doc(String(artistId)).get();
    if (snap.exists) artist = snap.data();
  }
  let user = null;
  const uid = ownerUid && ownerUid !== 'manual' ? ownerUid : artist && artist.ownerUid;
  if (uid && uid !== 'manual') {
    const snap = await context.services.db.collection('users').doc(String(uid)).get();
    if (snap.exists) user = snap.data();
  }
  return {
    artist: artist || {},
    email: String(user && user.email || artist && artist.email || '').trim(),
    name: String(artist && (artist.stageName || artist.fullName) || user && user.displayName || 'Artiste'),
  };
}

async function sendManagerEmail(subject, intro, details, key) {
  return sendEmail(MANAGER_EMAIL, subject,
    emailHtml(subject, intro, details, APP_URL, 'Ouvrir le tableau de bord'), key);
}

async function handleRequest(req, context, body) {
  const action = String(body.action || '');
  const db = context.services.db;

  if (action === 'bootstrapManager') {
    if (context.email !== MANAGER_EMAIL || !context.emailVerified) {
      const error = new Error('Le compte manager doit utiliser exactement ' + MANAGER_EMAIL + ' et son adresse doit être vérifiée dans Firebase.');
      error.status = 403;
      throw error;
    }
    const user = await context.services.auth.getUser(context.uid);
    const claims = Object.assign({}, user.customClaims || {}, { role: 'manager' });
    await context.services.auth.setCustomUserClaims(context.uid, claims);
    await db.collection('users').doc(context.uid).set({
      uid: context.uid, email: user.email || context.email, displayName: user.displayName || 'Manager',
      role: 'manager', active: true, manager: true,
      updatedAt: context.services.FieldValue.serverTimestamp(),
      createdAt: user.metadata && user.metadata.creationTime ? new Date(user.metadata.creationTime) : context.services.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { role: 'manager', refreshToken: true };
  }

  if (action === 'createProducer') {
    requireRole(context, 'manager');
    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail du producteur invalide.');
    if (email === MANAGER_EMAIL) throw new Error('Cette adresse est réservée au manager principal.');
    if (displayName.length < 2) throw new Error('Indiquez le nom du membre de l’équipe.');
    let user;
    try {
      user = await context.services.auth.getUserByEmail(email);
      if (user.customClaims && user.customClaims.role === 'manager') throw new Error('Ce compte possède déjà le rôle manager.');
    } catch (error) {
      if (error.message === 'Ce compte possède déjà le rôle manager.') throw error;
      if (error.code !== 'auth/user-not-found') throw error;
      user = await context.services.auth.createUser({
        email: email, displayName: displayName, password: randomBytes(32).toString('hex'),
        emailVerified: false, disabled: false,
      });
    }
    await context.services.auth.updateUser(user.uid, { displayName: displayName, disabled: false });
    await context.services.auth.setCustomUserClaims(user.uid, Object.assign({}, user.customClaims || {}, { role: 'producer' }));
    await db.collection('users').doc(user.uid).set({
      uid: user.uid, email: email, displayName: displayName, role: 'producer', active: true,
      invitedBy: context.uid, updatedAt: context.services.FieldValue.serverTimestamp(),
      createdAt: context.services.FieldValue.serverTimestamp(),
    }, { merge: true });
    const resetLink = await context.services.auth.generatePasswordResetLink(email, { url: APP_URL + '/login', handleCodeInApp: false });
    await sendEmail(email, 'Votre accès à MUSIC HOUSE BTA',
      emailHtml('Bienvenue dans l’équipe du studio', 'Votre compte producteur a été préparé par le manager. Définissez votre mot de passe à l’aide du lien sécurisé ci-dessous pour accéder à votre espace de travail.',
        [['Nom', displayName], ['Rôle', 'Producteur']], resetLink, 'Définir mon mot de passe'),
      'studio-producer-invite-' + user.uid);
    return { uid: user.uid, email: email, role: 'producer' };
  }

  if (action === 'welcome') {
    const snap = await db.collection('users').doc(context.uid).get();
    const profile = snap.exists ? snap.data() : {};
    const artistSnap = await db.collection('artists').doc(context.uid).get();
    const name = String(profile.displayName || artistSnap.exists && artistSnap.data().fullName || 'Artiste');
    await sendEmail(context.email, 'Bienvenue chez MUSIC HOUSE BTA',
      emailHtml('Bienvenue, ' + name, 'Votre espace artiste est prêt. Vous pouvez désormais mettre à jour votre profil, demander des séances, suivre vos projets et échanger avec notre équipe.', [
        ['Espace', 'Portail artiste'], ['Studio', 'Young Forever Records · Yaoundé'],
      ], APP_URL, 'Accéder à mon espace'), 'studio-welcome-' + context.uid);
    return { sent: true };
  }

  if (action === 'appointmentRequested') {
    const appointmentId = String(body.appointmentId || '');
    const snap = await db.collection('appointments').doc(appointmentId).get();
    if (!snap.exists) {
      const error = new Error('Rendez-vous introuvable.');
      error.status = 404; throw error;
    }
    const appointment = snap.data();
    if (context.role === 'client' && appointment.ownerUid !== context.uid) {
      const error = new Error('Cette demande de rendez-vous ne vous appartient pas.');
      error.status = 403; throw error;
    }
    if (context.role !== 'client' && context.role !== 'manager') {
      const error = new Error('Seul le manager peut créer un rendez-vous pour un artiste.');
      error.status = 403; throw error;
    }
    const contact = await getArtistContact(context, appointment.artistId, appointment.ownerUid);
    const recipient = contact.email || (context.role === 'client' ? context.email : '');
    const details = [['Artiste', appointment.artistName || contact.name], ['Prestation', appointment.serviceName],
      ['Date souhaitée', dateLabel(appointment.startsAt)], ['Statut', 'Demande reçue']];
    const tasks = [];
    if (recipient) tasks.push(sendEmail(recipient, 'Votre demande de rendez-vous a bien été reçue',
      emailHtml('Votre demande de rendez-vous est enregistrée', 'Le studio vérifie la disponibilité et vous adressera une confirmation dès que le rendez-vous aura été validé.', details, APP_URL, 'Suivre ma demande'),
      'studio-appointment-request-artist-' + appointmentId));
    if (context.role === 'client') tasks.push(sendManagerEmail('Nouvelle demande de rendez-vous',
      'Un artiste vient de soumettre une demande de séance. Elle attend la vérification du manager.', details,
      'studio-appointment-request-manager-' + appointmentId));
    await Promise.all(tasks);
    return { sent: tasks.length > 0, skipped: !recipient };
  }

  if (action === 'appointmentConfirmed') {
    requireRole(context, 'manager');
    const appointmentId = String(body.appointmentId || '');
    const snap = await db.collection('appointments').doc(appointmentId).get();
    if (!snap.exists) throw new Error('Rendez-vous introuvable.');
    const appointment = snap.data();
    const contact = await getArtistContact(context, appointment.artistId, appointment.ownerUid);
    if (!contact.email) return { sent: false, skipped: true, reason: 'Aucune adresse e-mail associée à cet artiste.' };
    const details = [['Artiste', appointment.artistName || contact.name], ['Prestation', appointment.serviceName],
      ['Date et heure', dateLabel(appointment.startsAt)], ['Producteur', appointment.producerName || 'À confirmer']];
    await sendEmail(contact.email, 'Votre rendez-vous est confirmé',
      emailHtml('Votre séance est confirmée', 'Le manager a validé votre rendez-vous. Votre créneau est désormais réservé au studio.', details, APP_URL, 'Consulter mon espace'),
      'studio-appointment-confirmed-' + appointmentId);
    return { sent: true };
  }

  if (action === 'managerMessage') {
    requireRole(context, 'manager');
    const artistId = String(body.artistId || '');
    const subject = String(body.subject || '').trim().slice(0, 160);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!subject || message.length < 2) throw new Error('Ajoutez un objet et un message.');
    const contact = await getArtistContact(context, artistId, null);
    if (!contact.email || !contact.email.includes('@')) throw new Error('Cet artiste ne possède pas d’adresse e-mail exploitable.');
    const html = emailHtml(subject, 'Bonjour ' + contact.name + ', vous avez reçu un message de l’équipe MUSIC HOUSE BTA.', [
      ['Objet', subject], ['Artiste', contact.name],
    ], APP_URL, 'Ouvrir mon espace',
      '<div style="margin:20px 0 0;padding:20px;background:#faf9f6;border:1px solid #eee9e0;border-radius:12px;white-space:pre-wrap;line-height:1.7;font-size:14px;color:#334155">' + escapeHtml(message) + '</div>');
    await sendEmail(contact.email, subject, html, 'studio-manager-message-' + artistId + '-' + Date.now());
    return { sent: true };
  }

  if (action === 'distributionRequested') {
    if (context.role !== 'client') {
      const error = new Error('Seul un artiste connecté peut soumettre une demande de publication.');
      error.status = 403; throw error;
    }
    const orderId = String(body.orderId || '');
    const snap = await db.collection('distributionOrders').doc(orderId).get();
    if (!snap.exists || snap.data().ownerUid !== context.uid || snap.data().status !== 'submitted') {
      const error = new Error('Cette demande de publication ne vous appartient pas ou n’est plus en attente.');
      error.status = 403; throw error;
    }
    const order = snap.data();
    const contact = await getArtistContact(context, order.artistId, context.uid);
    const details = [['Artiste', contact.name], ['Morceau / sortie', order.releaseTitle],
      ['Format', order.releaseType], ['Plateformes', order.platforms || 'À préciser'],
      ['Lien du morceau', order.releaseUrl || 'Non fourni']];
    await Promise.all([
      sendEmail(context.email, 'Votre demande de publication a été transmise',
        emailHtml('Votre demande est bien enregistrée', 'Le studio a reçu votre demande de publication. Le manager va vérifier les informations et vous tiendra au courant des prochaines étapes.', details, APP_URL, 'Suivre ma demande'),
        'studio-distribution-request-artist-' + orderId),
      sendManagerEmail('Nouvelle demande de publication', 'Un artiste demande la mise en distribution d’un morceau. Consultez la demande dans le tableau de bord.', details,
        'studio-distribution-request-manager-' + orderId),
    ]);
    return { sent: true };
  }

  if (action === 'distributionStatus') {
    requireRole(context, 'manager');
    const orderId = String(body.orderId || '');
    const snap = await db.collection('distributionOrders').doc(orderId).get();
    if (!snap.exists) throw new Error('Demande de publication introuvable.');
    const order = snap.data();
    const contact = await getArtistContact(context, order.artistId, order.ownerUid);
    if (!contact.email) return { sent: false, skipped: true, reason: 'Aucune adresse e-mail associée à cet artiste.' };
    const labelMap = { checking: 'En cours de vérification', accepted: 'Acceptée par le studio', published: 'Publication effectuée', rejected: 'Non retenue', withdrawn: 'Retirée' };
    const label = labelMap[String(body.status || order.status)] || String(body.status || order.status);
    await sendEmail(contact.email, 'Mise à jour de votre demande de publication',
      emailHtml('Le suivi de votre morceau a évolué', 'Le manager a mis à jour le traitement de votre demande. Consultez le détail ci-dessous.', [
        ['Morceau / sortie', order.releaseTitle], ['Nouveau statut', label], ['Plateformes', order.platforms || 'À préciser'],
      ], APP_URL, 'Consulter mon espace'),
      'studio-distribution-status-' + orderId + '-' + String(body.status || order.status));
    return { sent: true };
  }

  const error = new Error('Action inconnue.');
  error.status = 400;
  throw error;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }
  try {
    const context = await authenticate(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await handleRequest(req, context, body);
    return res.status(200).json({ success: true, result: result });
  } catch (error) {
    const status = Number(error && error.status) || (error && String(error.code || '').startsWith('auth/') ? 401 : 400);
    if (status >= 500) console.error('[MUSIC HOUSE API]', error && error.message || error);
    return res.status(status).json({ success: false, error: String(error && error.message || 'Une erreur est survenue.').slice(0, 400) });
  }
}
