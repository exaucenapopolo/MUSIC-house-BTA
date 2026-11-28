import { describe, expect, it } from 'vitest';
import { buildAppointmentWindow, parseDoualaDateTime, appointmentSlotIds, toDoualaDateTimeInput } from '../src/booking';

describe('calendrier du studio — heure locale Africa/Douala', () => {
  it('accepte le 29 novembre 2026 choisi depuis datetime-local', () => {
    const window = buildAppointmentWindow('2026-11-29T10:00', 60);
    expect(window.startsAt.toDate().toISOString()).toBe('2026-11-29T09:00:00.000Z');
    expect(window.endsAt.toDate().toISOString()).toBe('2026-11-29T10:00:00.000Z');
  });
  it('accepte aussi la valeur datetime-local avec secondes', () => {
    expect(parseDoualaDateTime('2026-11-29T10:15:00').toISOString()).toBe('2026-11-29T09:15:00.000Z');
  });
  it('refuse une date impossible plutôt que de la décaler automatiquement', () => {
    expect(() => parseDoualaDateTime('2026-02-30T10:00')).toThrow(/n’existe pas/);
  });
  it('refuse les heures qui ne sont pas alignées sur 15 minutes', () => {
    expect(() => buildAppointmentWindow('2026-11-29T10:07', 60)).toThrow(/15 minutes/);
  });
  it('génère quatre créneaux de quinze minutes pour une heure de studio', () => {
    const window = buildAppointmentWindow('2026-11-29T10:00', 60);
    expect(appointmentSlotIds('studio', window.startsAt.toDate(), window.endsAt.toDate())).toHaveLength(4);
  });
  it('formate une heure locale pour le champ du calendrier', () => {
    expect(toDoualaDateTimeInput(new Date('2026-11-29T09:00:00.000Z'))).toBe('2026-11-29T10:00');
  });
});
