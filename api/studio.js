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
  const value = String(process.env.RESEND_FROM_EMAIL || '').trim().replace(/,\s*$/, '');
  if (!value || /[\r\n]/.test(value)) throw new Error('RESEND_FROM_EMAIL est absente ou invalide.');
  const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
  if (emailPattern.test(value)) return 'MUSIC HOUSE BTA <' + value + '>';
  const match = value.match(/^([^<>\r\n]{1,80})<\s*([^<>\s]+)\s*>$/);
  if (match && emailPattern.test(match[2])) return match[1].trim() + ' <' + match[2] + '>';
  throw new Error('RESEND_FROM_EMAIL doit être une adresse valide ou « MUSIC HOUSE BTA <adresse@domaine> ».');
}

async function sendEmail(to, subject, html, idempotencyKey) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY est absente de la configuration serveur Vercel.');
  if (!to || !String(to).includes('@')) throw new Error('Adresse e-mail destinataire invalide.');
  const from = getFromAddress();
  const headers = { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers,
      body: JSON.stringify({ from, to: [String(to).trim()], subject, html }),
      signal: AbortSignal.timeout(12000), cache: 'no-store',
    });
  } catch (error) {
    throw new Error('Impossible de joindre Resend : ' + String(error && error.message || error).slice(0, 220));
  }
  const payload = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    const providerMessage = String(payload.message || payload.error || 'Resend a répondu avec le statut ' + response.status).slice(0, 300);
    const fromMatch = from.match(/<([^<>]+)>/);
    const sender = fromMatch ? fromMatch[1] : from;
    const senderDomain = String(sender.split('@')[1] || '').toLowerCase();
    let domainHint = '';
    try {
      const domainsResponse = await fetch('https://api.resend.com/domains', {
        method: 'GET', headers: { Authorization: 'Bearer ' + apiKey },
        cache: 'no-store', signal: AbortSignal.timeout(7000),
      });
      const domainsPayload = await domainsResponse.json().catch(function () { return {}; });
      if (domainsResponse.ok && Array.isArray(domainsPayload.data)) {
        const matching = domainsPayload.data.find(function (item) {
          return String(item && item.name || '').toLowerCase() === senderDomain;
        });
        if (!matching) domainHint = ' Le domaine expéditeur "' + senderDomain + '" n’est pas enregistré dans ce compte Resend.';
        else if (String(matching.status || '').toLowerCase() !== 'verified') {
          domainHint = ' Le domaine expéditeur "' + senderDomain + '" n’est pas vérifié dans Resend (statut : ' + String(matching.status || 'inconnu') + ').';
        }
      }
    } catch { /* Keep the original provider error when diagnostics are unavailable. */ }
    console.error('[MUSIC HOUSE RESEND]', JSON.stringify({ status: response.status, senderDomain, error: providerMessage, domainHint: domainHint || undefined }));
    throw new Error(providerMessage + domainHint);
  }
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


function appointmentSlotIds(resourceId, start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const slotMs = 15 * 60 * 1000;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs
      || startMs % slotMs !== 0 || endMs % slotMs !== 0) {
    throw new Error('Le créneau de rendez-vous est invalide. Choisissez un horaire aligné sur 15 minutes.');
  }
  const ids = [];
  for (let cursor = startMs; cursor < endMs; cursor += slotMs) {
    ids.push('slot_' + encodeURIComponent(resourceId || 'studio') + '_' + Math.floor(cursor / slotMs));
  }
  return ids;
}

function whatsappLink(number, message) {
  const phone = String(number || '').replace(/\D/g, '');
  return phone ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message) : '';
}

async function createUserNotification(db, services, recipientUid, title, message, kind) {
  if (!recipientUid || recipientUid === 'manual') return;
  await db.collection('notifications').add({
    recipientUid, title, message, kind, createdBy: 'system',
    createdAt: services.FieldValue.serverTimestamp(), readAt: null,
  });
}

async function acceptAppointment(context, body) {
  requireRole(context, 'manager');
  const { db, FieldValue } = context.services;
  const appointmentId = String(body.appointmentId || '').trim();
  if (!appointmentId || appointmentId.includes('/')) throw new Error('Identifiant de rendez-vous invalide.');
  const depositPercent = Number(body.depositPercent);
  if (!Number.isInteger(depositPercent) || depositPercent < 1 || depositPercent > 100) {
    throw new Error('Le pourcentage d’acompte doit être compris entre 1 et 100 %.');
  }
  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const snapshot = await appointmentRef.get();
  if (!snapshot.exists) throw new Error('Rendez-vous introuvable.');
  const appointment = snapshot.data() || {};
  if (!['requested', 'rescheduled'].includes(String(appointment.status))) {
    throw new Error('Cette demande a déjà été traitée ou ne peut plus être acceptée.');
  }
  const total = Number(appointment.servicePriceXaf);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('Le prix final de la prestation est invalide.');
  const depositAmount = Math.min(total, Math.max(1, Math.ceil(total * depositPercent / 100)));
  const start = appointment.startsAt && typeof appointment.startsAt.toDate === 'function' ? appointment.startsAt.toDate() : new Date(appointment.startsAt);
  const end = appointment.endsAt && typeof appointment.endsAt.toDate === 'function' ? appointment.endsAt.toDate() : new Date(appointment.endsAt);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
    throw new Error('Le créneau proposé est déjà passé. Demandez à l’artiste de choisir une nouvelle date.');
  }
  const resourceId = String(appointment.resourceId || 'studio');
  const lockIds = appointmentSlotIds(resourceId, start, end);
  const lockRefs = lockIds.map((id) => db.collection('appointmentLocks').doc(id));
  const producerUid = String(body.producerUid || appointment.producerUid || '').trim();
  let producer = null;
  if (producerUid) {
    const producerSnap = await db.collection('users').doc(producerUid).get();
    if (!producerSnap.exists || producerSnap.data().role !== 'producer' || producerSnap.data().active !== true) {
      throw new Error('Le producteur sélectionné est introuvable ou inactif.');
    }
    producer = { uid: producerUid, name: String(producerSnap.data().displayName || producerSnap.data().email || 'Producteur') };
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const clientNoticeRef = db.collection('notifications').doc();
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(appointmentRef);
    if (!fresh.exists) throw new Error('Rendez-vous introuvable.');
    const current = fresh.data() || {};
    if (!['requested', 'rescheduled'].includes(String(current.status))) {
      throw new Error('Cette demande vient d’être traitée par une autre session. Actualisez la page.');
    }
    const locks = await Promise.all(lockRefs.map((ref) => transaction.get(ref)));
    const now = Date.now();
    const conflict = locks.find((lock) => {
      if (!lock.exists || lock.data().appointmentId === appointmentId) return false;
      const data = lock.data() || {};
      const expiry = data.expiresAt && typeof data.expiresAt.toDate === 'function'
        ? data.expiresAt.toDate().getTime() : data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
      return data.status === 'confirmed' || (data.status === 'pending_payment' && expiry > now);
    });
    if (conflict) throw new Error('Ce créneau n’est plus disponible. Proposez une autre date à l’artiste.');

    transaction.update(appointmentRef, {
      status: 'awaiting_deposit',
      depositPercent,
      depositExpectedXaf: depositAmount,
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedBy: context.uid,
      depositDeadlineAt: expiresAt,
      ...(producer ? { producerUid: producer.uid, producerName: producer.name } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    lockRefs.forEach((ref) => transaction.set(ref, {
      appointmentId, resourceId, startsAt: current.startsAt, endsAt: current.endsAt,
      status: 'pending_payment', expiresAt,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }));
    if (current.ownerUid && current.ownerUid !== 'manual') transaction.set(clientNoticeRef, {
      recipientUid: current.ownerUid,
      title: 'Votre demande a été acceptée',
      message: 'Le studio a accepté votre demande pour « ' + String(current.serviceName || 'votre prestation') + ' ». Réglez l’acompte pour confirmer votre présence.',
      kind: 'appointment_accepted',
      createdBy: context.uid,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
    });
  });

  const contact = await getArtistContact(context, appointment.artistId, appointment.ownerUid);
  const studioSnap = await db.collection('studios').doc('music-house-bta').get();
  const policySnap = await db.collection('settings').doc('bookingPolicy').get();
  const whatsappNumber = String(studioSnap.exists && studioSnap.data().whatsappNumber
    || policySnap.exists && policySnap.data().whatsappNumber || '');
  const message = 'Bonjour MUSIC HOUSE BTA, ma demande pour « ' + String(appointment.serviceName || 'la prestation') +
    ' » a été acceptée. Je souhaite confirmer ma présence et j’ai une question concernant l’acompte.';
  const wa = whatsappLink(whatsappNumber, message);
  const extra = wa
    ? '<p style="margin:18px 0 0;color:#59645d;font-size:13px;line-height:1.7">Une question ? <a href="' + escapeHtml(wa) + '" style="color:#a86a39;font-weight:700">Contacter le studio sur WhatsApp</a>.</p>'
    : '';
  const details = [
    ['Prestation', appointment.serviceName],
    ['Date et heure', dateLabel(appointment.startsAt)],
    ['Prix total', total.toLocaleString('fr-FR') + ' FCFA'],
    ['Acompte demandé', depositPercent + ' % · ' + depositAmount.toLocaleString('fr-FR') + ' FCFA'],
    ['Paiement avant', dateLabel(expiresAt)],
    ...(producer ? [['Producteur', producer.name]] : []),
  ];
  try {
    if (!contact.email || !contact.email.includes('@')) throw new Error('Aucune adresse e-mail exploitable pour cet artiste.');
    await sendEmail(contact.email, 'Votre demande est acceptée : confirmez votre présence',
      emailHtml('Le studio est prêt à vous accueillir', 'Bonne nouvelle : MUSIC HOUSE BTA a accepté votre demande. Votre créneau sera définitivement confirmé dès que le paiement de l’acompte aura été vérifié.', details,
        APP_URL + '/appointments', 'Payer mon acompte et confirmer ma présence', extra),
      'studio-appointment-accepted-' + appointmentId);
    return { accepted: true, emailSent: true, depositPercent, depositAmountXaf: depositAmount };
  } catch (error) {
    console.error('[MUSIC HOUSE APPOINTMENT ACCEPT EMAIL]', error && error.message || error);
    return { accepted: true, emailSent: false, emailError: String(error && error.message || error).slice(0, 320), depositPercent, depositAmountXaf: depositAmount };
  }
}

async function rejectAppointment(context, body) {
  requireRole(context, 'manager');
  const { db, FieldValue } = context.services;
  const appointmentId = String(body.appointmentId || '').trim();
  if (!appointmentId || appointmentId.includes('/')) throw new Error('Identifiant de rendez-vous invalide.');
  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const snapshot = await appointmentRef.get();
  if (!snapshot.exists) throw new Error('Rendez-vous introuvable.');
  const appointment = snapshot.data() || {};
  if (!['requested', 'rescheduled', 'awaiting_deposit'].includes(String(appointment.status))) {
    throw new Error('Cette demande ne peut plus être refusée dans son état actuel.');
  }
  if ((Number(appointment.amountPaidXaf) || 0) > 0) throw new Error('Un acompte a déjà été encaissé. Effectuez une régularisation avant tout refus.');
  if (appointment.status === 'awaiting_deposit') {
    const attempts = await db.collection('paymentAttempts').where('appointmentId', '==', appointmentId).limit(20).get();
    if (attempts.docs.some((item) => ['INITIATING', 'PENDING'].includes(String(item.data().status)))) {
      throw new Error('Un paiement est déjà en cours. Vérifiez son statut Fapshi avant de traiter cette demande.');
    }
  }
  const start = appointment.startsAt && typeof appointment.startsAt.toDate === 'function' ? appointment.startsAt.toDate() : new Date(appointment.startsAt);
  const end = appointment.endsAt && typeof appointment.endsAt.toDate === 'function' ? appointment.endsAt.toDate() : new Date(appointment.endsAt);
  const lockIds = appointmentSlotIds(String(appointment.resourceId || 'studio'), start, end);
  const lockRefs = lockIds.map((id) => db.collection('appointmentLocks').doc(id));
  const reason = String(body.reason || '').trim().slice(0, 500);
  const noticeRef = db.collection('notifications').doc();

  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(appointmentRef);
    if (!fresh.exists || !['requested', 'rescheduled', 'awaiting_deposit'].includes(String(fresh.data().status))) {
      throw new Error('Cette demande a déjà été traitée. Actualisez la page.');
    }
    const locks = await Promise.all(lockRefs.map((ref) => transaction.get(ref)));
    transaction.update(appointmentRef, {
      status: 'rejected', rejectionReason: reason || null, rejectedAt: FieldValue.serverTimestamp(),
      rejectedBy: context.uid, updatedAt: FieldValue.serverTimestamp(),
    });
    locks.forEach((lock, index) => {
      if (lock.exists && lock.data().appointmentId === appointmentId && lock.data().status !== 'confirmed') {
        transaction.delete(lockRefs[index]);
      }
    });
    if (fresh.data().ownerUid && fresh.data().ownerUid !== 'manual') transaction.set(noticeRef, {
      recipientUid: fresh.data().ownerUid, title: 'Mise à jour de votre demande',
      message: reason ? 'Le studio ne peut pas accepter votre demande : ' + reason : 'Le studio ne peut pas accepter votre demande à la date proposée.',
      kind: 'appointment_rejected', createdBy: context.uid,
      createdAt: FieldValue.serverTimestamp(), readAt: null,
    });
  });

  const contact = await getArtistContact(context, appointment.artistId, appointment.ownerUid);
  const studioSnap = await db.collection('studios').doc('music-house-bta').get();
  const policySnap = await db.collection('settings').doc('bookingPolicy').get();
  const whatsappNumber = String(studioSnap.exists && studioSnap.data().whatsappNumber || policySnap.exists && policySnap.data().whatsappNumber || '');
  const wa = whatsappLink(whatsappNumber, 'Bonjour MUSIC HOUSE BTA, j’ai reçu votre réponse concernant ma demande pour « ' + String(appointment.serviceName || 'une prestation') + ' ». J’aimerais échanger avec vous.');
  const details = [['Prestation', appointment.serviceName], ['Date demandée', dateLabel(appointment.startsAt)], ...(reason ? [['Motif', reason]] : [])];
  const extra = wa ? '<p style="margin-top:18px"><a href="' + escapeHtml(wa) + '" style="color:#a86a39;font-weight:700">Discuter avec le studio sur WhatsApp</a></p>' : '';
  try {
    if (!contact.email || !contact.email.includes('@')) throw new Error('Aucune adresse e-mail exploitable pour cet artiste.');
    await sendEmail(contact.email, 'Mise à jour de votre demande · MUSIC HOUSE BTA',
      emailHtml('Votre demande a été étudiée', 'Nous ne pouvons malheureusement pas retenir cette demande à la date proposée. Vous pouvez nous contacter pour convenir d’un autre créneau.', details, APP_URL + '/appointments', 'Voir mes rendez-vous', extra),
      'studio-appointment-rejected-' + appointmentId);
    return { rejected: true, emailSent: true };
  } catch (error) {
    return { rejected: true, emailSent: false, emailError: String(error && error.message || error).slice(0, 320) };
  }
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

  if (action === 'testEmail') {
    requireRole(context, 'manager');
    if (!context.email || !context.email.includes('@')) throw new Error('Aucune adresse e-mail n’est associée au compte manager.');
    const result = await sendEmail(context.email, 'Test de configuration e-mail · MUSIC HOUSE BTA',
      emailHtml('Votre configuration e-mail fonctionne', 'Resend a accepté cet e-mail de test envoyé depuis votre espace manager. Vérifiez aussi votre dossier Spam ou Courrier indésirable.', [
        ['Compte de destination', context.email],
        ['Projet Firebase', process.env.FIREBASE_PROJECT_ID || 'music-house-bta'],
      ], APP_URL, 'Ouvrir MUSIC HOUSE BTA'),
      'studio-manager-email-test-' + context.uid + '-' + Date.now());
    return { sent: true, recipient: context.email, providerId: result.id };
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
      emailHtml('Votre demande de rendez-vous est enregistrée', 'Le studio vérifie la disponibilité et vous adressera une confirmation dès que le rendez-vous aura été validé.', details, APP_URL + '/appointments', 'Suivre ma demande'),
      'studio-appointment-request-artist-' + appointmentId));
    if (context.role === 'client') {
      tasks.push(sendManagerEmail('Nouvelle demande de rendez-vous',
        'Un artiste vient de soumettre une demande de séance. Elle attend la vérification du manager.', details,
        'studio-appointment-request-manager-' + appointmentId));
      try {
        const manager = await context.services.auth.getUserByEmail(MANAGER_EMAIL);
        await createUserNotification(db, context.services, manager.uid, 'Nouvelle demande de rendez-vous',
          (appointment.artistName || contact.name) + ' demande « ' + appointment.serviceName + ' ». Vérifiez la date et acceptez ou refusez la demande.',
          'appointment_requested');
      } catch (notificationError) {
        console.error('[MUSIC HOUSE MANAGER NOTIFICATION]', notificationError && notificationError.message || notificationError);
      }
    }
    const outcomes = await Promise.allSettled(tasks);
    const failed = outcomes.find((outcome) => outcome.status === 'rejected');
    if (failed) throw new Error('La demande est enregistrée, mais un e-mail n’a pas pu être envoyé : ' + String(failed.reason && failed.reason.message || failed.reason));
    return { sent: tasks.length > 0, skipped: !recipient };
  }

  if (action === 'acceptAppointment') return acceptAppointment(context, body);
  if (action === 'rejectAppointment') return rejectAppointment(context, body);

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
