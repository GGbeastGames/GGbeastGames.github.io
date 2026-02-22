export type StoryEvent = {
  id: string;
  title: string;
  description: string;
  active: boolean;
};

export type CosmeticItem = {
  id: string;
  name: string;
  price: number;
  type: 'theme' | 'title-card' | 'desktop-anim';
};

export type MentorTicket = {
  id: string;
  studentAlias: string;
  mentorAlias: string | null;
  status: 'open' | 'matched' | 'completed';
};

export type SeasonState = {
  ownedCosmetics: string[];
  activeTheme: string;
  storyEvents: StoryEvent[];
  mentorTickets: MentorTicket[];
};

export const cosmeticCatalog: CosmeticItem[] = [
  { id: 'theme-neon-eclipse', name: 'Neon Eclipse Theme', price: 180, type: 'theme' },
  { id: 'title-ghost-architect', name: 'Ghost Architect Title', price: 90, type: 'title-card' },
  { id: 'anim-cascade-matrix', name: 'Cascade Matrix Animation', price: 220, type: 'desktop-anim' }
];

export const defaultSeasonState: SeasonState = {
  ownedCosmetics: [],
  activeTheme: 'default',
  storyEvents: [
    {
      id: 'arc-black-signal',
      title: 'Black Signal // Month 1',
      description: 'Syndicates intercept a corrupted VALK relay. Complete arc missions to decode the source.',
      active: true
    }
  ],
  mentorTickets: []
};

export function buyCosmetic(state: SeasonState, itemId: string): { next: SeasonState; ok: boolean; message: string } {
  if (state.ownedCosmetics.includes(itemId)) return { next: state, ok: false, message: 'Already owned.' };
  return {
    next: { ...state, ownedCosmetics: [...state.ownedCosmetics, itemId] },
    ok: true,
    message: `Cosmetic unlocked: ${itemId}`
  };
}

export function applyTheme(state: SeasonState, itemId: string): SeasonState {
  if (!state.ownedCosmetics.includes(itemId)) return state;
  return { ...state, activeTheme: itemId };
}

export function createMentorTicket(state: SeasonState, studentAlias: string): { next: SeasonState; id: string } {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const ticket: MentorTicket = { id, studentAlias, mentorAlias: null, status: 'open' };
  return {
    id,
    next: {
      ...state,
      mentorTickets: [ticket, ...state.mentorTickets].slice(0, 20)
    }
  };
}

export function matchMentor(state: SeasonState, ticketId: string, mentorAlias: string): SeasonState {
  return {
    ...state,
    mentorTickets: state.mentorTickets.map((ticket) =>
      ticket.id === ticketId ? { ...ticket, mentorAlias, status: 'matched' } : ticket
    )
  };
}
