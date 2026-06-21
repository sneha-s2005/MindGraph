import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';

interface MoodGaugeProps {
  score?: number;
}

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const FilteredPath = React.forwardRef(({ collapsable, ...props }: any, ref: any) => (
  <Path ref={ref} {...props} />
));
FilteredPath.displayName = 'FilteredPath';

const FilteredLine = React.forwardRef(({ collapsable, ...props }: any, ref: any) => (
  <Line ref={ref} {...props} />
));
FilteredLine.displayName = 'FilteredLine';

const AnimatedPath = Animated.createAnimatedComponent(FilteredPath) as any;
const AnimatedLine = Animated.createAnimatedComponent(FilteredLine) as any;

/**
 * MoodGauge — arc-style burnout risk gauge (0–100).
 * 0–40  = Green (safe)
 * 41–70 = Yellow (caution)
 * 71–100= Red (burnout risk)
 */
export default function MoodGauge({ score = 0 }: MoodGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const [animScore] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animScore, {
      toValue: clampedScore,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [clampedScore, animScore]);

  // Semi-circle length
  const ARC_LENGTH = Math.PI * RADIUS;

  // Rotation from 0deg (left) to 180deg (right)
  const rotation = animScore.interpolate({
    inputRange: [0, 100],
    outputRange: ['0deg', '180deg'],
  });

  // Dashoffset from ARC_LENGTH (empty) to 0 (fully filled at 100)
  const dashoffset = animScore.interpolate({
    inputRange: [0, 100],
    outputRange: [ARC_LENGTH, ARC_LENGTH - (clampedScore / 100) * ARC_LENGTH],
  });

  let gaugeColor = '#10b981'; // green
  let label = 'Safe';
  if (clampedScore > 70) {
    gaugeColor = '#ef4444';
    label = 'Burnout Risk';
  } else if (clampedScore > 40) {
    gaugeColor = '#f59e0b';
    label = 'Caution';
  }

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE / 2 + 30} viewBox={`0 0 ${SIZE} ${SIZE / 2 + 30}`}>
        {/* Background arc — gray track */}
        <Path
          d={arcPath(CENTER, CENTER, RADIUS, 0, 180)}
          fill="none"
          stroke="#2a2456"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Colored fill arc (Animated) */}
        <AnimatedPath
          d={arcPath(CENTER, CENTER, RADIUS, 0, 180)}
          fill="none"
          stroke={gaugeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
          style={{
            strokeDashoffset: dashoffset,
          }}
        />
        {/* Zone markers */}
        <Path
          d={arcPath(CENTER, CENTER, RADIUS + STROKE / 2 + 4, 72, 73)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
        />
        <Path
          d={arcPath(CENTER, CENTER, RADIUS + STROKE / 2 + 4, 126, 127)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
        />
        {/* Needle (Animated G for rotation around center) */}
        <AnimatedLine
          x1={CENTER}
          y1={CENTER}
          x2={CENTER - (RADIUS - STROKE - 4)}
          y2={CENTER}
          stroke="#ffffff"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{
            transform: [
              { translateX: CENTER },
              { translateY: CENTER },
              { rotate: rotation },
              { translateX: -CENTER },
              { translateY: -CENTER },
            ],
          }}
        />
        {/* Center dot */}
        <Circle cx={CENTER} cy={CENTER} r={5} fill="#7c3aed" />
        {/* Score text */}
        <SvgText
          x={CENTER}
          y={CENTER - RADIUS / 2 + 20}
          textAnchor="middle"
          fontSize="28"
          fontWeight="bold"
          fill="#ffffff"
        >
          {clampedScore}
        </SvgText>
        <SvgText
          x={CENTER}
          y={CENTER - RADIUS / 2 + 38}
          textAnchor="middle"
          fontSize="11"
          fill={gaugeColor}
        >
          {label}
        </SvgText>
      </Svg>
      <Text style={styles.subtitle}>Burnout Risk Score</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
