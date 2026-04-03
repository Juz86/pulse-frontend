import { db } from './firestore.js';

class ParentPolicyService {
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
