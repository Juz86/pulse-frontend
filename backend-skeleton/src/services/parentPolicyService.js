import { db } from './firestore.js';
import { isWithinQuietHours } from './policyTime.js';

class ParentPolicyService {
  async isParentOfChild(parentUid, childUid) {
    const doc = await db.collection('users').doc(childUid).get();
    if (!doc.exists) return false;

    const data = doc.data();
    return data.parentUid === parentUid || data.managedByParentId === parentUid;
  }

  async mayFetchKeyBundle(requesterId, targetUserId) {
    if (requesterId === targetUserId) {
      return { allowed: false, reason: 'self_target_not_allowed' };
    }

    const relation = await this.getChildContactRelation(requesterId, targetUserId);
    if (!relation) {
      return { allowed: false, reason: 'contact_not_approved' };
    }

    if (relation.blocked) {
      return { allowed: false, reason: 'contact_blocked' };
    }

    if (!relation.chat) {
      return { allowed: false, reason: 'chat_disabled_for_contact' };
    }

    return { allowed: true };
  }

  async maySendMessage(senderId, _conversationId, recipientUserId) {
    const relation = await this.getChildContactRelation(senderId, recipientUserId);
    if (!relation) {
      return { allowed: false, reason: 'contact_not_approved' };
    }

    if (relation.blocked) {
      return { allowed: false, reason: 'contact_blocked' };
    }

    if (!relation.chat) {
      return { allowed: false, reason: 'chat_disabled_for_contact' };
    }

    const policy = await this.getChildPolicyIfManaged(senderId);
    if (policy && policy.featureRules?.chat === false) {
      return { allowed: false, reason: 'chat_disabled_by_parent' };
    }

    if (policy && isWithinQuietHours(policy.scheduleRules, new Date())) {
      return { allowed: false, reason: 'quiet_hours' };
    }

    return { allowed: true };
  }

  async mayCreateConversation(requesterId, targetUserId) {
    return this.mayFetchKeyBundle(requesterId, targetUserId);
  }

  async mayAddGroupMember(requesterId, existingMemberIds, targetUserId) {
    if (!Array.isArray(existingMemberIds) || existingMemberIds.length === 0) {
      return { allowed: false, reason: 'invalid_group_members' };
    }

    if (!targetUserId || existingMemberIds.includes(targetUserId)) {
      return { allowed: false, reason: 'already_in_group' };
    }

    const participants = Array.from(new Set([requesterId, ...existingMemberIds].filter(Boolean)));

    for (const memberId of participants) {
      if (memberId === targetUserId) continue;

      const decision = await this.mayCreateConversation(memberId, targetUserId);
      if (!decision.allowed) {
        return decision;
      }

      const reverseDecision = await this.mayCreateConversation(targetUserId, memberId);
      if (!reverseDecision.allowed) {
        return reverseDecision;
      }
    }

    return { allowed: true };
  }

  async mayStartCall(senderId, targetUserId, isVideo = false) {
    const relation = await this.getChildContactRelation(senderId, targetUserId);
    if (!relation) {
      return { allowed: false, reason: 'contact_not_approved' };
    }

    if (relation.blocked) {
      return { allowed: false, reason: 'contact_blocked' };
    }

    if (isVideo && relation.video === false) {
      return { allowed: false, reason: 'video_disabled_for_contact' };
    }

    if (!isVideo && relation.call === false) {
      return { allowed: false, reason: 'call_disabled_for_contact' };
    }

    const policy = await this.getChildPolicyIfManaged(senderId);
    if (policy) {
      if (isVideo && policy.featureRules?.video === false) {
        return { allowed: false, reason: 'video_disabled_by_parent' };
      }

      if (!isVideo && policy.featureRules?.call === false) {
        return { allowed: false, reason: 'call_disabled_by_parent' };
      }

      if (isWithinQuietHours(policy.scheduleRules, new Date())) {
        return { allowed: false, reason: 'quiet_hours' };
      }
    }

    return { allowed: true };
  }

  async getChildPolicyIfManaged(userId) {
    const doc = await db.collection('child_policies').doc(userId).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  async getChildContactRelation(userIdA, userIdB) {
    const policyA = await this.getChildPolicyIfManaged(userIdA);
    if (policyA) {
      return this.getApprovedContact(userIdA, userIdB);
    }

    const policyB = await this.getChildPolicyIfManaged(userIdB);
    if (policyB) {
      return this.getApprovedContact(userIdB, userIdA);
    }

    return {
      approved: true,
      chat: true,
      call: true,
      video: true,
      blocked: false,
    };
  }

  async getApprovedContact(childId, targetUid) {
    const doc = await db.collection('approved_contacts').doc(`${childId}_${targetUid}`).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data.approved) return null;
    return data;
  }
}

export const parentPolicyService = new ParentPolicyService();
