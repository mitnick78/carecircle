import { describe, expect, it } from 'vitest';

import { canViewEvent, canViewNote } from './visibility.policy.js';
import type {
  VisibilityRecipient,
  VisibleEvent,
  VisibleNote,
  Viewer,
} from './visibility.policy.js';

// Fictional fixtures. The viewer is always 'member-alice'; 'member-bob' is someone else.
const PLANNING = 'planning-1';
const OTHER_PLANNING = 'planning-2';
const EVENT = 'event-1';
const OTHER_EVENT = 'event-2';
const ALICE = 'member-alice';
const BOB = 'member-bob';
const PARENTS = 'group-parents';
const GRANDPARENTS = 'group-grandparents';
const NANNY = 'group-nanny';

function admin(overrides: Partial<Viewer> = {}): Viewer {
  return {
    planningId: PLANNING,
    memberId: ALICE,
    role: 'ADMIN',
    groupIds: [PARENTS],
    ...overrides,
  };
}

function member(overrides: Partial<Viewer> = {}): Viewer {
  return { planningId: PLANNING, memberId: ALICE, role: 'MEMBER', groupIds: [], ...overrides };
}

function event(overrides: Partial<VisibleEvent> = {}): VisibleEvent {
  return { id: EVENT, planningId: PLANNING, visibility: [], ...overrides };
}

function note(overrides: Partial<VisibleNote> = {}): VisibleNote {
  return { eventId: EVENT, visibility: [], ...overrides };
}

function toGroup(groupId: string): VisibilityRecipient {
  return { kind: 'group', groupId };
}

function toMember(memberId: string): VisibilityRecipient {
  return { kind: 'member', memberId };
}

describe('canViewEvent', () => {
  describe('administrateur', () => {
    it("un administrateur voit un événement qui n'a aucune visibilité", () => {
      expect(canViewEvent(admin(), event({ visibility: [] }))).toBe(true);
    });

    it('un administrateur voit un événement partagé uniquement avec un groupe dont il ne fait pas partie', () => {
      const viewer = admin({ groupIds: [PARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(NANNY)] }))).toBe(true);
    });
  });

  describe('membre', () => {
    it("un membre voit un événement partagé avec l'un de ses groupes", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(GRANDPARENTS)] }))).toBe(true);
    });

    it("un membre de plusieurs groupes voit l'événement dès qu'un seul de ses groupes est autorisé", () => {
      const viewer = member({ groupIds: [GRANDPARENTS, NANNY] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(NANNY)] }))).toBe(true);
    });

    it('un membre ne voit pas un événement partagé uniquement avec un groupe dont il ne fait pas partie', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(PARENTS)] }))).toBe(false);
    });

    it('un membre voit un événement qui lui est partagé directement', () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(ALICE)] }))).toBe(true);
    });

    it('un membre ne voit pas un événement partagé directement avec un autre membre', () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(BOB)] }))).toBe(false);
    });

    it("un membre ne voit pas un événement qui n'a aucune visibilité : seuls les administrateurs le voient", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [] }))).toBe(false);
    });

    it("un identifiant de groupe égal à l'identifiant du membre ne donne pas accès", () => {
      // The only entry is a *group* entry whose id happens to equal the viewer's member id.
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(ALICE)] }))).toBe(false);
    });
  });

  describe('membre sans groupe', () => {
    it('un membre sans groupe ne voit pas un événement partagé avec un groupe', () => {
      const viewer = member({ groupIds: [] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(GRANDPARENTS)] }))).toBe(false);
    });

    it('un membre sans groupe voit un événement qui lui est partagé directement', () => {
      const viewer = member({ memberId: ALICE, groupIds: [] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(ALICE)] }))).toBe(true);
    });
  });

  describe('cloisonnement entre plannings', () => {
    it("un administrateur d'un autre planning ne voit pas l'événement", () => {
      const viewer = admin({ planningId: OTHER_PLANNING });

      expect(canViewEvent(viewer, event({ planningId: PLANNING }))).toBe(false);
    });

    it("un membre d'un autre planning ne voit pas l'événement, même partagé avec un groupe et un membre portant ses identifiants", () => {
      const viewer = member({
        planningId: OTHER_PLANNING,
        memberId: ALICE,
        groupIds: [GRANDPARENTS],
      });
      const sharedWithSameIds = event({
        planningId: PLANNING,
        visibility: [toGroup(GRANDPARENTS), toMember(ALICE)],
      });

      expect(canViewEvent(viewer, sharedWithSameIds)).toBe(false);
    });
  });
});

describe('canViewNote', () => {
  describe('administrateur', () => {
    it('un administrateur voit une note sans visibilité sur un événement sans visibilité', () => {
      expect(canViewNote(admin(), event({ visibility: [] }), note({ visibility: [] }))).toBe(true);
    });
  });

  describe('membre', () => {
    const visibleToGrandparents = event({ visibility: [toGroup(GRANDPARENTS)] });

    it("un membre voit une note partagée avec son groupe sur un événement qu'il voit", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(
        canViewNote(viewer, visibleToGrandparents, note({ visibility: [toGroup(GRANDPARENTS)] })),
      ).toBe(true);
    });

    it("un membre voit une note qui lui est partagée directement sur un événement qu'il voit", () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(
        canViewNote(viewer, visibleToGrandparents, note({ visibility: [toMember(ALICE)] })),
      ).toBe(true);
    });

    it("un membre ne voit pas une note privée, partagée avec un autre groupe, sur un événement qu'il voit", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(
        canViewNote(viewer, visibleToGrandparents, note({ visibility: [toGroup(PARENTS)] })),
      ).toBe(false);
    });

    it("voir l'événement ne suffit pas : un membre ne voit pas une note sans visibilité", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewNote(viewer, visibleToGrandparents, note({ visibility: [] }))).toBe(false);
    });

    it("un membre ne voit pas une note qui lui est partagée directement si l'événement ne lui est pas visible", () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });
      const parentsOnly = event({ visibility: [toGroup(PARENTS)] });

      expect(canViewNote(viewer, parentsOnly, note({ visibility: [toMember(ALICE)] }))).toBe(false);
    });

    it("un membre ne voit pas une note partagée avec son groupe si l'événement ne lui est pas visible", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });
      const parentsOnly = event({ visibility: [toGroup(PARENTS)] });

      expect(canViewNote(viewer, parentsOnly, note({ visibility: [toGroup(GRANDPARENTS)] }))).toBe(
        false,
      );
    });
  });

  describe('membre sans groupe', () => {
    it('un membre sans groupe ne voit pas une note partagée avec un groupe, même sur un événement qui lui est partagé directement', () => {
      const viewer = member({ memberId: ALICE, groupIds: [] });
      const sharedWithAlice = event({ visibility: [toMember(ALICE)] });

      expect(
        canViewNote(viewer, sharedWithAlice, note({ visibility: [toGroup(GRANDPARENTS)] })),
      ).toBe(false);
    });
  });

  describe('cloisonnement entre plannings et événements', () => {
    it("un administrateur d'un autre planning ne voit pas la note", () => {
      const viewer = admin({ planningId: OTHER_PLANNING });

      expect(canViewNote(viewer, event({ planningId: PLANNING }), note({ eventId: EVENT }))).toBe(
        false,
      );
    });

    it('une note rattachée à un autre événement est refusée, même pour un administrateur', () => {
      expect(canViewNote(admin(), event({ id: EVENT }), note({ eventId: OTHER_EVENT }))).toBe(
        false,
      );
    });
  });
});
