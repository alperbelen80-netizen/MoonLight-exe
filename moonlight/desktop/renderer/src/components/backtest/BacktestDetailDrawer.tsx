import React, { useState } from 'react';
import { BacktestRunSummaryDTO } from '../../services/backtest-api';
import { useBacktestsStore } from '../../store/backtests.store';

interface BacktestDetailDrawerProps {
  run: BacktestRunSummaryDTO;
  onClose: () => void;
}

export function BacktestDetailDrawer({ run, onClose }: BacktestDetailDrawerProps) {
  const { updateTags, updateNotes } = useBacktestsStore();
  const [editTags, setEditTags] = useState<string[]>(run.tags || []);
  const [editNotes, setEditNotes] = useState(run.notes || '');
  const [tagInput, setTagInput] = useState('');

  const handleSaveTags = () => {
    updateTags(run.run_id, editTags);
  };

  const handleSaveNotes = () => {
    updateNotes(run.run_id, editNotes);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
      setEditTags([...editTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Backtest Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Run ID</div>
              <div className="text-sm text-gray-900">{run.run_id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Symbol</div>
              <div className="text-sm text-gray-900">{run.symbols.join(', ')}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Timeframe</div>
              <div className="text-sm text-gray-900">{run.timeframes.join(', ')}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Strategy</div>
              <div className="text-sm text-gray-900">{run.strategy_ids.join(', ')}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Environment</div>
              <div className="text-sm text-gray-900">{run.environment}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Hardware Profile</div>
              <div className="text-sm text-gray-900">{run.hardware_profile}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Date Range</div>
              <div className="text-sm text-gray-900">
                {run.from_date} to {run.to_date}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Status</div>
              <div className="text-sm text-gray-900">{run.status}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {(run.win_rate * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">Win Rate</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  run.net_pnl > 0 ? 'text-green-600' : run.net_pnl < 0 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                ${run.net_pnl.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">Net PnL</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {run.total_trades}
              </div>
              <div className="text-sm text-gray-500">Trades</div>
            </div>
            {run.sharpe !== undefined && run.sharpe !== null && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {run.sharpe.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Sharpe Ratio</div>
              </div>
            )}
            {run.profit_factor !== undefined && run.profit_factor !== null && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {run.profit_factor.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Profit Factor</div>
              </div>
            )}
            {run.expectancy !== undefined && run.expectancy !== null && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {run.expectancy.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Expectancy</div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm font-medium text-gray-700 mb-2">Tags</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {editTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Add
              </button>
              <button
                onClick={handleSaveTags}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                Save Tags
              </button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm font-medium text-gray-700 mb-2">Notes</div>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              rows={3}
              placeholder="Add notes..."
            />
            <button
              onClick={handleSaveNotes}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Save Notes
            </button>
          </div>

          <div className="pt-4 border-t flex gap-2">
            <a
              href={`http://localhost:8001/reporting/backtest/${run.run_id}/advanced`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Open Advanced Report
            </a>
            <a
              href={`http://localhost:8001/reporting/backtest/${run.run_id}/export/xlsx`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Export Excel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
