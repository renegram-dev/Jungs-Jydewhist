import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSharedMeta,
  recordSharedRoom,
  updateRecentRoomName,
  clearLastSharedRoom,
  getLastSharedRoomCode,
  getRecentSharedRooms,
} from '../lib/sharedMeta.js';

describe('shared-room metadata (localStorage)', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to empty when nothing is stored', () => {
    expect(loadSharedMeta()).toEqual({ lastRoomCode: null, lastJoinedAt: null, recent: [] });
    expect(getLastSharedRoomCode()).toBeNull();
  });

  it('records a room as last + recent when joining/creating', () => {
    recordSharedRoom({ roomCode: 'AB12CD', sessionName: 'Aften' });
    expect(getLastSharedRoomCode()).toBe('AB12CD');
    const recent = getRecentSharedRooms();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ roomCode: 'AB12CD', sessionName: 'Aften' });
    expect(typeof recent[0].joinedAt).toBe('string');
  });

  it('de-dupes and moves a re-joined room to the front', () => {
    recordSharedRoom({ roomCode: 'AAA111' });
    recordSharedRoom({ roomCode: 'BBB222' });
    recordSharedRoom({ roomCode: 'AAA111', sessionName: 'igen' });
    const recent = getRecentSharedRooms();
    expect(recent.map((r) => r.roomCode)).toEqual(['AAA111', 'BBB222']);
    expect(getLastSharedRoomCode()).toBe('AAA111');
  });

  it('caps the recent list at 8', () => {
    for (let i = 0; i < 12; i++) recordSharedRoom({ roomCode: `R${i}XXXX` });
    expect(getRecentSharedRooms()).toHaveLength(8);
  });

  it('updateRecentRoomName refreshes a stored name', () => {
    recordSharedRoom({ roomCode: 'AB12CD', sessionName: '' });
    updateRecentRoomName('AB12CD', 'Torsdagsklub');
    expect(getRecentSharedRooms()[0].sessionName).toBe('Torsdagsklub');
  });

  it('clearLastSharedRoom forgets last but keeps the recent list', () => {
    recordSharedRoom({ roomCode: 'AB12CD', sessionName: 'Aften' });
    clearLastSharedRoom();
    expect(getLastSharedRoomCode()).toBeNull();
    expect(getRecentSharedRooms()).toHaveLength(1); // still rejoin-able from the list
  });

  it('recovers to defaults if stored JSON is corrupt', () => {
    localStorage.setItem('jungs-jydewhist.shared.v1', '{broken');
    expect(loadSharedMeta().recent).toEqual([]);
  });
});
