'use client';

import { useState, useEffect } from 'react';
import Link from 'next/navigation';
import {
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  Shield,
  Layers,
} from 'lucide-react';

const TRACKS = [
  {
    number: 1,
    title: "The Witch's Potion Pantry",
    category: "AI + Full Stack + Web + Android",
    desc: "Demand forecasting, full-moon spike handling, anomaly detection, and cross-platform inventory dashboard.",
  },
  {
    number: 2,
    title: "The Midnight Phantom Hotline",
    category: "AI + Systems + Audio/Voice",
    desc: "Low-latency voice agent, ghost acoustic noise filtering, and high-concurrency telephony infrastructure.",
  },
  {
    number: 3,
    title: "The Haunted Archive",
    category: "Data + Search + Retrieval (RAG)",
    desc: "Cryptic manuscript OCR & search, hallucination containment under curse conditions, and fast semantic indexing.",
  },
  {
    number: 4,
    title: "The Graveyard Watch",
    category: "Cloud + DevOps + Reliability",
    desc: "Self-healing distributed systems, midnight chaos injection survival, automated failover, and metrics telemetry.",
  },
  {
    number: 5,
    title: "The Spooky Sandbox",
    category: "Open Innovation + Creative Tech",
    desc: "Novel Halloween-themed developer tools, interactive web toys, computer vision games, or experimental products.",
  },
];

export default function ProblemStatementSelectionPage() {
  const [status, setStatus] = useState(null); // { isOpen, submittedCount, totalTeams, teams }
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(1);
  const [customStatement, setCustomStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/problem-statement/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Fetch status err:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000); // Poll status every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedTeamId) {
      setErrorMsg('Please select your team.');
      return;
    }

    let statementText = '';
    let trackNum = null;

    if (selectedTrack === 'custom') {
      if (!customStatement.trim() || customStatement.trim().length < 5) {
        setErrorMsg('Please describe your custom problem statement (min 5 characters).');
        return;
      }
      statementText = customStatement.trim();
      trackNum = null;
    } else {
      const trackObj = TRACKS.find((t) => t.number === selectedTrack);
      if (!trackObj) {
        setErrorMsg('Invalid track selected.');
        return;
      }
      statementText = `Track ${trackObj.number}: ${trackObj.title} (${trackObj.category})`;
      trackNum = trackObj.number;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/problem-statement/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          problemStatement: statementText,
          trackNumber: trackNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit problem statement.');
      }

      setSuccessData({
        teamName: status?.teams?.find((t) => t.id === selectedTeamId)?.name || selectedTeamId,
        teamId: selectedTeamId,
        statement: statementText,
      });
      fetchStatus();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0912] text-neutral-100 selection:bg-[#ff7a1a]/30">
      {/* Header */}
      <header className="border-b border-[#2d2540] bg-[#120e1c]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#ff7a1a]/15 border border-[#ff7a1a]/40 flex items-center justify-center font-mono font-black text-[#ff7a1a]">
              &#123;V&#125;
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-widest text-[#ffa95c] font-bold">
                HACK-O-LANTERN 2026
              </div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                Problem Statement Selection
              </h1>
            </div>
          </div>

          <div>
            {status?.isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                WINDOW OPEN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-950/70 border border-red-500/40 text-red-300">
                <Lock className="w-3 h-3 text-red-400" />
                SELECTION CLOSED
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Alert Banner */}
        {loading ? (
          <div className="text-center py-12 text-neutral-400 text-xs">Loading selection window status...</div>
        ) : !status?.isOpen ? (
          <div className="mb-8 p-5 rounded-2xl bg-[#1f121d] border border-red-800/60 shadow-xl relative overflow-hidden">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex-shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-red-200 uppercase tracking-wider">
                  Problem Statement Selection is Currently Closed
                </h2>
                <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                  The organizers have locked the problem statement selection window. Teams cannot submit or change their selected track at this time. Please listen for the event announcement when organizers open the window.
                </p>
                <div className="mt-3 flex items-center space-x-4 text-[11px] text-neutral-400 font-mono">
                  <span>Total Teams: <strong className="text-white">{status?.totalTeams || 33}</strong></span>
                  <span>Submitted: <strong className="text-emerald-400">{status?.submittedCount || 0}</strong></span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 p-5 rounded-2xl bg-[#101b17] border border-emerald-700/60 shadow-xl relative overflow-hidden">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex-shrink-0 mt-0.5">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-emerald-200 uppercase tracking-wider">
                  Problem Statement Selection Window is OPEN!
                </h2>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Select your team ID and lock in your chosen problem statement or track below. Once confirmed, your selection will be recorded directly into the judging desk.
                </p>
                <div className="mt-2.5 flex items-center space-x-4 text-[11px] text-neutral-300 font-mono">
                  <span>Teams Registered: <strong className="text-white">{status?.totalTeams || 33}</strong></span>
                  <span>Teams Confirmed: <strong className="text-emerald-400">{status?.submittedCount || 0}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal / Banner */}
        {successData && (
          <div className="mb-8 p-6 rounded-2xl bg-[#142319] border border-emerald-500/80 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-white">Selection Confirmed!</h2>
            <p className="text-xs text-emerald-200/80 mt-1">
              Your problem statement has been successfully logged.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-[#0b140e] border border-emerald-900/60 max-w-md mx-auto text-left text-xs font-mono">
              <div className="text-neutral-400 text-[11px]">TEAM</div>
              <div className="text-white font-bold text-sm mb-2">
                {successData.teamName} <span className="text-[#ff7a1a]">({successData.teamId})</span>
              </div>
              <div className="text-neutral-400 text-[11px]">SELECTED PROBLEM STATEMENT</div>
              <div className="text-emerald-300 font-semibold mt-0.5">
                {successData.statement}
              </div>
            </div>
          </div>
        )}

        {/* Selection Form */}
        <div className="bg-[#171224] border border-[#2d2540] rounded-2xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Select Team */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                Step 1: Choose Your Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={!status?.isOpen || submitting}
                className="w-full bg-[#0c0912] border border-[#3b3252] rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-[#ff7a1a] disabled:opacity-50 disabled:cursor-not-allowed"
                required
              >
                <option value="">— Select your Team (ID & Name) —</option>
                {status?.teams?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1.5">
                Printed on your team QR pass lanyard.
              </p>
            </div>

            {/* Step 2: Choose Problem Statement / Track */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                Step 2: Choose Problem Statement / Track
              </label>

              <div className="space-y-2.5">
                {TRACKS.map((t) => {
                  const isSelected = selectedTrack === t.number;
                  return (
                    <div
                      key={t.number}
                      onClick={() => status?.isOpen && setSelectedTrack(t.number)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#261c3b] border-[#ff7a1a] shadow-lg shadow-[#ff7a1a]/10 ring-1 ring-[#ff7a1a]'
                          : 'bg-[#120e1a] border-[#292238] hover:border-neutral-600'
                      } ${!status?.isOpen ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#ff7a1a]">
                              TRACK {t.number}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-mono">
                              {t.category}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white mt-1">
                            {t.title}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            {t.desc}
                          </div>
                        </div>

                        <input
                          type="radio"
                          name="trackChoice"
                          checked={isSelected}
                          onChange={() => setSelectedTrack(t.number)}
                          disabled={!status?.isOpen}
                          className="mt-1 accent-[#ff7a1a]"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Custom Problem Statement Option */}
                <div
                  onClick={() => status?.isOpen && setSelectedTrack('custom')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedTrack === 'custom'
                      ? 'bg-[#261c3b] border-[#ff7a1a] shadow-lg shadow-[#ff7a1a]/10 ring-1 ring-[#ff7a1a]'
                      : 'bg-[#120e1a] border-[#292238] hover:border-neutral-600'
                  } ${!status?.isOpen ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs font-black text-[#ffa95c]">
                        CUSTOM PROBLEM STATEMENT
                      </div>
                      <div className="text-xs text-neutral-300 mt-0.5">
                        Have an organizer-approved custom statement or idea?
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="trackChoice"
                      checked={selectedTrack === 'custom'}
                      onChange={() => setSelectedTrack('custom')}
                      disabled={!status?.isOpen}
                      className="mt-1 accent-[#ff7a1a]"
                    />
                  </div>

                  {selectedTrack === 'custom' && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <textarea
                        rows={3}
                        value={customStatement}
                        onChange={(e) => setCustomStatement(e.target.value)}
                        placeholder="Type your approved problem statement / project title here..."
                        disabled={!status?.isOpen || submitting}
                        className="w-full bg-[#0c0912] border border-[#3b3252] rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!status?.isOpen || submitting}
                className="w-full py-3.5 px-6 rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-2 bg-[#ff7a1a] hover:bg-[#e5680d] text-black shadow-lg shadow-[#ff7a1a]/25 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submitting ? (
                  <span>Submitting Selection...</span>
                ) : !status?.isOpen ? (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Submissions Closed By Organizers
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Lock In Problem Statement <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
