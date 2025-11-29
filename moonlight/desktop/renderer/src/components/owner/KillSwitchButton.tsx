import React, { useState } from 'react';
import { activateKillSwitch, deactivateKillSwitch } from '../../services/risk-api';

interface KillSwitchButtonProps {
  active: boolean;
  onToggle: () => void;
}

export function KillSwitchButton({ active, onToggle }: KillSwitchButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = async () => {
    const action = active ? 'deactivate' : 'activate';
    const message = active
      ? 'Kill-Switch devre dışı bırakılacak. Devam edilsin mi?'
      : 'Kill-Switch aktif edilecek. TÜM otomatik işlemler duracak. Emin misiniz?';

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      if (active) {
        await deactivateKillSwitch();
      } else {
        await activateKillSwitch('OWNER_MANUAL');
      }
      onToggle();
    } catch (error: any) {
      alert(`Kill-Switch işlemi başarısız: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
      className={`px-4 py-2 rounded font-medium transition disabled:opacity-50 ${
        active
          ? 'bg-yellow-500 text-white hover:bg-yellow-600'
          : 'bg-red-600 text-white hover:bg-red-700'
      }`}
    >
      {active ? 'Deactivate Kill-Switch' : 'Activate Kill-Switch'}
    </button>
  );
}
