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

    it('un administrateur voit une note réservée à un groupe dont il ne fait pas partie', () => {
      const viewer = admin({ groupIds: [PARENTS] });

      expect(canViewNote(viewer, event(), note({ visibility: [toGroup(NANNY)] }))).toBe(true);
    });

    it('un administrateur voit une note réservée à un autre membre', () => {
      const viewer = admin({ memberId: ALICE });

      expect(canViewNote(viewer, event(), note({ visibility: [toMember(BOB)] }))).toBe(true);
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

    it("un membre d'un autre planning ne voit pas la note, même si l'événement et la note sont partagés avec ses identifiants", () => {
      const viewer = member({
        planningId: OTHER_PLANNING,
        memberId: ALICE,
        groupIds: [GRANDPARENTS],
      });
      const shared = [toGroup(GRANDPARENTS), toMember(ALICE)];

      expect(
        canViewNote(
          viewer,
          event({ planningId: PLANNING, visibility: shared }),
          note({ visibility: shared }),
        ),
      ).toBe(false);
    });

    it("un membre ne voit pas une note rattachée à un autre événement, même si l'événement et la note lui sont partagés", () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });
      const shared = [toGroup(GRANDPARENTS), toMember(ALICE)];

      expect(
        canViewNote(
          viewer,
          event({ id: EVENT, visibility: shared }),
          note({ eventId: OTHER_EVENT, visibility: shared }),
        ),
      ).toBe(false);
    });
  });
});

describe('entrées dégradées', () => {
  // Shapes the types forbid but a faulty database mapping could still produce.
  const NO_VISIBILITY = null as unknown as readonly VisibilityRecipient[];

  it("un membre est refusé sans erreur quand la visibilité de l'événement n'est pas une liste", () => {
    const viewer = member({ groupIds: [GRANDPARENTS] });

    expect(canViewEvent(viewer, event({ visibility: NO_VISIBILITY }))).toBe(false);
  });

  it("un membre est refusé sans erreur quand la visibilité de la note n'est pas une liste", () => {
    const viewer = member({ groupIds: [GRANDPARENTS] });
    const visibleToGrandparents = event({ visibility: [toGroup(GRANDPARENTS)] });

    expect(canViewNote(viewer, visibleToGrandparents, note({ visibility: NO_VISIBILITY }))).toBe(
      false,
    );
  });

  it('des groupIds passés sous forme de texte ne donnent accès à aucun groupe, même par correspondance partielle', () => {
    const viewer = member({ groupIds: 'group-abc' as unknown as readonly string[] });

    expect(canViewEvent(viewer, event({ visibility: [toGroup('abc')] }))).toBe(false);
    expect(canViewEvent(viewer, event({ visibility: [toGroup('group-abc')] }))).toBe(false);
  });

  it.each(['GROUP', 'everyone', undefined])(
    'un destinataire de type inconnu (%s) ne donne pas accès',
    (kind) => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });
      const unknownRecipient = {
        kind,
        groupId: GRANDPARENTS,
        memberId: ALICE,
      } as unknown as VisibilityRecipient;

      expect(canViewEvent(viewer, event({ visibility: [unknownRecipient] }))).toBe(false);
    },
  );

  it("un destinataire nul est ignoré, sans erreur, et n'empêche pas l'accès par un autre destinataire", () => {
    const viewer = member({ groupIds: [GRANDPARENTS] });
    const nullRecipient = null as unknown as VisibilityRecipient;

    expect(canViewEvent(viewer, event({ visibility: [nullRecipient] }))).toBe(false);
    expect(
      canViewEvent(viewer, event({ visibility: [nullRecipient, toGroup(GRANDPARENTS)] })),
    ).toBe(true);
  });

  it("un rôle inconnu n'accorde pas les droits d'administrateur", () => {
    const viewer = member({ role: 'admin' as unknown as Viewer['role'], groupIds: [] });

    expect(canViewEvent(viewer, event({ visibility: [] }))).toBe(false);
    expect(canViewNote(viewer, event({ visibility: [toMember(ALICE)] }), note())).toBe(false);
  });
});

describe('identifiants vides ou manquants', () => {
  // The types forbid these values; data mapped from the database at runtime might not.
  const MISSING = undefined as unknown as string;
  const invalidIds = [
    ['manquant', MISSING],
    ['vide', ''],
    ['blanc', '   '],
  ] as const;

  describe.each(invalidIds)('identifiant %s', (_label, invalidId) => {
    it("un administrateur est refusé quand le planningId du viewer et celui de l'événement sont tous deux invalides", () => {
      const viewer = admin({ planningId: invalidId });

      expect(canViewEvent(viewer, event({ planningId: invalidId }))).toBe(false);
      expect(canViewNote(viewer, event({ planningId: invalidId }), note())).toBe(false);
    });

    it('un administrateur sans memberId valide est refusé', () => {
      const viewer = admin({ memberId: invalidId });

      expect(canViewEvent(viewer, event())).toBe(false);
      expect(canViewNote(viewer, event(), note())).toBe(false);
    });

    it('un membre sans memberId valide ne voit pas un partage direct dont le memberId est aussi invalide', () => {
      const viewer = member({ memberId: invalidId });
      const shared = [toMember(invalidId)];

      expect(canViewEvent(viewer, event({ visibility: shared }))).toBe(false);
      expect(canViewNote(viewer, event({ visibility: shared }), note({ visibility: shared }))).toBe(
        false,
      );
    });

    it("un membre ne voit pas un partage avec un groupe d'identifiant invalide, même si ses groupIds contiennent la même valeur", () => {
      const viewer = member({ groupIds: [invalidId] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(invalidId)] }))).toBe(false);
    });

    it("un membre ne voit pas un partage direct d'identifiant invalide, et garde l'accès par son groupe", () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(invalidId)] }))).toBe(false);
      expect(
        canViewEvent(viewer, event({ visibility: [toMember(invalidId), toGroup(GRANDPARENTS)] })),
      ).toBe(true);
    });

    it("un administrateur est refusé quand l'événement n'a pas d'identifiant valide", () => {
      expect(canViewEvent(admin(), event({ id: invalidId }))).toBe(false);
    });

    it("un administrateur ne voit pas la note quand son eventId et l'identifiant de l'événement sont tous deux invalides", () => {
      expect(canViewNote(admin(), event({ id: invalidId }), note({ eventId: invalidId }))).toBe(
        false,
      );
    });

    it("un administrateur ne voit pas une note sans eventId valide, même sur un événement valide qu'il voit", () => {
      expect(canViewNote(admin(), event(), note({ eventId: invalidId }))).toBe(false);
    });
  });
});
