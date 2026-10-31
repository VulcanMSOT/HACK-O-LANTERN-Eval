'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search, Shield, LogOut, CheckCircle2, Clock, AlertTriangle, ChevronRight, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

export default function EvaluatorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Scoring Modal state
  const [activeTeam, setActiveTeam] = useState(null);
  const [scoreInput, setScoreInput] = useState('');
  const [scoringMode, setScoringMode] = useState('parameters'); // 'parameters' | 'direct'
  const [paramScores, setParamScores] = useState({});
  const [scoreError, setScoreError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // 1. Load User Session
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => router.push('/login'));
  }, [router]);

  // 2. Load Rounds
  const loadRounds = useCallback(async () => {
    try {
      const res = await fetch('/api/eval/rounds');
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
        // Pick first open round, or round 1
        const open = data.rounds?.find((r) => r.status === 'open');
        if (open) setSelectedRound(open.round_number);
        else if (data.rounds?.[0]) setSelectedRound(data.rounds[0].round_number);
      }
    } catch (err) {
      console.error('Failed to load rounds:', err);
    }
  }, []);

  useEffect(() => {
    if (user) loadRounds();
  }, [user, loadRounds]);

  // 3. Load Teams for Selected Round
  const loadTeams = useCallback(async (roundNum) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eval/teams?round=${roundNum}`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && selectedRound) {
      loadTeams(selectedRound);
    }
  }, [user, selectedRound, loadTeams]);

  const currentRoundObj = useMemo(() => {
    return rounds.find((r) => r.round_number === selectedRound) || {};
  }, [rounds, selectedRound]);

  // Filtered & Grouped Teams
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.normalised_name && t.normalised_name.includes(q.replace(/\s+/g, '')))
    );
  }, [teams, search]);

  const availableTeams = useMemo(() => {
    return filteredTeams.filter((t) => !t.isFull && !t.myScore);
  }, [filteredTeams]);

  const completedOrFullTeams = useMemo(() => {
    return filteredTeams.filter((t) => t.isFull || t.myScore);
  }, [filteredTeams]);

  // Open Score Modal
  const handleOpenScoreModal = (team) => {
    setActiveTeam(team);
    const roundParams = currentRoundObj.parameters || [];
    const savedParams = team.myScore?.parameters || {};

    const initialParams = {};
    if (roundParams && roundParams.length > 0) {
      roundParams.forEach((p) => {
        initialParams[p.id] = savedParams[p.id] !== undefined ? Number(savedParams[p.id]) : 0;
      });
      setParamScores(initialParams);
      setScoringMode(team.myScore?.parameters ? 'parameters' : (roundParams.length > 0 ? 'parameters' : 'direct'));
    } else {
      setParamScores({});
      setScoringMode('direct');
    }

    setScoreInput(team.myScore?.value !== undefined ? String(team.myScore.value) : (roundParams.length > 0 && !team.myScore ? '0' : ''));
    setScoreError('');
  };

  const handleParamScoreChange = (paramId, rawVal, paramMax) => {
    const num = Math.max(0, Math.min(Number(paramMax) || 0, Number(rawVal) || 0));
    const next = { ...paramScores, [paramId]: num };
    setParamScores(next);

    const total = Object.values(next).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const rounded = Math.round(total * 100) / 100;
    setScoreInput(String(rounded));
  };

  // Handle QR Scan
  const handleQrScan = (decodedText) => {
    setScannerOpen(false);
    const raw = String(decodedText || '').trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Match by exact name, normalized name, or ID
    const match = teams.find(
      (t) =>
        t.name.toLowerCase() === raw.toLowerCase() ||
        t.normalised_name.replace(/[^a-z0-9]/g, '') === clean ||
        t.id.toLowerCase() === raw.toLowerCase()
    );

    if (match) {
      handleOpenScoreModal(match);
    } else {
      alert(`Scanned "${raw}" could not be matched to an active team.`);
    }
  };

  // Submit Score
  const handleSubmitScore = async (e) => {
    e.preventDefault();
    if (!activeTeam) return;

    setScoreError('');
    const val = Number(scoreInput);
    const max = Number(currentRoundObj.max_marks || 10);

    if (isNaN(val) || val < 0) {
      setScoreError('Please enter a valid non-negative number.');
      return;
    }
    if (val > max) {
      setScoreError(`Mark cannot exceed max marks of ${max}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/eval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: activeTeam.id,
          roundNumber: selectedRound,
          value: val,
          parameters: scoringMode === 'parameters' ? paramScores : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit mark.');
      }

      setSuccessToast(data.message || 'Score saved!');
      setTimeout(() => setSuccessToast(''), 3000);
      setActiveTeam(null);
      loadTeams(selectedRound);
    } catch (err) {
      setScoreError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center text-neutral-400 text-sm">
        Loading evaluator session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#ff7a1a] text-black font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg animate-bounce">
          {successToast}
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#121212]/90 backdrop-blur-md border-b border-[#222222] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="font-bold text-[#ff7a1a] text-sm tracking-tight">{'{V}'}</span>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-wider text-white">HACK-O-LANTERN 2026</h1>
              <div className="text-[11px] text-neutral-400">
                Logged in as <span className="text-white font-medium">{user.username}</span>
                {user.role === 'admin' && <span className="ml-1 text-[#ff7a1a]">(Admin)</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {user.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center space-x-1 bg-[#1e1e1e] hover:bg-[#282828] text-neutral-200 border border-[#333333] px-2.5 py-1.5 rounded-lg text-xs font-medium"
              >
                <Shield className="w-3.5 h-3.5 text-[#ff7a1a]" />
                <span>Admin</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Round Selector Tabs */}
      <div className="bg-[#0e0e0e] border-b border-[#1f1f1f] px-4 py-2 sticky top-[57px] z-20">
        <div className="max-w-2xl mx-auto flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {rounds.map((r) => {
            const isSelected = r.round_number === selectedRound;
            const isOpen = r.status === 'open';
            return (
              <button
                key={r.round_number}
                onClick={() => setSelectedRound(r.round_number)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  isSelected
                    ? 'bg-[#ff7a1a] text-black shadow-sm shadow-[#ff7a1a]/30'
                    : 'bg-[#181818] text-neutral-300 hover:bg-[#202020]'
                }`}
              >
                <span>{r.label}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOpen ? (isSelected ? 'bg-black' : 'bg-green-500') : 'bg-neutral-500'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Round Status Banner */}
        <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-400">Current Round Status</div>
            <div className="text-sm font-bold text-white flex items-center space-x-2 mt-0.5">
              <span>{currentRoundObj.label}</span>
              <span
                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                  currentRoundObj.status === 'open'
                    ? 'bg-green-950/80 border border-green-800 text-green-300'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-300'
                }`}
              >
                {currentRoundObj.status === 'open' ? 'Open for Scoring' : currentRoundObj.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-neutral-400">Max Marks</div>
            <div className="text-base font-extrabold text-[#ff7a1a]">
              {currentRoundObj.max_marks !== null ? currentRoundObj.max_marks : 'Not Set'}
            </div>
          </div>
        </div>

        {/* Action Bar: QR Scanner & Search */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex-shrink-0 inline-flex items-center space-x-2 bg-[#ff7a1a] hover:bg-[#e5680d] active:scale-[0.98] text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-[#ff7a1a]/20"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Pass</span>
          </button>

          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team ID or name..."
              className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a]"
            />
          </div>
        </div>

        {/* Team List Sections */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-xs">Loading team roster...</div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Teams Needing Marks (Fewest marks first) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span className="font-semibold uppercase tracking-wider text-neutral-300">
                  Needs Evaluators ({availableTeams.length})
                </span>
                <span className="text-[11px] text-[#ff7a1a]">Fewest scored first</span>
              </div>

              {availableTeams.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#121212] border border-[#222222] text-center text-xs text-neutral-500">
                  {search ? 'No matching available teams found.' : 'All available teams have been evaluated!'}
                </div>
              ) : (
                <div className="grid gap-2">
                  {availableTeams.map((team) => (
                    <div
                      key={team.id}
                      onClick={() => handleOpenScoreModal(team)}
                      className="p-3.5 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#242424] hover:border-[#ff7a1a]/40 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                          <span className="font-mono text-xs font-bold text-[#ff7a1a] flex-shrink-0">{team.id}</span>
                          <span className="text-xs sm:text-sm font-bold text-white break-words">{team.name}</span>
                          {team.status === 'finalist' && (
                            <span className="text-[9px] font-bold bg-amber-950/80 border border-amber-700 text-amber-300 px-1.5 py-0.2 rounded flex-shrink-0">
                              Finalist
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                            <span>
                              {team.marksCount} of {team.limit} scored
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-[11px] font-semibold text-[#ff7a1a] bg-[#ff7a1a]/10 border border-[#ff7a1a]/30 px-2.5 py-1 rounded-lg">
                          Score
                        </span>
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Completed by Me or Full */}
            {completedOrFullTeams.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#1e1e1e]">
                <div className="text-xs text-neutral-400 px-1 font-semibold uppercase tracking-wider text-neutral-300">
                  Scored by You or Full ({completedOrFullTeams.length})
                </div>

                <div className="grid gap-2">
                  {completedOrFullTeams.map((team) => {
                    const scoredByMe = !!team.myScore;
                    return (
                      <div
                        key={team.id}
                        onClick={() => handleOpenScoreModal(team)}
                        className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f] hover:border-neutral-700 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between opacity-90"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-medium text-neutral-400">{team.id}</span>
                            <span className="text-xs font-medium text-neutral-200">{team.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[11px] text-neutral-500">
                              {team.marksCount} of {team.limit} marks
                            </span>
                            {scoredByMe && (
                              <span className="text-[11px] text-green-400 flex items-center space-x-1 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Your Mark: {team.myScore.value}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-neutral-400">
                          {scoredByMe ? (
                            <span className="text-neutral-400 hover:text-white underline">Edit</span>
                          ) : (
                            <span className="text-neutral-500">Full</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* QR Scanner Modal */}
      {scannerOpen && <QrScanner onScan={handleQrScan} onClose={() => setScannerOpen(false)} />}

      {/* Scoring Modal */}
      {activeTeam && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setActiveTeam(null)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-3">
              <span className="font-mono text-xs font-bold text-[#ff7a1a]">{activeTeam.id}</span>
              <h2 className="text-lg font-bold text-white mt-0.5">{activeTeam.name}</h2>
              {activeTeam.problemStatement && (
                <div className="mt-1.5 p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="text-[10px] font-mono text-[#ffa95c] uppercase font-bold">Allocated Track</div>
                  <div className="text-neutral-200 mt-0.5 line-clamp-2">{activeTeam.problemStatement}</div>
                </div>
              )}
              <div className="flex items-center space-x-3 text-xs text-neutral-400 mt-2">
                <span>
                  {currentRoundObj.label} • Max Marks:{' '}
                  <strong className="text-white">{currentRoundObj.max_marks ?? '—'}</strong>
                </span>
                <span>•</span>
                <span>
                  Evaluators:{' '}
                  <strong className="text-neutral-300">
                    {activeTeam.marksCount} of {activeTeam.limit}
                  </strong>
                </span>
              </div>
            </div>

            {scoreError && (
              <div className="mb-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs font-medium flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{scoreError}</span>
              </div>
            )}

            {currentRoundObj.status !== 'open' ? (
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs text-center">
                This round is currently {currentRoundObj.status}. Scores cannot be submitted.
              </div>
            ) : activeTeam.isFull && !activeTeam.myScore ? (
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs text-center">
                This team already has {activeTeam.limit} evaluators in this round.
              </div>
            ) : (
              <form onSubmit={handleSubmitScore} className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* Scoring Mode Switcher if Round has parameters */}
                {currentRoundObj.parameters && currentRoundObj.parameters.length > 0 && (
                  <div className="flex rounded-xl bg-neutral-900 p-1 border border-white/10 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScoringMode('parameters')}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        scoringMode === 'parameters'
                          ? 'bg-[#ff7a1a] text-black font-bold shadow'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Parameter Rubrics ({currentRoundObj.parameters.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScoringMode('direct')}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        scoringMode === 'direct'
                          ? 'bg-[#ff7a1a] text-black font-bold shadow'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Direct Total Input
                    </button>
                  </div>
                )}

                {/* MODE A: PARAMETER WISE MARKING */}
                {scoringMode === 'parameters' && currentRoundObj.parameters && currentRoundObj.parameters.length > 0 ? (
                  <div className="space-y-3">
                    {currentRoundObj.parameters.map((param) => {
                      const curVal = paramScores[param.id] !== undefined ? paramScores[param.id] : 0;
                      return (
                        <div
                          key={param.id}
                          className="p-3 rounded-xl bg-[#1a1a1a] border border-white/5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-white">{param.name}</div>
                              {param.desc && (
                                <div className="text-[11px] text-neutral-400 mt-0.5">{param.desc}</div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-mono text-sm font-bold text-[#ff7a1a]">{curVal}</span>
                              <span className="text-[10px] text-neutral-500 font-mono"> / {param.max} pts</span>
                            </div>
                          </div>

                          {/* Quick Chips & Slider for Parameter */}
                          <div className="flex items-center space-x-1.5 pt-1">
                            <input
                              type="range"
                              min="0"
                              max={param.max}
                              step="0.25"
                              value={curVal}
                              onChange={(e) => handleParamScoreChange(param.id, e.target.value, param.max)}
                              className="flex-1 accent-[#ff7a1a] h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                            />
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {[
                                { label: '0', val: 0 },
                                { label: String(Math.round((param.max / 2) * 10) / 10), val: Math.round((param.max / 2) * 10) / 10 },
                                { label: 'Max', val: param.max },
                              ].map((chip, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleParamScoreChange(param.id, chip.val, param.max)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                                    curVal === chip.val
                                      ? 'bg-[#ff7a1a] text-black border-[#ff7a1a]'
                                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-white/5'
                                  }`}
                                >
                                  {chip.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Calculated Total Summary Card */}
                    <div className="p-3.5 rounded-xl bg-[#20182b] border border-[#ff7a1a]/40 shadow-inner flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffa95c]">
                          Calculated Total Score
                        </div>
                        <div className="text-xs text-neutral-300">
                          Sum of all parameter criteria
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black font-mono text-white">{scoreInput || 0}</span>
                        <span className="text-xs font-mono text-neutral-400 font-bold"> / {currentRoundObj.max_marks ?? 10}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MODE B: DIRECT NUMBER INPUT */
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                        Enter Total Marks
                      </label>
                      <span className="text-[11px] font-mono font-bold text-[#ff7a1a]">
                        Max: {currentRoundObj.max_marks ?? 10}
                      </span>
                    </div>

                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={currentRoundObj.max_marks ?? 10}
                      required
                      autoFocus
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#1c1c1c] border border-white/10 rounded-2xl px-4 py-3 text-3xl font-mono font-black text-center text-white focus:outline-none focus:border-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/30 shadow-inner transition-all"
                    />

                    {/* Rapid Score Quick Increment Chips */}
                    <div className="flex items-center justify-center space-x-1.5 mt-3">
                      {[1, 2, 5].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => {
                            const current = Number(scoreInput) || 0;
                            const max = Number(currentRoundObj.max_marks || 10);
                            setScoreInput(String(Math.min(max, current + inc)));
                          }}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-mono font-bold text-neutral-200 border border-white/5 transition-transform"
                        >
                          +{inc}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (currentRoundObj.max_marks !== null) {
                            setScoreInput(String(currentRoundObj.max_marks));
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#ff7a1a]/15 hover:bg-[#ff7a1a]/25 text-[#ff7a1a] active:scale-95 text-xs font-mono font-bold border border-[#ff7a1a]/30 transition-transform"
                      >
                        Max
                      </button>
                      <button
                        type="button"
                        onClick={() => setScoreInput('0')}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-mono font-bold text-neutral-400 border border-white/5 transition-transform"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#ff7a1a] hover:bg-[#e5680d] active:scale-[0.97] text-black font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-[#ff7a1a]/25 disabled:opacity-50 mt-2"
                >
                  {submitting
                    ? 'Recording Mark...'
                    : activeTeam.myScore
                    ? `Update Mark (${scoreInput || 0} pts)`
                    : `Confirm & Submit Mark (${scoreInput || 0} pts)`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

