import React from 'react';
import { Delete } from './Icons';
import PulseConfirmSheet from './PulseConfirmSheet';

export default function BlockConfirmModal({ contactName, onConfirm, onCancel }) {
  return (
    <PulseConfirmSheet
      title="Contact blokkeren"
      description={`Weet je zeker dat je ${contactName} wilt blokkeren? Deze persoon kan je dan geen berichten meer sturen of bellen.`}
      onClose={onCancel}
      actions={[
        { label: 'Annuleren', tone: 'neutral', onSelect: onCancel },
        { label: 'Blokkeren', tone: 'danger', icon: Delete, onSelect: onConfirm },
      ]}
    />
  );
}
