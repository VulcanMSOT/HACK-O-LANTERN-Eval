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
  X,
  Plus,
  Sliders,
  Check,
} from 'lucide-react';

const OFFICIAL_TRACKS = [
  {
    number: 1,
    title: "The Witch's Potion Pantry",
    category: 'AI + Full Stack + Web + Android',
    desc: 'Demand forecasting, full-moon spike handling, anomaly detection, and cross-platform inventory dashboard.',
  },
  {
    number: 2,
    title: 'The Midnight Phantom Hotline',
    category: 'AI + Systems',
    desc: 'Hinglish voice agent under 800 ms: code-mixed appointment/railway bookings, interruption handling, and 3G resilience.',
  },
  {
    number: 3,
    title: 'The Possessed Butler',
    category: 'AI Security',
    desc: 'Prompt-injection-proof AI agent: autonomous LLM agent that executes tasks safely while neutralizing prompt injections & secret leakage.',
  },
  {
    number: 4,
    title: 'The Midnight Crossroads',
    category: 'Computer Vision + Reinforcement Learning',
    desc: 'Indian traffic signal optimizer: CCTV queue estimation in mixed traffic and SUMO signal control to cut wait times.',
  },
  {
    number: 5,
    title: 'The Coven of Five Hospitals',
    category: 'Privacy + Machine Learning',
    desc: 'Federated learning with privacy: multi-hospital diagnostic model, zero raw data sharing, differential privacy, and Soul Thief defense.',
  },
];

const DEFAULT_ROUND_RUBRICS = {
  1: [
    { id: 'arch', name: 'System Architecture & Setup', max: 2.5, desc: 'Tech stack, DB schema, project scaffolding' },
    { id: 'core_flow', name: 'Core Flow & Basic Demo', max: 3.0, desc: 'End-to-end basic pipeline working end to end' },
    { id: 'integration', name: 'Backend & Data Integration', max: 2.5, desc: 'APIs, CRUD operations, database connection' },
    { id: 'code_quality', name: 'Code Quality & Approach', max: 2.0, desc: 'Clean codebase, structure, and error handling' },
  ],
  2: [
    { id: 'core_features', name: 'Core Feature Progress', max: 3.0, desc: 'Public test data flow and functional progress' },
    { id: 'curse', name: 'Midnight Curse Adaptation', max: 3.0, desc: 'Progress on the 12:00 AM track twist / curse' },
    { id: 'performance', name: 'Performance & Metrics', max: 2.0, desc: 'Latency, throughput, model accuracy, or speed' },
    { id: 'ui_ux', name: 'UI/UX & Interface Polish', max: 2.0, desc: 'Frontend visual polish, controls, and feedback' },
  ],
  3: [
    { id: 'hidden_tests', name: 'Hidden Tests & Edge Cases', max: 3.5, desc: 'Behavior on hidden test sets and boundary conditions' },
    { id: 'curse_robustness', name: 'Curse Mastery & Defense', max: 2.5, desc: 'Full curse implementation and live attack resilience' },
    { id: 'completeness', name: 'Completeness & Stability', max: 2.5, desc: 'Robust end-to-end system without fatal crashes' },
    { id: 'code_freeze', name: 'Code Freeze & Readme', max: 1.5, desc: 'Frozen commit verification and setup documentation' },
  ],
  4: [
    { id: 'live_demo', name: 'Live Demo Execution', max: 3.5, desc: 'Flawless live presentation and demo to judges' },
    { id: 'innovation', name: 'Innovation & Tech Depth', max: 2.5, desc: 'Technical complexity, originality and creative approach' },
    { id: 'scalability', name: 'Architecture & Scalability', max: 2.0, desc: 'Clean engineering design, scalability, and impact' },
    { id: 'defense_qa', name: 'Q&A Defense & Articulation', max: 2.0, desc: 'Convincing responses during 4 min judge Q&A' },
  ],
};

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

  // Problem Statement Selection state
  const [psData, setPsData] = useState(null);
  const [togglingPs, setTogglingPs] = useState(false);
  const [showPsModal, setShowPsModal] = useState(false);
  const [psSearch, setPsSearch] = useState('');

  // Editing Team Details Modal
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTrackNum, setEditTrackNum] = useState(1);
  const [editPsText, setEditPsText] = useState('');
  const [savingTeamEdit, setSavingTeamEdit] = useState(false);

  // Editing Round & Rubrics Modal
  const [editingRound, setEditingRound] = useState(null);
  const [editRoundLabel, setEditRoundLabel] = useState('');
  const [editRoundMaxMarks, setEditRoundMaxMarks] = useState('');
  const [editRoundEvaluators, setEditRoundEvaluators] = useState('3');
  const [editRoundParams, setEditRoundParams] = useState([]);
  const [savingRoundEdit, setSavingRoundEdit] = useState(false);

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

  // 2b. Fetch problem statement status
  const fetchPsData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/problem-statement/list');
      if (res.ok) {
        const d = await res.json();
        setPsData(d);
      }
    } catch (e) {
      console.error('Fetch ps err:', e);
    }
  }, []);

  const handleToggleProblemStatement = async () => {
    setTogglingPs(true);
    try {
      const res = await fetch('/api/admin/problem-statement/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to toggle selection window');
      showToast(d.message);
      fetchPsData();
    } catch (err) {
      alert(err.message);
    } finally {
      setTogglingPs(false);
    }
  };

  // Handlers for Editing Team Details & Problem Statement
  const handleOpenEditTeam = (team) => {
    setEditingTeam(team);
    setEditTeamName(team.name || '');
    setEditTrackNum(team.track_number !== null && team.track_number !== undefined ? team.track_number : 'custom');
    setEditPsText(team.problem_statement || `Track 1: ${OFFICIAL_TRACKS[0].title} (${OFFICIAL_TRACKS[0].category})`);
  };

  const handleTrackSelectChange = (trackChoice) => {
    if (trackChoice === 'custom') {
      setEditTrackNum('custom');
    } else {
      const num = Number(trackChoice);
      setEditTrackNum(num);
      const trackObj = OFFICIAL_TRACKS.find((t) => t.number === num);
      if (trackObj) {
        setEditPsText(`Track ${trackObj.number}: ${trackObj.title} (${trackObj.category})`);
      }
    }
  };

  const handleSaveTeamEdit = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;
    setSavingTeamEdit(true);
    try {
      const res = await fetch('/api/admin/problem-statement/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: editingTeam.id,
          teamName: editTeamName,
          problemStatement: editPsText,
          trackNumber: editTrackNum === 'custom' ? null : editTrackNum,
          action: 'update',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update team details.');
      showToast(data.message || 'Team details updated successfully!');
      setEditingTeam(null);
      fetchPsData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingTeamEdit(false);
    }
  };

  const handleClearTeamSubmission = async () => {
    if (!editingTeam) return;
    if (!confirm(`Are you sure you want to reset ${editingTeam.name} (${editingTeam.id}) back to Pending?`)) return;
    setSavingTeamEdit(true);
    try {
      const res = await fetch('/api/admin/problem-statement/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: editingTeam.id,
          action: 'clear',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear submission.');
      showToast(data.message || 'Submission cleared.');
      setEditingTeam(null);
      fetchPsData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingTeamEdit(false);
    }
  };

  // Handlers for Editing Round Details & Parameter Rubrics
  const handleOpenEditRound = (r) => {
    setEditingRound(r);
    setEditRoundLabel(r.label || `Round ${r.round_number}`);
    setEditRoundMaxMarks(r.max_marks !== null && r.max_marks !== undefined ? String(r.max_marks) : '10');
    setEditRoundEvaluators(String(r.evaluators_per_team || 3));
    const initialParams = (r.parameters && Array.isArray(r.parameters) && r.parameters.length > 0)
      ? r.parameters
      : (DEFAULT_ROUND_RUBRICS[r.round_number] || []);
    setEditRoundParams(JSON.parse(JSON.stringify(initialParams)));
  };

  const handleParamItemChange = (index, field, value) => {
    setEditRoundParams((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: field === 'max' ? Number(value) || 0 : value };
      return copy;
    });
  };

  const handleAddParamItem = () => {
    setEditRoundParams((prev) => [
      ...prev,
      {
        id: `param_${Date.now()}`,
        name: 'New Evaluation Parameter',
        max: 2.5,
        desc: 'Criteria and guidance for judges',
      },
    ]);
  };

  const handleRemoveParamItem = (index) => {
    setEditRoundParams((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResetParamsToDefault = () => {
    if (!editingRound) return;
    const def = DEFAULT_ROUND_RUBRICS[editingRound.round_number] || [];
    setEditRoundParams(JSON.parse(JSON.stringify(def)));
  };

  const handleSaveRoundEdit = async (e) => {
    e.preventDefault();
    if (!editingRound) return;
    setSavingRoundEdit(true);
    try {
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundNumber: editingRound.round_number,
          action: 'configure',
          label: editRoundLabel,
          maxMarks: editRoundMaxMarks ? Number(editRoundMaxMarks) : null,
          evaluatorsPerTeam: Number(editRoundEvaluators) || 3,
          parameters: editRoundParams,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update round configuration.');
      showToast(data.message || 'Round configuration updated!');
      setEditingRound(null);
      fetchRoundsAndSettings();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingRoundEdit(false);
    }
  };

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
      fetchPsData();
    }
  }, [user, fetchRoundsAndSettings, fetchPsData]);

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

            {/* Phase 0: Problem Statement Selection Control */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#151022] border border-[#3d2f5c] shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`p-2.5 rounded-xl border mt-0.5 flex-shrink-0 ${
                      psData?.isOpen
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-red-500/15 border-red-500/40 text-red-400'
                    }`}
                  >
                    {psData?.isOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#ffa95c] uppercase tracking-widest">
                        Phase 0 • Student Track Selection
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          psData?.isOpen
                            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                            : 'bg-red-950/80 border-red-500/40 text-red-300'
                        }`}
                      >
                        {psData?.isOpen ? '● OPEN — SUBMISSIONS ALLOWED' : '● LOCKED — SUBMISSIONS BLOCKED'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">Problem Statement Selection Window</h3>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      {psData?.isOpen ? (
                        <>
                          The selection window is currently <strong className="text-emerald-300 font-bold">OPEN</strong>. Students can submit their chosen problem statement at{' '}
                          <a
                            href="/problem-statement"
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-mono text-white hover:text-[#ff7a1a]"
                          >
                            /problem-statement
                          </a>{' '}
                          or{' '}
                          <a
                            href="/select"
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-mono text-white hover:text-[#ff7a1a]"
                          >
                            /select
                          </a>.
                        </>
                      ) : (
                        <>
                          The selection window is currently <strong className="text-red-300 font-bold">LOCKED</strong>. Students cannot submit or edit their problem statements.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="flex-shrink-0">
                  <button
                    onClick={handleToggleProblemStatement}
                    disabled={togglingPs}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95 ${
                      psData?.isOpen
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/40'
                        : 'bg-[#ff7a1a] hover:bg-[#e5680d] text-black shadow-[#ff7a1a]/20'
                    }`}
                  >
                    {togglingPs ? (
                      <span>Updating...</span>
                    ) : psData?.isOpen ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Lock Selection Window</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Open Problem Statement Selection</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Stats & View Submissions Button */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center space-x-4">
                  <span className="text-neutral-400">
                    Total Teams: <strong className="text-white">{psData?.totalTeams || 33}</strong>
                  </span>
                  <span className="text-neutral-400">
                    Submitted:{' '}
                    <strong className="text-emerald-400 font-bold">
                      {psData?.submittedCount || 0}
                    </strong>
                  </span>
                  <span className="text-neutral-400">
                    Pending:{' '}
                    <strong className="text-amber-400 font-bold">
                      {psData?.unsubmittedCount ?? 33}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowPsModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#251e36] hover:bg-[#302747] border border-white/15 text-white text-[11px] font-bold transition-colors flex items-center space-x-1.5"
                  >
                    <span>View Submitted Teams</span>
                    <span className="text-[#ffa95c]">&rarr;</span>
                  </button>
                  <a
                    href="/problem-statement"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-[11px] font-medium transition-colors"
                  >
                    Open Student Page &nearr;
                  </a>
                </div>
              </div>
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

                    {/* Parameter Rubrics Breakdown Preview */}
                    <div className="bg-[#181818] p-3 rounded-xl border border-[#262626] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                          Scoring Rubrics (Parameters)
                        </span>
                        <span className="text-[#ffa95c] font-mono font-bold">
                          {(r.parameters && Array.isArray(r.parameters) && r.parameters.length > 0 ? r.parameters : (DEFAULT_ROUND_RUBRICS[r.round_number] || [])).length} criteria · {r.max_marks ?? 10} pts max
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {(r.parameters && Array.isArray(r.parameters) && r.parameters.length > 0 ? r.parameters : (DEFAULT_ROUND_RUBRICS[r.round_number] || [])).map((p, idx) => (
                          <div key={p.id || idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-neutral-300 font-medium truncate mr-2 text-[11px]">{p.name}</span>
                            <span className="font-mono text-[#ff7a1a] font-bold flex-shrink-0 text-[11px]">{p.max} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {isFinal && (
                      <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl">
                        Final Round: Requires Max Marks and Final Ranking Rule before opening. Scored teams must
                        be marked as Finalists.
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#1f1f1f]">
                      <button
                        type="button"
                        onClick={() => handleOpenEditRound(r)}
                        className="flex-1 bg-[#1e172e] hover:bg-[#2b2142] text-[#ffa95c] border border-[#ff7a1a]/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Edit Details & Rubrics</span>
                      </button>

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      {progressData?.teamCoverage?.total ?? progressData?.summary?.totalTeams ?? 0}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-green-400 uppercase font-semibold">Fully Scored (3/3)</div>
                    <div className="text-2xl font-extrabold text-green-400 mt-1">
                      {progressData?.teamCoverage?.fullyScored ?? progressData?.summary?.teamsFullyScored ?? 0}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-amber-400 uppercase font-semibold">Partially Scored</div>
                    <div className="text-2xl font-extrabold text-amber-400 mt-1">
                      {progressData?.teamCoverage?.partiallyScored ?? progressData?.summary?.teamsPartiallyScored ?? 0}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#242424]">
                    <div className="text-[11px] text-red-400 uppercase font-semibold">Unscored (0/3)</div>
                    <div className="text-2xl font-extrabold text-red-400 mt-1">
                      {progressData?.teamCoverage?.unscored ?? progressData?.summary?.teamsUnscored ?? 0}
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
                        {(progressData?.evaluatorStats || []).map((e) => (
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      {(matrixData?.evaluators || []).map((e) => (
                        <th key={e.id} className="py-2.5 px-3 font-mono text-center">
                          {e.username}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e1e]">
                    {(Array.isArray(matrixData?.matrix) ? matrixData.matrix : []).map((row) => {
                      const count = (row?.marks || []).filter((m) => m !== null).length;
                      return (
                        <tr key={row.teamId} className="hover:bg-[#181818]">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono text-[#ff7a1a] font-bold mr-2">{row.teamId}</span>
                            <span className="font-medium text-white">{row.teamName}</span>
                          </td>

                          {(matrixData?.evaluators || []).map((ev, idx) => {
                            const mark = row?.marks?.[idx] || null;
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
                      {(standingsData?.standings || []).map((team, idx) => {
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
                    placeholder="e.g. 10"
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
                    {(standingsData?.tieAtCut?.teams || []).map((t) => `${t.name} (${t.id})`).join(', ')}
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

      {/* ======================================================== */}
      {/* MODAL: VIEW PROBLEM STATEMENT SUBMISSIONS */}
      {/* ======================================================== */}
      {showPsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#130f1e] border border-[#2d2540] rounded-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <div className="text-[10px] font-mono font-bold text-[#ffa95c] uppercase tracking-widest">
                  ROSTER TRACK ALLOCATION
                </div>
                <h2 className="text-base font-bold text-white mt-0.5">
                  Problem Statement Submissions
                </h2>
              </div>
              <button
                onClick={() => setShowPsModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter */}
            <div className="py-3">
              <input
                type="text"
                value={psSearch}
                onChange={(e) => setPsSearch(e.target.value)}
                placeholder="Search by team ID, name, or track..."
                className="w-full bg-[#1b152b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff7a1a]"
              />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto overflow-x-auto border border-white/5 rounded-xl bg-[#0e0a17]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#161026] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Problem Statement / Track</th>
                    <th className="py-2.5 px-3 text-right">Submitted</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(psData?.teams || [])
                    .filter((t) => {
                      if (!psSearch.trim()) return true;
                      const q = psSearch.toLowerCase();
                      return (
                        t.id.toLowerCase().includes(q) ||
                        t.name.toLowerCase().includes(q) ||
                        (t.problem_statement && t.problem_statement.toLowerCase().includes(q))
                      );
                    })
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-[#ff7a1a] font-bold mr-2">{t.id}</span>
                          <span className="font-medium text-white">{t.name}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {t.submission_id ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                              Confirmed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-400">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {t.problem_statement ? (
                            <span className="text-neutral-200 font-mono text-[11px]">
                              {t.problem_statement}
                            </span>
                          ) : (
                            <span className="text-neutral-500 italic text-[11px]">Not chosen yet</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-[11px] font-mono text-neutral-400">
                          {t.submitted_at ? new Date(t.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTeam(t)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#241c38] hover:bg-[#342752] border border-[#ff7a1a]/30 text-white font-semibold text-[11px] transition-colors"
                          >
                            <Edit2 className="w-3 h-3 text-[#ff7a1a]" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-mono">
                Showing {psData?.submittedCount || 0} of {psData?.totalTeams || 33} confirmed
              </span>
              <button
                type="button"
                onClick={() => setShowPsModal(false)}
                className="bg-[#ff7a1a] hover:bg-[#e5680d] text-black font-extrabold px-5 py-2 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT TEAM DETAILS & TRACK ALLOCATION */}
      {/* ======================================================== */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#140f21] border border-[#3d2f5a] rounded-2xl p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#ffa95c] uppercase tracking-widest">
                  ADMIN OVERRIDE
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Edit Details: <span className="text-[#ff7a1a]">{editingTeam.id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeamEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full bg-[#1e172e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7a1a]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Track Selection
                </label>
                <select
                  value={editTrackNum}
                  onChange={(e) => handleTrackSelectChange(e.target.value)}
                  className="w-full bg-[#1e172e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7a1a]"
                >
                  {OFFICIAL_TRACKS.map((track) => (
                    <option key={track.number} value={track.number}>
                      Track {track.number}: {track.title} ({track.category})
                    </option>
                  ))}
                  <option value="custom">Custom Problem Statement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Problem Statement Description / Title
                </label>
                <textarea
                  rows={3}
                  required
                  value={editPsText}
                  onChange={(e) => setEditPsText(e.target.value)}
                  placeholder="Enter problem statement details..."
                  className="w-full bg-[#1e172e] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff7a1a]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/10">
                {editingTeam.submission_id ? (
                  <button
                    type="button"
                    onClick={handleClearTeamSubmission}
                    disabled={savingTeamEdit}
                    className="px-3 py-2 rounded-xl bg-red-950/70 border border-red-800 text-red-300 hover:bg-red-900/60 text-xs font-semibold flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset to Pending</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingTeam(null)}
                    disabled={savingTeamEdit}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTeamEdit}
                    className="px-5 py-2 rounded-xl bg-[#ff7a1a] hover:bg-[#e5680d] text-black text-xs font-bold shadow-md shadow-[#ff7a1a]/25"
                  >
                    {savingTeamEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ROUND DETAILS & PARAMETER RUBRICS */}
      {/* ======================================================== */}
      {editingRound && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#140f21] border border-[#3d2f5a] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#ffa95c] uppercase tracking-widest">
                  ROUND CONFIGURATION & SCORING RUBRICS
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Configure {editingRound.label} (Round {editingRound.round_number})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRound(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoundEdit} className="space-y-4 pt-3 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1">
                    Round Label
                  </label>
                  <input
                    type="text"
                    required
                    value={editRoundLabel}
                    onChange={(e) => setEditRoundLabel(e.target.value)}
                    className="w-full bg-[#1e172e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7a1a]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase mb-1">
                    Max Marks
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={editRoundMaxMarks}
                    onChange={(e) => setEditRoundMaxMarks(e.target.value)}
                    className="w-full bg-[#1e172e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#ff7a1a]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white">
                      Parameter-Wise Scoring Rubrics
                    </label>
                    <p className="text-[11px] text-neutral-400">
                      Criteria judges evaluate during scoring. Sum of parameters should match Max Marks.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleResetParamsToDefault}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-[10px] font-semibold"
                    >
                      Reset to PPT Defaults
                    </button>
                    <button
                      type="button"
                      onClick={handleAddParamItem}
                      className="px-2.5 py-1 rounded-lg bg-[#ff7a1a]/15 hover:bg-[#ff7a1a]/25 border border-[#ff7a1a]/30 text-[#ff7a1a] text-[10px] font-bold flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Parameter</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {editRoundParams.map((param, idx) => (
                    <div
                      key={param.id || idx}
                      className="p-3 rounded-xl bg-[#191326] border border-white/5 space-y-2 relative group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Parameter Name (e.g. Architecture)"
                          value={param.name}
                          onChange={(e) => handleParamItemChange(idx, 'name', e.target.value)}
                          className="flex-1 bg-[#100b1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-[#ff7a1a]"
                        />
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <span className="text-[10px] font-mono text-neutral-400">Max:</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={param.max}
                            onChange={(e) => handleParamItemChange(idx, 'max', e.target.value)}
                            className="w-16 bg-[#100b1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-center text-[#ff7a1a] focus:outline-none focus:border-[#ff7a1a]"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveParamItem(idx)}
                            className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
                            title="Remove Parameter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Description / Guidance for judges..."
                        value={param.desc || ''}
                        onChange={(e) => handleParamItemChange(idx, 'desc', e.target.value)}
                        className="w-full bg-[#100b1a] border border-white/5 rounded-lg px-2.5 py-1 text-[11px] text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-white/20"
                      />
                    </div>
                  ))}
                </div>

                {/* Rubric Sum Indicator */}
                {(() => {
                  const paramSum = editRoundParams.reduce((acc, p) => acc + (Number(p.max) || 0), 0);
                  const maxMarksNum = Number(editRoundMaxMarks) || 0;
                  const isMatch = Math.abs(paramSum - maxMarksNum) < 0.01;
                  return (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                        isMatch
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                      }`}
                    >
                      <span>
                        Parameter Total: <strong>{paramSum.toFixed(2)}</strong> / Round Max:{' '}
                        <strong>{maxMarksNum.toFixed(2)}</strong>
                      </span>
                      {isMatch ? (
                        <span className="text-[11px] font-bold text-emerald-400">✓ Matches Max Marks</span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-400">
                          ⚠ Difference: {(maxMarksNum - paramSum).toFixed(2)} marks
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingRound(null)}
                  disabled={savingRoundEdit}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRoundEdit}
                  className="px-5 py-2 rounded-xl bg-[#ff7a1a] hover:bg-[#e5680d] text-black text-xs font-bold shadow-md shadow-[#ff7a1a]/25"
                >
                  {savingRoundEdit ? 'Saving...' : 'Save Round & Rubrics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

