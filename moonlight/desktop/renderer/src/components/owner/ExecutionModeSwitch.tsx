import React, { useState } from 'react';
import { ExecutionMode } from '../../lib/types';
import { setExecutionMode } from '../../services/owner-api';

interface ExecutionModeSwitchProps {
  mode: ExecutionMode;
  onChange: () => void;
}

const modes: ExecutionMode[] = ['OFF', 'AUTO', 'GUARD', 'ANALYSIS'];

export function ExecutionModeSwitch({ mode, onChange }: ExecutionModeSwitchProps) {
  const [isChanging, setIsChanging] = useState(false);

  const handleChange = async (newMode: ExecutionMode) => {
    if (newMode === mode) return;

    const confirmed = window.confirm(
      `Execution mode'u ${mode} → ${newMode} olarak değiştirmek istediğinize emin misiniz?`,
    );

    if (!confirmed) return;

    setIsChanging(true);
    try {
      await setExecutionMode(newMode);
      onChange();
    } catch (error: any) {
      alert(`Mode değiştirilemedi: ${error.message}`);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="flex gap-2">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => handleChange(m)}
          disabled={isChanging}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            m === mode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } disabled:opacity-50`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
