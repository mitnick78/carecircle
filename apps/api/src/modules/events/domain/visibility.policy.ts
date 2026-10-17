/** Role of a member within a planning. */
export type Role = 'ADMIN' | 'MEMBER';

/** The member on whose behalf a resource is accessed, scoped to one planning. */
export interface Viewer {
  readonly planningId: string;
  readonly memberId: string;
  readonly role: Role;
  readonly groupIds: readonly string[];
}

/** One recipient per Visibility row: a group XOR a member (ARCHITECTURE §5 invariant). */
export type VisibilityRecipient =
  | { readonly kind: 'group'; readonly groupId: string }
  | { readonly kind: 'member'; readonly memberId: string };

/** The fields of an event the visibility policy needs. */
export interface VisibleEvent {
  readonly id: string;
  readonly planningId: string;
  readonly visibility: readonly VisibilityRecipient[];
}

/** The fields of a note the visibility policy needs. */
export interface VisibleNote {
  readonly eventId: string;
  readonly visibility: readonly VisibilityRecipient[];
}

/*
 * The types forbid missing ids, but values mapped from the database at runtime may not match
 * them. Every check below fails closed: anything other than a non-blank string is no id at all,
 * so two missing ids never compare equal.
 */
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function hasValidIdentity(viewer: Viewer): boolean {
  return isId(viewer.planningId) && isId(viewer.memberId) && Array.isArray(viewer.groupIds);
}

function isRecipient(viewer: Viewer, visibility: readonly VisibilityRecipient[]): boolean {
  if (!Array.isArray(visibility)) {
    return false;
  }
  return visibility.some((recipient: VisibilityRecipient | null | undefined) => {
    switch (recipient?.kind) {
      case 'group':
        return isId(recipient.groupId) && viewer.groupIds.includes(recipient.groupId);
      case 'member':
        return isId(recipient.memberId) && recipient.memberId === viewer.memberId;
      default:
        return false;
    }
  });
}

/** Rule 2: admins of the event's planning, or a targeted group or member, can see the event. */
export function canViewEvent(viewer: Viewer, event: VisibleEvent): boolean {
  if (!hasValidIdentity(viewer) || !isId(event.id) || !isId(event.planningId)) {
    return false;
  }
  if (viewer.planningId !== event.planningId) {
    return false;
  }
  if (viewer.role === 'ADMIN') {
    return true;
  }
  return isRecipient(viewer, event.visibility);
}

/** Rule 3: a note requires access to its event and its own visibility (admins bypass the latter). */
export function canViewNote(viewer: Viewer, event: VisibleEvent, note: VisibleNote): boolean {
  if (!isId(note.eventId) || note.eventId !== event.id) {
    return false;
  }
  if (!canViewEvent(viewer, event)) {
    return false;
  }
  if (viewer.role === 'ADMIN') {
    return true;
  }
  return isRecipient(viewer, note.visibility);
}
