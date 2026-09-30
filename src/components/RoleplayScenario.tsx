import React, { useState } from 'react';
import { 
  Coffee, 
  PartyPopper, 
  GraduationCap, 
  BookOpen, 
  Dumbbell, 
  Wine, 
  Sparkles, 
  Edit3, 
  Lightbulb, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  Smile,
  ShieldAlert,
  Flame,
  Clock
} from 'lucide-react';

export type ScenarioVibe = 'realistic' | 'warm' | 'reserved' | 'rejection';

export interface ScenarioItem {
  id: string;
  name: string;
  tagline: string;
  location: string;
  description: string;
  openerSuggestion: string;
  coachingTips: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: 'coffee' | 'party' | 'class' | 'book' | 'gym' | 'wine' | 'custom';
}

export interface ActiveScenario {
  id: string;
  name: string;
  location: string;
  description: string;
  openerSuggestion: string;
  vibe: ScenarioVibe;
  coachingTips: string[];
  isCustom?: boolean;
}

export const PRESET_SCENARIOS: ScenarioItem[] = [
  {
    id: 'coffee_shop',
    name: 'Coffee Shop',
    tagline: 'Casual daytime approach',
    location: 'Local Artisan Coffee Shop',
    description: 'She is sitting alone at a small wooden table near the sunlit window with an iced latte and a notebook, periodically glancing around.',
    openerSuggestion: '"Hey, quick question—is that the iced hazelnut or oat milk? I was debating what to order." Or comment on the busy line.',
    coachingTips: [
      'Focus on the shared environment; never use scripted pickup lines.',
      'Check if headphones are in. If she takes one out to reply, she is receptive.',
      'Keep initial interaction low-pressure (under 60 seconds) before gauging interest.'
    ],
    difficulty: 'Beginner',
    icon: 'coffee',
  },
  {
    id: 'house_party',
    name: 'Party / Social Event',
    tagline: 'High-energy social gathering',
    location: 'Weekend House Party / Mixer',
    description: 'Standing near the refreshment table holding a beverage, laughing with background music playing as friends step away.',
    openerSuggestion: '"Hey! How do you know the host?" or "I have to ask, what is this punch everyone is talking about?"',
    coachingTips: [
      'Match the room energy—speak clearly and project your voice with a warm smile.',
      'A relaxed toast or genuine situational observation breaks the ice immediately.',
      'Be friendly to anyone nearby; social fluidity creates natural charisma.'
    ],
    difficulty: 'Intermediate',
    icon: 'party',
  },
  {
    id: 'college_class',
    name: 'College Class / Campus',
    tagline: 'Shared student environment',
    location: 'Lecture Hall / University Campus',
    description: 'Sitting two seats over in the lecture hall 5 minutes before class starts, reviewing slides on a tablet.',
    openerSuggestion: '"Hey, are you ready for this midterm today? I feel like slide 14 made zero sense." Or introduce yourself as a seat neighbor.',
    coachingTips: [
      'Use the natural shared context of the class, professor, or campus life.',
      'Respect the time limit since class will start soon—no need to rush escalation.',
      'Exchange names naturally: "I\'m [Name], by the way."'
    ],
    difficulty: 'Beginner',
    icon: 'class',
  },
  {
    id: 'bookstore',
    name: 'Bookstore / Library',
    tagline: 'Quiet, observational setting',
    location: 'Independent Bookstore / Quiet Aisle',
    description: 'Standing in the bestseller / fiction aisle holding a paperback novel, reading the synopsis on the back cover.',
    openerSuggestion: '"Excuse me, have you read that author before? I was looking for a good weekend read." in a calm, measured voice.',
    coachingTips: [
      'Calibrate volume and tone to the quiet atmosphere—speak gently and unhurried.',
      'Respect personal space in narrow aisles; stand at an angle rather than blocking.',
      'Ask open-ended thoughts rather than interrogating her reading habits.'
    ],
    difficulty: 'Intermediate',
    icon: 'book',
  },
  {
    id: 'gym',
    name: 'Gym / Fitness Center',
    tagline: 'High-calibration setting',
    location: 'Fitness Club / Gym Floor',
    description: 'Resting by the water station between sets, wiping down a towel and switching tracks on her workout playlist.',
    openerSuggestion: '"Hey, quick check—are you using that bench over there?" or a quick, non-physical observation.',
    coachingTips: [
      'Never approach during an active workout set or when headphones are firmly sealed.',
      'Keep the exchange brief and zero-pressure; prioritize respect for her routine.',
      'If she gives short answers, gracefully smile, nod, and continue your workout.'
    ],
    difficulty: 'Advanced',
    icon: 'gym',
  },
  {
    id: 'lounge_bar',
    name: 'Lounge / Casual Bar',
    tagline: 'Evening relaxed setting',
    location: 'Dimly-Lit Cocktail Lounge',
    description: 'Sitting at the corner of the polished wooden bar waiting for the bartender to prepare her order.',
    openerSuggestion: '"Hey, that cocktail looks interesting—what did you order?" with relaxed, confident eye contact.',
    coachingTips: [
      'Slow down your speaking pace and maintain comfortable, relaxed posture.',
      'Use playful teasing and banter rather than rigid informational questioning.',
      'Read whether she turns her body towards you or keeps facing away.'
    ],
    difficulty: 'Intermediate',
    icon: 'wine',
  },
];

interface RoleplayScenarioProps {
  activeScenario: ActiveScenario;
  onChangeScenario: (scenario: ActiveScenario) => void;
  disabled?: boolean;
}

export const RoleplayScenario: React.FC<RoleplayScenarioProps> = ({
  activeScenario,
  onChangeScenario,
  disabled = false,
}) => {
  const [showTips, setShowTips] = useState<boolean>(false);
  const [isEditingCustom, setIsEditingCustom] = useState<boolean>(activeScenario.isCustom || false);
  const [customLocation, setCustomLocation] = useState<string>(activeScenario.isCustom ? activeScenario.location : '');
  const [customDescription, setCustomDescription] = useState<string>(activeScenario.isCustom ? activeScenario.description : '');

  const renderIcon = (icon: ScenarioItem['icon'], className = 'w-4 h-4') => {
    switch (icon) {
      case 'coffee':
        return <Coffee className={className} />;
      case 'party':
        return <PartyPopper className={className} />;
      case 'class':
        return <GraduationCap className={className} />;
      case 'book':
        return <BookOpen className={className} />;
      case 'gym':
        return <Dumbbell className={className} />;
      case 'wine':
        return <Wine className={className} />;
      default:
        return <MapPin className={className} />;
    }
  };

  const handleSelectPreset = (preset: ScenarioItem) => {
    if (disabled) return;
    setIsEditingCustom(false);
    onChangeScenario({
      id: preset.id,
      name: preset.name,
      location: preset.location,
      description: preset.description,
      openerSuggestion: preset.openerSuggestion,
      coachingTips: preset.coachingTips,
      vibe: activeScenario.vibe,
      isCustom: false,
    });
  };

  const handleSelectCustom = () => {
    if (disabled) return;
    setIsEditingCustom(true);
    onChangeScenario({
      id: 'custom',
      name: 'Custom Location',
      location: customLocation.trim() || 'Custom Setting',
      description: customDescription.trim() || 'You are approaching a woman at this location.',
      openerSuggestion: 'Introduce yourself naturally and reference something specific in this environment.',
      coachingTips: [
        'Notice situational details unique to this environment.',
        'Keep your opener natural, honest, and unscripted.',
        'Accept whatever response occurs with poise and composure.'
      ],
      vibe: activeScenario.vibe,
      isCustom: true,
    });
  };

  const handleCustomSubmit = () => {
    const loc = customLocation.trim() || 'Custom Setting';
    const desc = customDescription.trim() || 'You are approaching a woman at this location.';
    onChangeScenario({
      id: 'custom',
      name: loc,
      location: loc,
      description: desc,
      openerSuggestion: 'Introduce yourself naturally and reference something specific in this environment.',
      coachingTips: [
        'Notice situational details unique to this environment.',
        'Keep your opener natural, honest, and unscripted.',
        'Accept whatever response occurs with poise and composure.'
      ],
      vibe: activeScenario.vibe,
      isCustom: true,
    });
  };

  const handleVibeChange = (vibe: ScenarioVibe) => {
    if (disabled) return;
    onChangeScenario({
      ...activeScenario,
      vibe,
    });
  };

  const vibeOptions: { id: ScenarioVibe; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'realistic',
      label: 'Realistic / Dynamic',
      desc: 'Veronica reacts unpredictably (friendly, neutral, or distracted) based on your calibration.',
      icon: <Sparkles className="w-3.5 h-3.5 text-pink-400" />
    },
    {
      id: 'warm',
      label: 'Warm & Receptive',
      desc: 'She smiles, welcomes the chat, and helps you practice maintaining organic conversation.',
      icon: <Smile className="w-3.5 h-3.5 text-emerald-400" />
    },
    {
      id: 'reserved',
      label: 'Reserved / Short',
      desc: 'Gives brief answers ("Yeah?"). Teaches you to read disinterest without panicking.',
      icon: <Clock className="w-3.5 h-3.5 text-amber-400" />
    },
    {
      id: 'rejection',
      label: 'Rejection Drill',
      desc: 'She politely declines ("I have a boyfriend"). Practice handling rejection with calm dignity.',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
    },
  ];

  return (
    <div className="w-full max-w-lg mx-auto mt-4 mb-2 text-left transition-all">
      <div className="p-4 sm:p-5 rounded-2xl bg-[#121214] border border-white/10 shadow-xl relative overflow-hidden backdrop-blur-md">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-white tracking-wide flex items-center gap-2">
                <span>Roleplay Scenario</span>
                <span className="text-[10px] text-pink-400/90 font-mono font-normal bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                  Module 4
                </span>
              </h3>
              <p className="text-[11px] text-white/50 font-light">
                Choose where you want to practice approaching Veronica
              </p>
            </div>
          </div>

          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono hidden sm:inline-block">
            AI Context
          </span>
        </div>

        {/* Location Selector Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-3">
          {PRESET_SCENARIOS.map((preset) => {
            const isSelected = activeScenario.id === preset.id && !activeScenario.isCustom;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectPreset(preset)}
                className={`flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-pink-500/15 border-pink-500/60 text-white shadow-[0_0_15px_rgba(236,72,153,0.15)] ring-1 ring-pink-500/30'
                    : 'bg-[#18181B]/80 hover:bg-[#202024] border-white/5 text-white/70 hover:text-white'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`mb-1.5 ${isSelected ? 'text-pink-400' : 'text-white/60'}`}>
                  {renderIcon(preset.icon, 'w-4 h-4')}
                </div>
                <span className="text-[11px] font-medium leading-tight line-clamp-1">{preset.name}</span>
                <span className="text-[9px] text-white/40 mt-0.5 font-light">
                  {preset.difficulty}
                </span>
              </button>
            );
          })}

          {/* Custom Location Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleSelectCustom}
            className={`flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border text-center transition-all ${
              activeScenario.isCustom
                ? 'bg-pink-500/15 border-pink-500/60 text-white shadow-[0_0_15px_rgba(236,72,153,0.15)] ring-1 ring-pink-500/30'
                : 'bg-[#18181B]/80 hover:bg-[#202024] border-white/5 text-white/70 hover:text-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`mb-1.5 ${activeScenario.isCustom ? 'text-pink-400' : 'text-white/60'}`}>
              <Edit3 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium leading-tight">Custom</span>
            <span className="text-[9px] text-white/40 mt-0.5 font-light">Your venue</span>
          </button>
        </div>

        {/* Custom Input Fields if Custom is selected */}
        {activeScenario.isCustom && (
          <div className="mb-3.5 p-3 rounded-xl bg-[#18181B] border border-pink-500/30 space-y-2">
            <div>
              <label className="text-[10px] text-white/60 font-medium block mb-1">
                Custom Venue / Location Name
              </label>
              <input
                type="text"
                disabled={disabled}
                placeholder="e.g. Dog Park, Art Gallery, Grocery Aisle, Airport"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                onBlur={handleCustomSubmit}
                className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-pink-500/50 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/60 font-medium block mb-1">
                What is Veronica doing there? (Scene context)
              </label>
              <textarea
                disabled={disabled}
                rows={2}
                placeholder="e.g. Walking her golden retriever, looking at modern photography, examining organic produce..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                onBlur={handleCustomSubmit}
                className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-pink-500/50 outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Selected Scenario Preview Box */}
        <div className="p-3 rounded-xl bg-[#161619] border border-white/5 mb-3.5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-pink-400 block font-medium">
                Live Scene Setup
              </span>
              <h4 className="text-xs font-semibold text-white tracking-wide">
                {activeScenario.location}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
              <span>{activeScenario.vibe === 'realistic' ? 'Dynamic' : activeScenario.vibe === 'warm' ? 'Receptive' : activeScenario.vibe === 'reserved' ? 'Reserved' : 'Rejection'}</span>
            </div>
          </div>

          <p className="text-xs text-white/70 font-light leading-relaxed mb-2.5">
            {activeScenario.description}
          </p>

          {/* Opener Suggestion Box */}
          <div className="p-2.5 rounded-lg bg-pink-500/5 border border-pink-500/20 text-left">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-pink-300 mb-1">
              <Lightbulb className="w-3 h-3 text-pink-400 shrink-0" />
              <span>Situational Opener Inspiration:</span>
            </div>
            <p className="text-[11px] text-white/80 font-light italic leading-normal">
              {activeScenario.openerSuggestion}
            </p>
          </div>
        </div>

        {/* Veronica's Attitude / Vibe Selector */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-white/80 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3 text-pink-400" />
              <span>Veronica's Receptivity & Reaction</span>
            </label>
            <span className="text-[10px] text-white/40">Select training difficulty</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {vibeOptions.map((opt) => {
              const isSelected = activeScenario.vibe === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleVibeChange(opt.id)}
                  title={opt.desc}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-all ${
                    isSelected
                      ? 'bg-pink-500/20 border-pink-500/60 text-white font-medium shadow-sm'
                      : 'bg-[#18181B]/60 hover:bg-[#202024] border-white/5 text-white/60 hover:text-white'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="shrink-0">{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expandable Location Coaching Checklist */}
        <div>
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="w-full flex items-center justify-between text-[11px] text-white/60 hover:text-white py-1 transition-colors group"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-pink-400/80 group-hover:text-pink-400" />
              <span className="font-light">Key rules for approaching at this location</span>
            </span>
            {showTips ? (
              <ChevronUp className="w-3.5 h-3.5 text-white/40" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            )}
          </button>

          {showTips && (
            <ul className="mt-2 space-y-1.5 text-[11px] text-white/70 font-light bg-[#161619] p-2.5 rounded-xl border border-white/5">
              {activeScenario.coachingTips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-pink-400 font-mono text-[10px] mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer instruction banner */}
        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-pink-400/70" />
            <span>Veronica will roleplay this exact woman when the call starts</span>
          </span>
          <span className="text-pink-400 font-medium">Ready</span>
        </div>
      </div>
    </div>
  );
};

export default RoleplayScenario;
