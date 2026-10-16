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

function isRecipient(viewer: Viewer, visibility: readonly VisibilityRecipient[]): boolean {
  return visibility.some((recipient) => {
    switch (recipient.kind) {
      case 'group':
        return viewer.groupIds.includes(recipient.groupId);
      case 'member':
        return recipient.memberId === viewer.memberId;
    }
  });
}

/** Rule 2: admins of the event's planning, or a targeted group or member, can see the event. */
export function canViewEvent(viewer: Viewer, event: VisibleEvent): boolean {
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
  if (note.eventId !== event.id) {
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
