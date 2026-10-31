'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Layers,
  BarChart3,
  Table as TableIcon,
  Trophy,
  Settings as SettingsIcon,
  Download,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('rounds'); // rounds | progress | matrix | standings | settings
  const [loading, setLoading] = useState(true);

  // Data states
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [progressData, setProgressData] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [standingsData, setStandingsData] = useState(null);
  const [settings, setSettings] = useState(null);

  // Feedback states
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');

  // Modals
  const [roundModal, setRoundModal] = useState(null); // { round, action: 'open' | 'lock' | 'reopen' }
  const [roundMaxMarks, setRoundMaxMarks] = useState('');
  const [roundReason, setRoundReason] = useState('');

  const [matrixActionModal, setMatrixActionModal] = useState(null); // { team, evaluator, mark, action: 'edit' | 'free' | 'add' }
  const [matrixValue, setMatrixValue] = useState('');
  const [matrixReason, setMatrixReason] = useState('');

  const [advanceModal, setAdvanceModal] = useState(false);
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceConfirmation, setAdvanceConfirmation] = useState('');
  const [tiedSelection, setTiedSelection] = useState('all');

  const [undoModal, setUndoModal] = useState(false);
  const [undoReason, setUndoReason] = useState('');

  const [restoreModal, setRestoreModal] = useState(false);
  const [restoreTeamId, setRestoreTeamId] = useState('');
  const [restoreReason, setRestoreReason] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // 1. Authenticate admin
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then((data) => {
        if (data.user?.role !== 'admin') {
          router.push('/');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // 2. Fetch rounds & settings
  const fetchRoundsAndSettings = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch('/api/admin/rounds'),
        fetch('/api/admin/settings'),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setRounds(d.rounds || []);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSettings(d.settings || {});
      }
    } catch (err) {
      console.error('Fetch err:', err);
    }
  }, []);

  // 3. Fetch tab specific data
  const fetchTabData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'progress') {
        const res = await fetch(`/api/admin/progress?round=${selectedRound}`);
        if (res.ok) setProgressData(await res.json());
      } else if (activeTab === 'matrix') {
        const res = await fetch(`/api/admin/matrix?round=${selectedRound}`);
        if (res.ok) setMatrixData(await res.json());
      } else if (activeTab === 'standings') {
        const res = await fetch('/api/admin/standings');
        if (res.ok) setStandingsData(await res.json());
      }
    } catch (err) {
      console.error('Tab data err:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedRound]);

  useEffect(() => {
    if (user) {
      fetchRoundsAndSettings();
    }
  }, [user, fetchRoundsAndSettings]);

  useEffect(() => {
    if (user) {
      fetchTabData();
    }
  }, [user, activeTab, selectedRound, fetchTabData]);

  // Round Action Handler
  const handleRoundActionSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const { round, action } = roundModal;
      let newStatus = action === 'lock' ? 'locked' : 'open';

      const body = {
        roundNumber: round.round_number,
        status: newStatus,
        reason: roundReason,
      };

      if (action === 'open' && roundMaxMarks) {
        body.maxMarks = Number(roundMaxMarks);
      }

      const res = await fetch('/api/admin/rounds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to update round');

      showToast(`Round ${round.round_number} updated to ${newStatus}`);
      setRoundModal(null);
      setRoundMaxMarks('');
      setRoundReason('');
      fetchRoundsAndSettings();
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Matrix Mark Action Handler (Free slot, Edit, or Add on behalf)
  const handleMatrixActionSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const { action, mark, team, evaluator } = matrixActionModal;

      if (action === 'free') {
        const res = await fetch(`/api/admin/marks/${mark.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: matrixReason }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to free slot');
        showToast('Slot freed successfully');
      } else if (action === 'edit') {
        const res = await fetch(`/api/admin/marks/${mark.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: Number(matrixValue), reason: matrixReason }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to update mark');
        showToast('Mark updated successfully');
      } else if (action === 'add') {
        const res = await fetch('/api/admin/marks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: team.id,
            evaluatorId: evaluator.id,
            roundNumber: selectedRound,
            value: Number(matrixValue),
            reason: matrixReason,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to enter mark');
        showToast('Mark recorded successfully');
      }

      setMatrixActionModal(null);
      setMatrixValue('');
      setMatrixReason('');
      fetchTabData();
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Advance Top 10 Handler
  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const body = {
        action: 'advance',
        reason: advanceReason,
        overrideIncomplete: advanceConfirmation === 'CONFIRM',
        selectedTiedTeamIds: tiedSelection,
      };

      const res = await fetch('/api/admin/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'incomplete_teams' || d.error === 'tie_at_cut') {
          throw new Error(d.message);
        }
        throw new Error(d.error || 'Advancement failed');
      }

      showToast(d.message || 'Advanced top 10 finalists!');
      setAdvanceModal(false);
      setAdvanceReason('');
      setAdvanceConfirmation('');
      fetchTabData();
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Undo Advancement Handler
  const handleUndoSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const res = await fetch('/api/admin/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo', reason: undoReason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Undo failed');

      showToast('Advancement undone successfully.');
      setUndoModal(false);
      setUndoReason('');
      fetchTabData();
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Restore Dropped Team Handler
  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const res = await fetch('/api/admin/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          restoreTeamId,
          reason: restoreReason,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Restore failed');

      showToast(d.message);
      setRestoreModal(false);
      setRestoreTeamId('');
      setRestoreReason('');
      fetchTabData();
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Update Settings Handler
  const handleSettingsUpdate = async (field, value) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Update failed');
      setSettings(d.settings);
      showToast('Settings updated');
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center text-neutral-400 text-sm">
        Authenticating admin session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#ff7a1a] text-black font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-[#121212]/95 backdrop-blur-md border-b border-[#222222] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/')}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
              title="Back to Evaluator View"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-[#ff7a1a]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                HACK-O-LANTERN 2026 • Admin
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                fetchRoundsAndSettings();
                fetchTabData();
              }}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="text-xs text-neutral-400 border border-[#333] px-2.5 py-1 rounded-lg">
              Admin: <span className="text-[#ff7a1a] font-bold">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="bg-[#0e0e0e] border-b border-[#1f1f1f] px-4 py-2 sticky top-[57px] z-20">
        <div className="max-w-6xl mx-auto flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'rounds', label: 'Rounds', icon: Layers },
            { id: 'progress', label: 'Progress & Stats', icon: BarChart3 },
            { id: 'matrix', label: 'Marks Matrix', icon: TableIcon },
            { id: 'standings', label: 'Standings & Advance', icon: Trophy },
            { id: 'settings', label: 'Settings & Exports', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all ${
                  active
                    ? 'bg-[#ff7a1a] text-black shadow-md shadow-[#ff7a1a]/20'
                    : 'bg-[#161616] text-neutral-300 hover:bg-[#202020]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ======================================================== */}
        {/* TAB 1: ROUNDS MANAGEMENT */}
        {/* ======================================================== */}
        {activeTab === 'rounds' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Rounds Configuration & State</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage round progression, set max marks, lock or reopen scoring rounds.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {rounds.map((r) => {
                const isOpen = r.status === 'open';
                const isLocked = r.status === 'locked';
                const isNotStarted = r.status === 'not_started';
                const isFinal = r.round_number === 4;

                return (
                  <div
                    key={r.round_number}
                    className="p-5 rounded-2xl bg-[#121212] border border-[#242424] space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#ff7a1a] uppercase tracking-wider">
                          Round {r.round_number}
                        </span>
                        <h3 className="text-base font-bold text-white">{r.label}</h3>
                      </div>
                      <span
                        className={`text-xs uppercase font-bold px-2.5 py-1 rounded-full border ${
                          isOpen
                            ? 'bg-green-950/70 border-green-700 text-green-300'
                            : isLocked
                            ? 'bg-red-950/70 border-red-800 text-red-300'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#181818] p-3 rounded-xl border border-[#262626]">
                      <div>
                        <div className="text-neutral-500 uppercase tracking-wider text-[10px]">Max Marks</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {r.max_marks !== null ? r.max_marks : 'Not Set (Required)'}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-500 uppercase tracking-wider text-[10px]">
                          Evaluators / Team
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {r.evaluators_per_team} of 6
                        </div>
                      </div>
                    </div>

                    {isFinal && (
                      <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl">
                        Final Round: Requires Max Marks and Final Ranking Rule before opening. Scored teams must
                        be marked as Finalists.
                      </div>
                    )}

                    <div className="flex items-center space-x-2 pt-2 border-t border-[#1f1f1f]">
                      {isNotStarted && (
                        <button
                          onClick={() => {
                            setRoundModal({ round: r, action: 'open' });
                            setRoundMaxMarks(r.max_marks !== null ? String(r.max_marks) : '');
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-black font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Open Round</span>
                        </button>
                      )}

                      {isOpen && (
                        <button
                          onClick={() => {
                            setRoundModal({ round: r, action: 'lock' });
                          }}
                          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lock Round</span>
                        </button>
                      )}

                      {isLocked && (
                        <button
                          onClick={() => {
                            setRoundModal({ round: r, action: 'reopen' });
                            setRoundMaxMarks(r.max_marks !== null ? String(r.max_marks) : '');
                          }}
                          className="flex-1 bg-amber-600 hover:bg-amber-500 text-black font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reopen Round</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PROGRESS & EVALUATOR STATS */}
        {/* ======================================================== */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Scoring Progress & Evaluator Analytics</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Track real-time evaluation distribution and spot bias across evaluators.
                </p>
              </div>

              {/* Round switcher */}
              <div className="flex items-center space-x-1 bg-[#161616] p-1 rounded-xl border border-[#262626]">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedRound(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      selectedRound === num ? 'bg-[#ff7a1a] text-black' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    R{num}
                  </button>
                ))}
              </div>
            </div>

            {loading || !progressData ? (
              <div className="text-center py-12 text-neutral-500 text-xs">Loading analytics...</div>
            ) : (
              <div className="space-y-6">
                {/* Round Coverage Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-neutral-400 uppercase font-semibold">Total Teams</div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {progressData.teamCoverage.total}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-green-400 uppercase font-semibold">Fully Scored (3/3)</div>
                    <div className="text-2xl font-extrabold text-green-400 mt-1">
                      {progressData.teamCoverage.fullyScored}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-amber-400 uppercase font-semibold">Partially Scored</div>
                    <div className="text-2xl font-extrabold text-amber-400 mt-1">
                      {progressData.teamCoverage.partiallyScored}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-red-400 uppercase font-semibold">Unscored (0/3)</div>
                    <div className="text-2xl font-extrabold text-red-400 mt-1">
                      {progressData.teamCoverage.unscored}
                    </div>
                  </div>
                </div>

                {/* Evaluator Statistics (For information only, no auto-normalization) */}
                <div className="p-5 rounded-2xl bg-[#121212] border border-[#242424]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                    Evaluator Statistics (Round {selectedRound})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#222222] text-neutral-400">
                          <th className="pb-2">Username</th>
                          <th className="pb-2">Display Name</th>
                          <th className="pb-2">Teams Scored</th>
                          <th className="pb-2">Average Mark</th>
                          <th className="pb-2">Min Mark</th>
                          <th className="pb-2">Max Mark</th>
                          <th className="pb-2">Spread (Std Dev)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c1c1c]">
                        {progressData.evaluatorStats.map((e) => (
                          <tr key={e.username} className="hover:bg-[#181818]">
                            <td className="py-2.5 font-mono text-[#ff7a1a] font-semibold">{e.username}</td>
                            <td className="py-2.5 text-neutral-200">{e.displayName}</td>
                            <td className="py-2.5 text-white font-bold">{e.teamsScored}</td>
                            <td className="py-2.5 text-white font-mono">
                              {e.averageMark !== null ? e.averageMark : '—'}
                            </td>
                            <td className="py-2.5 text-neutral-400 font-mono">
                              {e.minMark !== null ? e.minMark : '—'}
                            </td>
                            <td className="py-2.5 text-neutral-400 font-mono">
                              {e.maxMark !== null ? e.maxMark : '—'}
                            </td>
                            <td className="py-2.5 text-neutral-400 font-mono">
                              {e.stdDev !== null ? e.stdDev : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: MARKS MATRIX (INTERACTIVE GRID) */}
        {/* ======================================================== */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Marks Matrix (Teams × Evaluators)</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Click on any cell to free a slot, edit a mark, or enter a mark on behalf of an evaluator.
                </p>
              </div>

              {/* Round switcher */}
              <div className="flex items-center space-x-1 bg-[#161616] p-1 rounded-xl border border-[#262626]">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedRound(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      selectedRound === num ? 'bg-[#ff7a1a] text-black' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    R{num}
                  </button>
                ))}
              </div>
            </div>

            {loading || !matrixData ? (
              <div className="text-center py-12 text-neutral-500 text-xs">Loading matrix...</div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#121212] border border-[#242424] overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#262626] text-neutral-400">
                      <th className="py-2.5 px-3">Team</th>
                      {matrixData.evaluators.map((e) => (
                        <th key={e.id} className="py-2.5 px-3 font-mono text-center">
                          {e.username}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e1e]">
                    {matrixData.matrix.map((row) => {
                      const count = row.marks.filter((m) => m !== null).length;
                      return (
                        <tr key={row.teamId} className="hover:bg-[#181818]">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono text-[#ff7a1a] font-bold mr-2">{row.teamId}</span>
                            <span className="font-medium text-white">{row.teamName}</span>
                          </td>

                          {matrixData.evaluators.map((ev, idx) => {
                            const mark = row.marks[idx];
                            return (
                              <td key={ev.id} className="py-2.5 px-3 text-center">
                                {mark ? (
                                  <button
                                    onClick={() => {
                                      setMatrixActionModal({
                                        team: { id: row.teamId, name: row.teamName },
                                        evaluator: ev,
                                        mark,
                                        action: 'edit',
                                      });
                                      setMatrixValue(String(mark.value));
                                      setMatrixReason('');
                                    }}
                                    className="px-2.5 py-1 rounded-md bg-[#1e1e1e] hover:bg-[#ff7a1a]/20 border border-[#333] hover:border-[#ff7a1a] text-white font-mono font-bold"
                                    title="Click to edit mark or free slot"
                                  >
                                    {mark.value}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setMatrixActionModal({
                                        team: { id: row.teamId, name: row.teamName },
                                        evaluator: ev,
                                        mark: null,
                                        action: 'add',
                                      });
                                      setMatrixValue('');
                                      setMatrixReason('');
                                    }}
                                    className="text-neutral-600 hover:text-neutral-300 font-mono text-[11px]"
                                    title="Enter mark on behalf"
                                  >
                                    +
                                  </button>
                                )}
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 text-center font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                count >= 3
                                  ? 'bg-green-950/70 border border-green-800 text-green-300'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {count} / 3
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: STANDINGS & TOP 10 ADVANCE */}
        {/* ======================================================== */}
        {activeTab === 'standings' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Standings & Finalist Advancement</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Calculated standings with round averages, cumulative totals, and top 10 finalist selection.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAdvanceModal(true)}
                  className="bg-[#ff7a1a] hover:bg-[#e5680d] text-black font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-[#ff7a1a]/20"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Advance Top 10</span>
                </button>

                <button
                  onClick={() => setUndoModal(true)}
                  className="bg-[#1f1f1f] hover:bg-[#282828] text-neutral-300 font-medium px-3 py-2 rounded-xl text-xs border border-[#333]"
                >
                  Undo Advance
                </button>

                <button
                  onClick={() => setRestoreModal(true)}
                  className="bg-[#1f1f1f] hover:bg-[#282828] text-neutral-300 font-medium px-3 py-2 rounded-xl text-xs border border-[#333]"
                >
                  Restore Dropped
                </button>
              </div>
            </div>

            {loading || !standingsData ? (
              <div className="text-center py-12 text-neutral-500 text-xs">Calculating standings...</div>
            ) : (
              <div className="space-y-4">
                {/* Warnings banner */}
                {standingsData.incompleteTeams?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Missing Marks:</span> {standingsData.incompleteTeams.length}{' '}
                      teams are incomplete in Rounds 1-3. Advancing requires typed confirmation and a logged
                      reason.
                    </div>
                  </div>
                )}

                {standingsData.tieAtCut && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Tie at Cut Line:</span> Multiple teams are tied at rank{' '}
                      {standingsData.tieAtCut.rank}. Automatic cut is refused until admin chooses tied teams.
                    </div>
                  </div>
                )}

                {/* Standings Table */}
                <div className="p-4 rounded-2xl bg-[#121212] border border-[#242424] overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#262626] text-neutral-400">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">R1 Avg</th>
                        <th className="py-2.5 px-3 text-right">R2 Avg</th>
                        <th className="py-2.5 px-3 text-right">R3 Avg</th>
                        <th className="py-2.5 px-3 text-right">Cumulative</th>
                        <th className="py-2.5 px-3 text-right">Final (R4)</th>
                        <th className="py-2.5 px-3 text-right font-bold text-[#ff7a1a]">Overall</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e1e]">
                      {standingsData.standings.map((team, idx) => {
                        const isFinalist = team.status === 'finalist';
                        const isDropped = team.status === 'dropped';
                        const isTop10 = idx < 10;

                        return (
                          <tr
                            key={team.teamId}
                            className={`hover:bg-[#181818] ${
                              isFinalist ? 'bg-[#ff7a1a]/5' : isDropped ? 'opacity-50' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {team.rank !== null ? `#${team.rank}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-mono text-[#ff7a1a] mr-2">{team.teamId}</span>
                              <span className="font-medium text-white">{team.teamName}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  isFinalist
                                    ? 'bg-amber-950/80 border border-amber-700 text-amber-300'
                                    : isDropped
                                    ? 'bg-neutral-800 text-neutral-400'
                                    : 'bg-neutral-800 text-neutral-200'
                                }`}
                              >
                                {team.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {team.roundScores[1] !== null ? team.roundScores[1] : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {team.roundScores[2] !== null ? team.roundScores[2] : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {team.roundScores[3] !== null ? team.roundScores[3] : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                              {team.cumulativeTotal}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {team.roundScores[4] !== null ? team.roundScores[4] : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#ff7a1a]">
                              {team.finalOverallScore !== null ? team.finalOverallScore : team.cumulativeTotal}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: SETTINGS & EXPORTS */}
        {/* ======================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">System Settings & Data Exports</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Configure public leaderboard display modes, final ranking formulas, and download verified CSVs.
              </p>
            </div>

            {settings && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Leaderboard Settings */}
                <div className="p-5 rounded-2xl bg-[#121212] border border-[#242424] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Leaderboard Controls
                  </h3>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 font-semibold">
                      Leaderboard Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['live', 'frozen', 'hidden'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleSettingsUpdate('leaderboard_mode', mode)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                            settings.leaderboard_mode === mode
                              ? 'bg-[#ff7a1a] text-black shadow-md shadow-[#ff7a1a]/20'
                              : 'bg-[#181818] text-neutral-400 hover:text-white border border-[#262626]'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 font-semibold">
                      Leaderboard Scope
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'finalists_only', label: 'Finalists Only' },
                        { id: 'all_teams', label: 'All 33 Teams' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSettingsUpdate('leaderboard_scope', item.id)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                            settings.leaderboard_scope === item.id
                              ? 'bg-[#ff7a1a] text-black shadow-md shadow-[#ff7a1a]/20'
                              : 'bg-[#181818] text-neutral-400 hover:text-white border border-[#262626]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Final Round Ranking Rule */}
                <div className="p-5 rounded-2xl bg-[#121212] border border-[#242424] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Final Round (Round 4) Ranking Formula
                  </h3>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 font-semibold">
                      Ranking Rule
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'final_only', label: 'Final Round Only' },
                        { id: 'cumulative', label: 'Cumulative (R1-R3 + Final)' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSettingsUpdate('final_ranking_rule', item.id)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                            settings.final_ranking_rule === item.id
                              ? 'bg-[#ff7a1a] text-black shadow-md shadow-[#ff7a1a]/20'
                              : 'bg-[#181818] text-neutral-400 hover:text-white border border-[#262626]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {settings.final_ranking_rule === 'cumulative' && (
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5 font-semibold">
                        Final Score Weight (default 1.0)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.final_weight}
                        onChange={(e) => handleSettingsUpdate('final_weight', Number(e.target.value))}
                        className="w-full bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                {/* CSV Exports */}
                <div className="md:col-span-2 p-5 rounded-2xl bg-[#121212] border border-[#242424] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Audit Data Exports (CSV)
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/api/admin/export?type=standings"
                      download
                      className="inline-flex items-center space-x-2 bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all"
                    >
                      <Download className="w-4 h-4 text-[#ff7a1a]" />
                      <span>Download Calculated Standings CSV</span>
                    </a>

                    <a
                      href="/api/admin/export?type=matrix"
                      download
                      className="inline-flex items-center space-x-2 bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all"
                    >
                      <Download className="w-4 h-4 text-[#ff7a1a]" />
                      <span>Download Marks Matrix & Log CSV</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: ROUND OPEN / LOCK / REOPEN */}
      {/* ======================================================== */}
      {roundModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">
              {roundModal.action === 'lock'
                ? `Lock Round ${roundModal.round.round_number}`
                : roundModal.action === 'reopen'
                ? `Reopen Round ${roundModal.round.round_number}`
                : `Open Round ${roundModal.round.round_number}`}
            </h2>

            {actionError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleRoundActionSubmit} className="space-y-4 mt-4">
              {roundModal.action !== 'lock' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Max Marks (Required)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={roundMaxMarks}
                    onChange={(e) => setRoundMaxMarks(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              )}

              {roundModal.action === 'reopen' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Reason for Reopening (Required)
                  </label>
                  <input
                    type="text"
                    required
                    value={roundReason}
                    onChange={(e) => setRoundReason(e.target.value)}
                    placeholder="Why is this round being reopened?"
                    className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoundModal(null)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#ff7a1a] text-black font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MATRIX CELL ACTION */}
      {/* ======================================================== */}
      {matrixActionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">
              {matrixActionModal.action === 'add'
                ? 'Enter Mark on Behalf'
                : matrixActionModal.action === 'free'
                ? 'Free Evaluation Slot'
                : 'Modify Mark'}
            </h2>
            <div className="text-xs text-neutral-400 mt-1">
              Team: <span className="text-white font-semibold">{matrixActionModal.team.name}</span> • Evaluator:{' '}
              <span className="text-[#ff7a1a] font-semibold">{matrixActionModal.evaluator.username}</span>
            </div>

            {actionError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleMatrixActionSubmit} className="space-y-4 mt-4">
              {matrixActionModal.action !== 'free' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                    Mark Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={matrixValue}
                    onChange={(e) => setMatrixValue(e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Reason (Required for Audit Log)
                </label>
                <textarea
                  required
                  rows={2}
                  value={matrixReason}
                  onChange={(e) => setMatrixReason(e.target.value)}
                  placeholder="Explain why this mark is being added, edited, or removed..."
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {matrixActionModal.mark && matrixActionModal.action !== 'free' && (
                <div className="pt-2 border-t border-[#222]">
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixActionModal((prev) => ({ ...prev, action: 'free' }));
                    }}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Want to remove this mark completely and free the slot?
                  </button>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMatrixActionModal(null)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 font-bold py-2.5 rounded-xl text-xs shadow-md ${
                    matrixActionModal.action === 'free'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-[#ff7a1a] hover:bg-[#e5680d] text-black'
                  }`}
                >
                  {matrixActionModal.action === 'free' ? 'Free Slot' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADVANCE TOP 10 */}
      {/* ======================================================== */}
      {advanceModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">Advance Top 10 to Final Round</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Ranks all teams by cumulative total of Rounds 1-3. Top 10 will become Finalists; others will be
              marked as Dropped.
            </p>

            {actionError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAdvanceSubmit} className="space-y-4 mt-4">
              {standingsData?.incompleteTeams?.length > 0 && (
                <div className="p-3 bg-amber-950/40 border border-amber-800 text-amber-200 text-xs rounded-xl space-y-2">
                  <div className="font-bold">
                    Warning: {standingsData.incompleteTeams.length} teams have missing marks!
                  </div>
                  <div>To advance anyway, type &quot;CONFIRM&quot; below:</div>
                  <input
                    type="text"
                    value={advanceConfirmation}
                    onChange={(e) => setAdvanceConfirmation(e.target.value)}
                    placeholder="Type CONFIRM"
                    className="w-full bg-[#1c1c1c] border border-amber-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              )}

              {standingsData?.tieAtCut && (
                <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-xl space-y-2">
                  <div className="font-bold">
                    Tie detected at rank {standingsData.tieAtCut.rank} ({standingsData.tieAtCut.teams.length}{' '}
                    teams):
                  </div>
                  <div className="text-[11px] text-neutral-300">
                    {standingsData.tieAtCut.teams.map((t) => `${t.name} (${t.id})`).join(', ')}
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="tieOption"
                        checked={tiedSelection === 'all'}
                        onChange={() => setTiedSelection('all')}
                      />
                      <span>Advance ALL tied teams</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Reason for Advancement (Required)
                </label>
                <input
                  type="text"
                  required
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  placeholder="e.g. End of Round 3 official advancement"
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdvanceModal(false)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#ff7a1a] hover:bg-[#e5680d] text-black font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Confirm Advancement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: UNDO ADVANCEMENT */}
      {/* ======================================================== */}
      {undoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">Undo Advancement</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Restores all teams back to active. (Only allowed before Round 4 opens).
            </p>

            <form onSubmit={handleUndoSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Reason (Required)
                </label>
                <input
                  type="text"
                  required
                  value={undoReason}
                  onChange={(e) => setUndoReason(e.target.value)}
                  placeholder="Why is advancement being undone?"
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUndoModal(false)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Undo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RESTORE DROPPED TEAM */}
      {/* ======================================================== */}
      {restoreModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative">
            <h2 className="text-base font-bold text-white">Restore Dropped Team</h2>
            <p className="text-xs text-neutral-400 mt-1">
              If a team was dropped by mistake, restore its status to active.
            </p>

            <form onSubmit={handleRestoreSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Team ID (e.g. VHK-1011)
                </label>
                <input
                  type="text"
                  required
                  value={restoreTeamId}
                  onChange={(e) => setRestoreTeamId(e.target.value)}
                  placeholder="Enter Team ID"
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Reason (Required)
                </label>
                <input
                  type="text"
                  required
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Reason for restoring"
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreModal(false)}
                  className="flex-1 bg-[#202020] text-neutral-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#ff7a1a] text-black font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Restore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

