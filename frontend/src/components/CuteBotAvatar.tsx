import React from 'react';

export type BotExpression = 'idle' | 'thinking' | 'typing' | 'happy' | 'concerned';

interface CuteBotAvatarProps {
  expression?: BotExpression;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSparkle?: boolean;
}

export const CuteBotAvatar: React.FC<CuteBotAvatarProps> = ({
  expression = 'idle',
  size = 'md',
  className = '',
  showSparkle = false,
}) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const pixelMap = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };

  const px = pixelMap[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeMap[size]} ${className}`}
      style={{ width: px, height: px }}
      title={`Rentu AI (${expression})`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm select-none transition-transform duration-300"
      >
        <defs>
          {/* Main soft body gradient */}
          <linearGradient id="bodyGrad" x1="20" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#FFF0F5" />
            <stop offset="1" stopColor="#FCE7F3" />
          </linearGradient>

          {/* Accent Pink Gradient */}
          <linearGradient id="pinkAccent" x1="30" y1="10" x2="70" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF77A9" />
            <stop offset="1" stopColor="#E11D74" />
          </linearGradient>

          {/* Lavender Ear Gradient */}
          <linearGradient id="earGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#F3E8FF" />
            <stop offset="1" stopColor="#E9D5FF" />
          </linearGradient>

          {/* Eye Sparkle Gradient */}
          <radialGradient id="eyeSparkle" cx="50%" cy="50%" r="50%">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Cute Rounded Ears / Antennas with Pink Tips */}
        {/* Left Ear */}
        <path
          d="M 28 32 C 16 16, 22 6, 32 18 Z"
          fill="url(#bodyGrad)"
          stroke="#E11D74"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="27" cy="18" r="4.5" fill="url(#pinkAccent)" />

        {/* Right Ear */}
        <path
          d="M 72 32 C 84 16, 78 6, 68 18 Z"
          fill="url(#bodyGrad)"
          stroke="#E11D74"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="73" cy="18" r="4.5" fill="url(#pinkAccent)" />

        {/* Center Little Floating Star/Heart Antenna */}
        <path
          d="M 50 15 L 50 25"
          stroke="#E11D74"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="50" cy="13" r="3.5" fill="#E11D74" />

        {/* 2. Chubby Head & Body Base */}
        <rect
          x="14"
          y="24"
          width="72"
          height="62"
          rx="31"
          fill="url(#bodyGrad)"
          stroke="#E11D74"
          strokeWidth="3.2"
        />

        {/* 3. Soft Rosy Blush Marks */}
        <ellipse cx="27" cy="62" rx="6" ry="3.5" fill="#FDA4AF" opacity="0.8" />
        <ellipse cx="73" cy="62" rx="6" ry="3.5" fill="#FDA4AF" opacity="0.8" />

        {/* 4. Expressive Eyes & Smile Based on Expression */}
        {expression === 'happy' ? (
          // Happy Arcs (Joyful squinting)
          <>
            <path
              d="M 32 50 Q 38 43 44 50"
              stroke="#1F2937"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 56 50 Q 62 43 68 50"
              stroke="#1F2937"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Open happy smile */}
            <path
              d="M 44 61 Q 50 70 56 61 Z"
              fill="#E11D74"
              stroke="#1F2937"
              strokeWidth="2"
            />
          </>
        ) : expression === 'thinking' ? (
          // Thinking (Looking up with curious gaze)
          <>
            {/* Left Eye looking up-right */}
            <circle cx="38" cy="46" r="6" fill="#1F2937" />
            <circle cx="40" cy="44" r="2.2" fill="#FFFFFF" />
            <circle cx="36" cy="48" r="1.2" fill="#FFFFFF" />

            {/* Right Eye looking up-right */}
            <circle cx="62" cy="46" r="6" fill="#1F2937" />
            <circle cx="64" cy="44" r="2.2" fill="#FFFFFF" />
            <circle cx="60" cy="48" r="1.2" fill="#FFFFFF" />

            {/* Curious little side-smile */}
            <path
              d="M 47 62 Q 53 64 55 60"
              stroke="#1F2937"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : expression === 'typing' ? (
          // Typing / Focused Winking
          <>
            {/* Left Eye Open sparkling */}
            <circle cx="38" cy="48" r="6.5" fill="#1F2937" />
            <circle cx="36" cy="46" r="2.5" fill="#FFFFFF" />
            <circle cx="40" cy="50" r="1.2" fill="#FFFFFF" />

            {/* Right Eye Playful Wink Arc */}
            <path
              d="M 57 48 Q 63 53 69 48"
              stroke="#1F2937"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Small content smile */}
            <path
              d="M 46 62 Q 50 67 54 62"
              stroke="#1F2937"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : expression === 'concerned' ? (
          // Concerned but sweet (worried eyebrows, open mouth)
          <>
            <path
              d="M 33 42 Q 38 45 43 43"
              stroke="#1F2937"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 57 43 Q 62 45 67 42"
              stroke="#1F2937"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="38" cy="49" r="5" fill="#1F2937" />
            <circle cx="37" cy="48" r="1.8" fill="#FFFFFF" />
            <circle cx="62" cy="49" r="5" fill="#1F2937" />
            <circle cx="61" cy="48" r="1.8" fill="#FFFFFF" />
            {/* Little worried O-mouth */}
            <circle cx="50" cy="62" r="2.5" fill="#E11D74" />
          </>
        ) : (
          // Default IDLE: Sweet large sparkling eyes and gentle warm smile
          <>
            {/* Left Eye */}
            <circle cx="38" cy="49" r="6.5" fill="#1F2937" />
            <circle cx="36" cy="46.5" r="2.5" fill="#FFFFFF" />
            <circle cx="40.5" cy="51" r="1.2" fill="#FFFFFF" />

            {/* Right Eye */}
            <circle cx="62" cy="49" r="6.5" fill="#1F2937" />
            <circle cx="60" cy="46.5" r="2.5" fill="#FFFFFF" />
            <circle cx="64.5" cy="51" r="1.2" fill="#FFFFFF" />

            {/* Gentle Cat-Style Sweet Smile */}
            <path
              d="M 45 61 Q 50 66 55 61"
              stroke="#1F2937"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}

        {/* 5. Sparkle Accent (Upper right) */}
        {(showSparkle || expression === 'happy' || expression === 'thinking') && (
          <path
            d="M 85 24 Q 85 30 89 30 Q 85 30 85 36 Q 85 30 81 30 Q 85 30 85 24 Z"
            fill="#FBBF24"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Typing dots overlay if in typing mode */}
      {expression === 'typing' && (
        <span className="absolute -bottom-1 -right-1 flex gap-0.5 bg-white dark:bg-[#1A1B24] border border-[#E11D74]/40 rounded-full px-1 py-0.5 shadow-xs">
          <span className="w-1 h-1 rounded-full bg-[#E11D74] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#E11D74] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#E11D74] animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      )}
    </div>
  );
};
