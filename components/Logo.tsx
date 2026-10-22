// SARVAYUH lotus + heartbeat logo, drawn as SVG so it scales crisply on any screen.
// Works on iOS, Android and web via react-native-svg.
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

type LogoProps = {
  /** "blue" = blue mark with white highlights, "white" = all-white mark (use on dark backgrounds), "color" = original teal/navy/gold */
  variant?: 'blue' | 'white' | 'color';
  /** blue variant only: also draw the heartbeat line in white */
  whitePulse?: boolean;
  /** soft white glow around the mark (white variant looks best on dark backgrounds) */
  glow?: boolean;
  /** rendered width in px (height follows the 820:420 aspect ratio) */
  width?: number;
  title?: string;
};

const VB_W = 820;
const VB_H = 420;

export default function Logo({
  variant = 'blue',
  whitePulse = false,
  glow = false,
  width = 320,
  title = 'Lotus and heartbeat logo',
}: LogoProps) {
  const uid = useId().replace(/[:]/g, '');
  const isWhite = variant === 'white';
  const isBlue = variant === 'blue';

  const BLUE = '#1E4FB8';
  const lotusStroke = isWhite ? '#FFFFFF' : isBlue ? BLUE : `url(#lotus-${uid})`;
  const pulseStroke = isWhite || (isBlue && whitePulse) ? '#FFFFFF' : isBlue ? BLUE : '#0B2A6B';
  const goldStroke = isWhite || isBlue ? '#FFFFFF' : `url(#gold-${uid})`;

  const height = (width * VB_H) / VB_W;
  const pulse = (
    <G>
      {/* glow layers */}
      {glow && isWhite && (
        <>
          <Path d="M76 309 H124 L135 285 L156 345 L180 232 L201 375 L224 312" stroke="#FFFFFF" strokeWidth={30} strokeOpacity={0.14} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M76 309 H124 L135 285 L156 345 L180 232 L201 375 L224 312" stroke="#FFFFFF" strokeWidth={20} strokeOpacity={0.2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M744 309 H696 L685 285 L664 345 L640 232 L619 375 L596 312" stroke="#FFFFFF" strokeWidth={30} strokeOpacity={0.14} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M744 309 H696 L685 285 L664 345 L640 232 L619 375 L596 312" stroke="#FFFFFF" strokeWidth={20} strokeOpacity={0.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      <G stroke={pulseStroke} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M76 309 H124 L135 285 L156 345 L180 232 L201 375 L224 312" />
        <Path d="M744 309 H696 L685 285 L664 345 L640 232 L619 375 L596 312" />
      </G>
    </G>
  );

  const lotus = (
    <G>
      {/* glow layer behind the whole lotus */}
      {glow && isWhite && (
        <G stroke="#FFFFFF" strokeWidth={26} strokeOpacity={0.12} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M410 42 C372 108 330 150 330 207 C330 262 366 296 410 302 C454 296 490 262 490 207 C490 150 448 108 410 42 Z" />
          <Path d="M292 98 L346 124 C326 138 320 166 324 192 C302 172 288 136 292 98 Z" />
          <Path d="M528 98 L474 124 C494 138 500 166 496 192 C518 172 532 136 528 98 Z" />
          <Path d="M213 163 C256 158 302 176 324 216 C342 250 362 282 402 300" />
          <Path d="M213 163 C221 232 282 286 380 306" />
          <Path d="M607 163 C564 158 518 176 496 216 C478 250 458 282 418 300" />
          <Path d="M607 163 C599 232 538 286 440 306" />
          <Path d="M224 312 C262 284 332 290 366 306 C402 322 422 342 472 351 C524 358 582 344 596 312" />
          <Path d="M224 312 C234 342 292 366 352 350 C392 340 422 310 458 300 C520 286 580 294 596 312" />
          <Path d="M283 322 Q336 342 392 323" />
          <Path d="M437 329 Q492 340 545 320" />
        </G>
      )}
      <G stroke={lotusStroke} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* centre drop */}
        <Path d="M410 42 C372 108 330 150 330 207 C330 262 366 296 410 302 C454 296 490 262 490 207 C490 150 448 108 410 42 Z" />
        {/* back petals */}
        <Path d="M292 98 L346 124 C326 138 320 166 324 192 C302 172 288 136 292 98 Z" />
        <Path d="M528 98 L474 124 C494 138 500 166 496 192 C518 172 532 136 528 98 Z" />
        {/* side petals */}
        <Path d="M213 163 C256 158 302 176 324 216 C342 250 362 282 402 300" />
        <Path d="M213 163 C221 232 282 286 380 306" />
        <Path d="M607 163 C564 158 518 176 496 216 C478 250 458 282 418 300" />
        <Path d="M607 163 C599 232 538 286 440 306" />
        {/* base infinity swoosh */}
        <Path d="M224 312 C262 284 332 290 366 306 C402 322 422 342 472 351 C524 358 582 344 596 312" />
        <Path d="M224 312 C234 342 292 366 352 350 C392 340 422 310 458 300 C520 286 580 294 596 312" />
      </G>
    </G>
  );

  const crescents = (
    <G stroke={goldStroke} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M283 322 Q336 342 392 323" />
      <Path d="M437 329 Q492 340 545 320" />
    </G>
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={title}
      style={{ width, height }}
    >
      <Svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%">
        {(variant === 'color') && (
          <Defs>
            <LinearGradient id={`lotus-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#12A3A8" />
              <Stop offset="0.6" stopColor="#0F6E9A" />
              <Stop offset="1" stopColor="#0B2A6B" />
            </LinearGradient>
            <LinearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#E0A21B" />
              <Stop offset="1" stopColor="#B87810" />
            </LinearGradient>
          </Defs>
        )}
        {pulse}
        {lotus}
        {crescents}
      </Svg>
    </View>
  );
}

/*

Usage:

  // light pages (login / signup / onboarding):
  <Logo variant="color" width={190} />

  // dark backgrounds — white mark, optionally with the soft glow:
  <View style={{ backgroundColor: '#0B1F3A', padding: 24 }}>
    <Logo variant="white" glow width={220} />
  </View>

  // blue mark with white highlights:
  <Logo variant="blue" whitePulse width={220} />

*/
