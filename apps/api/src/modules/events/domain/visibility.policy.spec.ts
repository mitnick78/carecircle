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
  describe('admin', () => {
    it('an admin sees an event with no visibility', () => {
      expect(canViewEvent(admin(), event({ visibility: [] }))).toBe(true);
    });

    it('an admin sees an event shared only with a group they do not belong to', () => {
      const viewer = admin({ groupIds: [PARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(NANNY)] }))).toBe(true);
    });
  });

  describe('member', () => {
    it('a member sees an event shared with one of their groups', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(GRANDPARENTS)] }))).toBe(true);
    });

    it('a member of several groups sees the event as soon as one of their groups is allowed', () => {
      const viewer = member({ groupIds: [GRANDPARENTS, NANNY] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(NANNY)] }))).toBe(true);
    });

    it('a member cannot see an event shared only with a group they do not belong to', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(PARENTS)] }))).toBe(false);
    });

    it('a member sees an event shared with them directly', () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(ALICE)] }))).toBe(true);
    });

    it('a member cannot see an event shared directly with another member', () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(BOB)] }))).toBe(false);
    });

    it('a member cannot see an event with no visibility: only admins see it', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [] }))).toBe(false);
    });

    it("a group id equal to the member's id does not grant access", () => {
      // The only entry is a *group* entry whose id happens to equal the viewer's member id.
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(ALICE)] }))).toBe(false);
    });
  });

  describe('member without a group', () => {
    it('a member without a group cannot see an event shared with a group', () => {
      const viewer = member({ groupIds: [] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(GRANDPARENTS)] }))).toBe(false);
    });

    it('a member without a group sees an event shared with them directly', () => {
      const viewer = member({ memberId: ALICE, groupIds: [] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(ALICE)] }))).toBe(true);
    });
  });

  describe('planning isolation', () => {
    it('an admin of another planning cannot see the event', () => {
      const viewer = admin({ planningId: OTHER_PLANNING });

      expect(canViewEvent(viewer, event({ planningId: PLANNING }))).toBe(false);
    });

    it('a member of another planning cannot see the event, even when it is shared with a group and a member carrying their ids', () => {
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
  describe('admin', () => {
    it('an admin sees a note with no visibility on an event with no visibility', () => {
      expect(canViewNote(admin(), event({ visibility: [] }), note({ visibility: [] }))).toBe(true);
    });

    it('an admin sees a note restricted to a group they do not belong to', () => {
      const viewer = admin({ groupIds: [PARENTS] });

      expect(canViewNote(viewer, event(), note({ visibility: [toGroup(NANNY)] }))).toBe(true);
    });

    it('an admin sees a note restricted to another member', () => {
      const viewer = admin({ memberId: ALICE });

      expect(canViewNote(viewer, event(), note({ visibility: [toMember(BOB)] }))).toBe(true);
    });
  });

  describe('member', () => {
    const visibleToGrandparents = event({ visibility: [toGroup(GRANDPARENTS)] });

    it('a member sees a note shared with their group on an event they can see', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(
        canViewNote(viewer, visibleToGrandparents, note({ visibility: [toGroup(GRANDPARENTS)] })),
      ).toBe(true);
    });

    it('a member sees a note shared with them directly on an event they can see', () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });

      expect(
        canViewNote(viewer, visibleToGrandparents, note({ visibility: [toMember(ALICE)] })),
      ).toBe(true);
    });

    it('a member cannot see a private note shared with another group, on an event they can see', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(
        canViewNote(viewer, visibleToGrandparents, note({ visibility: [toGroup(PARENTS)] })),
      ).toBe(false);
    });

    it('seeing the event is not enough: a member cannot see a note with no visibility', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewNote(viewer, visibleToGrandparents, note({ visibility: [] }))).toBe(false);
    });

    it('a member cannot see a note shared with them directly if they cannot see the event', () => {
      const viewer = member({ memberId: ALICE, groupIds: [GRANDPARENTS] });
      const parentsOnly = event({ visibility: [toGroup(PARENTS)] });

      expect(canViewNote(viewer, parentsOnly, note({ visibility: [toMember(ALICE)] }))).toBe(false);
    });

    it('a member cannot see a note shared with their group if they cannot see the event', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });
      const parentsOnly = event({ visibility: [toGroup(PARENTS)] });

      expect(canViewNote(viewer, parentsOnly, note({ visibility: [toGroup(GRANDPARENTS)] }))).toBe(
        false,
      );
    });
  });

  describe('member without a group', () => {
    it('a member without a group cannot see a note shared with a group, even on an event shared with them directly', () => {
      const viewer = member({ memberId: ALICE, groupIds: [] });
      const sharedWithAlice = event({ visibility: [toMember(ALICE)] });

      expect(
        canViewNote(viewer, sharedWithAlice, note({ visibility: [toGroup(GRANDPARENTS)] })),
      ).toBe(false);
    });
  });

  describe('planning and event isolation', () => {
    it('an admin of another planning cannot see the note', () => {
      const viewer = admin({ planningId: OTHER_PLANNING });

      expect(canViewNote(viewer, event({ planningId: PLANNING }), note({ eventId: EVENT }))).toBe(
        false,
      );
    });

    it('a note attached to another event is denied, even to an admin', () => {
      expect(canViewNote(admin(), event({ id: EVENT }), note({ eventId: OTHER_EVENT }))).toBe(
        false,
      );
    });

    it('a member of another planning cannot see the note, even when the event and the note are shared with their ids', () => {
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

    it('a member cannot see a note attached to another event, even when the event and the note are shared with them', () => {
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

describe('degraded inputs', () => {
  // Shapes the types forbid but a faulty database mapping could still produce.
  const NO_VISIBILITY = null as unknown as readonly VisibilityRecipient[];

  it('a member is denied without an error when the event visibility is not a list', () => {
    const viewer = member({ groupIds: [GRANDPARENTS] });

    expect(canViewEvent(viewer, event({ visibility: NO_VISIBILITY }))).toBe(false);
  });

  it('a member is denied without an error when the note visibility is not a list', () => {
    const viewer = member({ groupIds: [GRANDPARENTS] });
    const visibleToGrandparents = event({ visibility: [toGroup(GRANDPARENTS)] });

    expect(canViewNote(viewer, visibleToGrandparents, note({ visibility: NO_VISIBILITY }))).toBe(
      false,
    );
  });

  it('groupIds passed as a string grant access to no group, not even through a partial match', () => {
    const viewer = member({ groupIds: 'group-abc' as unknown as readonly string[] });

    expect(canViewEvent(viewer, event({ visibility: [toGroup('abc')] }))).toBe(false);
    expect(canViewEvent(viewer, event({ visibility: [toGroup('group-abc')] }))).toBe(false);
  });

  it.each(['GROUP', 'everyone', undefined])(
    'a recipient of unknown kind (%s) does not grant access',
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

  it('a null recipient is ignored without an error and does not block access through another recipient', () => {
    const viewer = member({ groupIds: [GRANDPARENTS] });
    const nullRecipient = null as unknown as VisibilityRecipient;

    expect(canViewEvent(viewer, event({ visibility: [nullRecipient] }))).toBe(false);
    expect(
      canViewEvent(viewer, event({ visibility: [nullRecipient, toGroup(GRANDPARENTS)] })),
    ).toBe(true);
  });

  it('an unknown role does not grant admin rights', () => {
    const viewer = member({ role: 'admin' as unknown as Viewer['role'], groupIds: [] });

    expect(canViewEvent(viewer, event({ visibility: [] }))).toBe(false);
    expect(canViewNote(viewer, event({ visibility: [toMember(ALICE)] }), note())).toBe(false);
  });
});

describe('missing or blank ids', () => {
  // The types forbid these values; data mapped from the database at runtime might not.
  const MISSING = undefined as unknown as string;
  const invalidIds = [
    ['missing', MISSING],
    ['empty', ''],
    ['blank', '   '],
  ] as const;

  describe.each(invalidIds)('%s id', (_label, invalidId) => {
    it("an admin is denied when both the viewer's and the event's planningId are invalid", () => {
      const viewer = admin({ planningId: invalidId });

      expect(canViewEvent(viewer, event({ planningId: invalidId }))).toBe(false);
      expect(canViewNote(viewer, event({ planningId: invalidId }), note())).toBe(false);
    });

    it('an admin without a valid memberId is denied', () => {
      const viewer = admin({ memberId: invalidId });

      expect(canViewEvent(viewer, event())).toBe(false);
      expect(canViewNote(viewer, event(), note())).toBe(false);
    });

    it('a member without a valid memberId cannot see a direct share whose memberId is also invalid', () => {
      const viewer = member({ memberId: invalidId });
      const shared = [toMember(invalidId)];

      expect(canViewEvent(viewer, event({ visibility: shared }))).toBe(false);
      expect(canViewNote(viewer, event({ visibility: shared }), note({ visibility: shared }))).toBe(
        false,
      );
    });

    it('a member cannot see a share with an invalid group id, even when their groupIds contain the same value', () => {
      const viewer = member({ groupIds: [invalidId] });

      expect(canViewEvent(viewer, event({ visibility: [toGroup(invalidId)] }))).toBe(false);
    });

    it('a member cannot see a direct share with an invalid id, and keeps access through their group', () => {
      const viewer = member({ groupIds: [GRANDPARENTS] });

      expect(canViewEvent(viewer, event({ visibility: [toMember(invalidId)] }))).toBe(false);
      expect(
        canViewEvent(viewer, event({ visibility: [toMember(invalidId), toGroup(GRANDPARENTS)] })),
      ).toBe(true);
    });

    it('an admin is denied when the event has no valid id', () => {
      expect(canViewEvent(admin(), event({ id: invalidId }))).toBe(false);
    });

    it("an admin cannot see the note when both its eventId and the event's id are invalid", () => {
      expect(canViewNote(admin(), event({ id: invalidId }), note({ eventId: invalidId }))).toBe(
        false,
      );
    });

    it('an admin cannot see a note without a valid eventId, even on a valid event they can see', () => {
      expect(canViewNote(admin(), event(), note({ eventId: invalidId }))).toBe(false);
    });
  });
});
