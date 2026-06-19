import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, Pressable, Platform,
  Dimensions, PanResponder, ActivityIndicator, Animated, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { G, Line, Circle, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import { getGraphData } from '../services/api';
import { getEntries, MoodEntry } from '../utils/storage';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
  size: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  label: string;
}

const WIDTH = Dimensions.get('window').width;
const HEIGHT = 460;

export default function GraphViewScreen() {
  const router = useRouter();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [entriesCount, setEntriesCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(300)).current;
  
  // Pan and Zoom State
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Dragging active node reference
  const dragNodeIdRef = useRef<string | null>(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });

  const buildLocalGraph = (entries: MoodEntry[], userId: string) => {
    const nodesMap = new Map<string, any>();
    const links: any[] = [];

    const NODE_COLORS = {
      User: '#7c3aed',
      Mood: '#14b8a6',
      Sleep: '#3b82f6',
      Exercise: '#10b981',
      Study: '#eab308',
      Work: '#f97316',
      Habit: '#a855f7',
      Person: '#ec4899',
      Goal: '#06b6d4',
      Activity: '#f43f5e',
      BurnoutRisk: '#ef4444',
      Productivity: '#84cc16',
    };

    // Add User node
    nodesMap.set(userId, {
      id: userId,
      label: 'You (User)',
      type: 'User',
      color: NODE_COLORS.User,
      size: 24,
    });

    const last7 = entries.slice(-7);

    last7.forEach((e) => {
      const dateSuffix = e.date;
      const moodId = `mood_${dateSuffix}`;
      const sleepId = `sleep_${dateSuffix}`;
      const exerciseId = `exercise_${dateSuffix}`;
      const studyId = `study_${dateSuffix}`;
      const workId = `work_${dateSuffix}`;
      const burnoutId = `burnout_${dateSuffix}`;
      const prodId = `prod_${dateSuffix}`;

      // 1. Mood
      nodesMap.set(moodId, {
        id: moodId,
        label: `Mood: ${e.mood}/10`,
        type: 'Mood',
        color: NODE_COLORS.Mood,
        size: 18,
      });
      links.push({ id: `l_logged_${dateSuffix}`, source: userId, target: moodId, label: 'LOGGED' });

      // 2. Sleep
      const sleepHours = e.sleepHours ?? 7;
      nodesMap.set(sleepId, {
        id: sleepId,
        label: `Sleep: ${sleepHours} hrs`,
        type: 'Sleep',
        color: NODE_COLORS.Sleep,
        size: 14,
      });
      links.push({ id: `l_slept_${dateSuffix}`, source: userId, target: sleepId, label: 'SLEPT' });
      links.push({ id: `l_mood_sleep_${dateSuffix}`, source: moodId, target: sleepId, label: 'INFLUENCED_BY' });

      // 3. Exercise
      if (e.exerciseDuration > 0) {
        nodesMap.set(exerciseId, {
          id: exerciseId,
          label: `Exercise: ${e.exerciseDuration}m`,
          type: 'Exercise',
          color: NODE_COLORS.Exercise,
          size: 14,
        });
        links.push({ id: `l_exercised_${dateSuffix}`, source: userId, target: exerciseId, label: 'EXERCISED' });
      }

      // 4. Study
      if (e.studyHours > 0) {
        nodesMap.set(studyId, {
          id: studyId,
          label: `Study: ${e.studyHours}h`,
          type: 'Study',
          color: NODE_COLORS.Study,
          size: 14,
        });
        links.push({ id: `l_studied_${dateSuffix}`, source: userId, target: studyId, label: 'STUDIED' });
      }

      // 5. Work
      if (e.workHours > 0) {
        nodesMap.set(workId, {
          id: workId,
          label: `Work: ${e.workHours}h`,
          type: 'Work',
          color: NODE_COLORS.Work,
          size: 14,
        });
        links.push({ id: `l_worked_${dateSuffix}`, source: userId, target: workId, label: 'WORKED' });
      }

      // Burnout calculations
      let localBurnout = 0;
      if (e.mood < 5) localBurnout += 30;
      else if (e.mood < 7) localBurnout += 15;
      if (sleepHours < 6) localBurnout += 25;
      else if (sleepHours < 7) localBurnout += 10;
      if (e.stressLevel === 'High') localBurnout += 25;
      else if (e.stressLevel === 'Medium') localBurnout += 10;
      if (e.energy === 'Low') localBurnout += 20;

      const completedCount = Object.values(e.habits).filter(Boolean).length;
      const skipRate = (4 - completedCount) / 4;
      localBurnout += skipRate * 20;
      localBurnout = Math.min(Math.round(localBurnout), 100);

      nodesMap.set(burnoutId, {
        id: burnoutId,
        label: `Burnout: ${localBurnout}/100`,
        type: 'BurnoutRisk',
        color: NODE_COLORS.BurnoutRisk,
        size: 18,
      });
      links.push({ id: `l_burnout_${dateSuffix}`, source: userId, target: burnoutId, label: 'HAS_BURNOUT_RISK' });
      links.push({ id: `l_burnout_mood_${dateSuffix}`, source: burnoutId, target: moodId, label: 'BASED_ON' });
      links.push({ id: `l_burnout_sleep_${dateSuffix}`, source: burnoutId, target: sleepId, label: 'BASED_ON' });

      // Productivity calculations
      const totalFocusHours = parseFloat(String(e.workHours || 0)) + parseFloat(String(e.studyHours || 0));
      const focusPct = Math.min(totalFocusHours / 8, 1);
      let multiplier = 1;
      if (e.energy === 'Low') multiplier -= 0.2;
      if (e.stressLevel === 'High') multiplier -= 0.2;
      const habitMult = 0.5 + (completedCount / 4) * 0.5;
      let sleepMult = 1;
      if (sleepHours < 6) sleepMult = 0.7;
      else if (sleepHours < 7) sleepMult = 0.9;
      let localProductivity = Math.min(Math.max(Math.round(focusPct * 100 * multiplier * habitMult * sleepMult), 0), 100);

      nodesMap.set(prodId, {
        id: prodId,
        label: `Productivity: ${localProductivity}/100`,
        type: 'Productivity',
        color: NODE_COLORS.Productivity,
        size: 18,
      });
      links.push({ id: `l_prod_${dateSuffix}`, source: userId, target: prodId, label: 'HAS_PRODUCTIVITY' });
      links.push({ id: `l_prod_sleep_${dateSuffix}`, source: prodId, target: sleepId, label: 'INFLUENCED_BY' });

      // Habits
      const habit_defs = [
        { key: 'sleep', name: 'Sleep 7+ hours' },
        { key: 'exercise', name: 'Exercise' },
        { key: 'meditation', name: 'Meditation' },
        { key: 'deepWork', name: 'Deep Work' },
      ];
      habit_defs.forEach((hDef) => {
        const isCompleted = e.habits[hDef.key as keyof typeof e.habits];
        const habitNodeId = `habit_${hDef.key}`;
        nodesMap.set(habitNodeId, {
          id: habitNodeId,
          label: hDef.name,
          type: 'Habit',
          color: NODE_COLORS.Habit,
          size: 14,
        });

        links.push({ id: `l_habit_${hDef.key}_${dateSuffix}`, source: userId, target: habitNodeId, label: 'COMPLETED' });
        links.push({ id: `l_mood_habit_${hDef.key}_${dateSuffix}`, source: moodId, target: habitNodeId, label: 'INFLUENCED_BY' });

        if (isCompleted) {
          links.push({ id: `l_prod_habit_${hDef.key}_${dateSuffix}`, source: prodId, target: habitNodeId, label: 'INFLUENCED_BY' });
        }
      });

      // Goal node
      if (e.goalTitle) {
        const goalNodeId = `goal_${e.goalTitle.replace(/\s+/g, '_')}`;
        nodesMap.set(goalNodeId, {
          id: goalNodeId,
          label: e.goalTitle,
          type: 'Goal',
          color: NODE_COLORS.Goal,
          size: 14,
        });
        links.push({ id: `l_goal_${dateSuffix}`, source: userId, target: goalNodeId, label: 'PURSUING' });
      }

      // Person node
      if (e.socialInteraction) {
        const personNodeId = `person_${e.socialInteraction.replace(/\s+/g, '_')}`;
        nodesMap.set(personNodeId, {
          id: personNodeId,
          label: e.socialInteraction,
          type: 'Person',
          color: NODE_COLORS.Person,
          size: 14,
        });
        links.push({ id: `l_person_${dateSuffix}`, source: userId, target: personNodeId, label: 'INTERACTED_WITH' });
        links.push({ id: `l_prod_person_${dateSuffix}`, source: prodId, target: personNodeId, label: 'INFLUENCED_BY' });
      }

      // Activity node
      if (e.activityName) {
        const actNodeId = `act_${e.activityName.replace(/\s+/g, '_')}`;
        nodesMap.set(actNodeId, {
          id: actNodeId,
          label: e.activityName,
          type: 'Activity',
          color: NODE_COLORS.Activity,
          size: 14,
        });
        links.push({ id: `l_act_${dateSuffix}`, source: userId, target: actNodeId, label: 'PERFORMED' });
        links.push({ id: `l_mood_act_${dateSuffix}`, source: moodId, target: actNodeId, label: 'INFLUENCED_BY' });
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links,
    };
  };

  const fetchGraph = async () => {
    setLoading(true);
    setSelectedNodeId(null);
    try {
      const [storedUserId, storedPresMode, localEntries] = await Promise.all([
        AsyncStorage.getItem('@mindgraph_userId'),
        AsyncStorage.getItem('@mindgraph_presentation_mode'),
        getEntries(),
      ]);
      const userId = storedUserId || '';
      setIsPresentationMode(storedPresMode === 'true');
      setEntriesCount(localEntries.length);

      const data = await getGraphData(userId);
      
      let graphNodes = data.nodes;
      let graphLinks = data.links;

      if (!graphNodes || graphNodes.length <= 1) {
        const localGraph = buildLocalGraph(localEntries, userId || 'local_user');
        graphNodes = localGraph.nodes;
        graphLinks = localGraph.links;
      }

      // Copy nodes and initialize layout
      const finalNodes = graphNodes.map((n: any) => ({
        ...n,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0
      }));

      runForceSimulation(finalNodes, graphLinks, WIDTH, HEIGHT);
      
      setNodes(finalNodes);
      setLinks(graphLinks);
    } catch (err) {
      console.warn('Failed to load graph data from backend, using real offline nodes:', err);
      try {
        const localEntries = await getEntries();
        setEntriesCount(localEntries.length);
        const userId = (await AsyncStorage.getItem('@mindgraph_userId')) || 'local_user';
        const localGraph = buildLocalGraph(localEntries, userId);
        
        runForceSimulation(localGraph.nodes, localGraph.links, WIDTH, HEIGHT);
        setNodes(localGraph.nodes);
        setLinks(localGraph.links);
      } catch (localErr) {
        console.error('Failed to construct local offline graph:', localErr);
        setNodes([]);
        setLinks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Basic Force-Directed Placement Algorithm
  function runForceSimulation(simNodes: GraphNode[], simLinks: GraphLink[], width: number, height: number) {
    if (simNodes.length === 0) return;

    // Place initially in a circle around center
    simNodes.forEach((node, i) => {
      const angle = (i / simNodes.length) * 2 * Math.PI;
      node.x = width / 2 + 100 * Math.cos(angle);
      node.y = height / 2 + 100 * Math.sin(angle);
      node.vx = 0;
      node.vy = 0;
    });

    const iterations = 80;
    const k = Math.sqrt((width * height) / simNodes.length) * 0.4;

    for (let iter = 0; iter < iterations; iter++) {
      // 1. Repulsion force between nodes
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const n1 = simNodes[i];
          const n2 = simNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 180) {
            const force = (k * k) / dist;
            const fx = (dx / dist) * force * 0.12;
            const fy = (dy / dist) * force * 0.12;
            n1.vx = (n1.vx || 0) - fx;
            n1.vy = (n1.vy || 0) - fy;
            n2.vx = (n2.vx || 0) + fx;
            n2.vy = (n2.vy || 0) + fy;
          }
        }
      }

      // 2. Attraction force along links
      simLinks.forEach((link) => {
        const sourceNode = simNodes.find((n) => n.id === link.source);
        const targetNode = simNodes.find((n) => n.id === link.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist * dist) / k;
          const fx = (dx / dist) * force * 0.06;
          const fy = (dy / dist) * force * 0.06;
          sourceNode.vx = (sourceNode.vx || 0) + fx;
          sourceNode.vy = (sourceNode.vy || 0) + fy;
          targetNode.vx = (targetNode.vx || 0) - fx;
          targetNode.vy = (targetNode.vy || 0) - fy;
        }
      });

      // 3. Gravity center & position update
      simNodes.forEach((node) => {
        const dx = width / 2 - node.x;
        const dy = height / 2 - node.y;
        node.vx = (node.vx || 0) + dx * 0.015;
        node.vy = (node.vy || 0) + dy * 0.015;

        // Apply drag and update positions
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.6;
        node.vy *= 0.6;
      });
    }
  }

  // Touch & Drag Handling using PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const touchX = (gestureState.x0 - panX) / zoom;
        const touchY = (gestureState.y0 - 80 - panY) / zoom; // Adjust header offset

        // Find tapped node
        let clickedNodeId: string | null = null;
        for (const n of nodes) {
          const dx = n.x - touchX;
          const dy = n.y - touchY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 28) { // Tap range radius
            clickedNodeId = n.id;
            break;
          }
        }

        if (clickedNodeId) {
          // Select and start drag
          dragNodeIdRef.current = clickedNodeId;
          setSelectedNodeId(clickedNodeId);
          touchStartPosRef.current = { x: touchX, y: touchY };
        } else {
          // Started background pan
          dragNodeIdRef.current = null;
          panStartOffsetRef.current = { x: panX, y: panY };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const dragId = dragNodeIdRef.current;
        if (dragId) {
          // Drag node
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              if (n.id === dragId) {
                const newX = n.x + gestureState.dx / zoom;
                const newY = n.y + gestureState.dy / zoom;
                // Keep inside canvas constraints
                return {
                  ...n,
                  x: Math.max(20, Math.min(WIDTH - 20, newX)),
                  y: Math.max(20, Math.min(HEIGHT - 20, newY)),
                };
              }
              return n;
            })
          );
        } else {
          // Move viewport pan
          setPanX(panStartOffsetRef.current.x + gestureState.dx);
          setPanY(panStartOffsetRef.current.y + gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        dragNodeIdRef.current = null;
      },
    })
  ).current;

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setSelectedNodeId(null);
  };

  // Node Highlight filters
  const highlightedNodeIds = new Set<string>();
  const highlightedLinkIds = new Set<string>();

  if (selectedNodeId) {
    highlightedNodeIds.add(selectedNodeId);
    links.forEach((l) => {
      if (l.source === selectedNodeId) {
        highlightedNodeIds.add(l.target);
        highlightedLinkIds.add(l.id);
      } else if (l.target === selectedNodeId) {
        highlightedNodeIds.add(l.source);
        highlightedLinkIds.add(l.id);
      }
    });
  }

  // Find selected node details
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const connectedLinks = selectedNodeId ? links.filter((l) => l.source === selectedNodeId || l.target === selectedNodeId) : [];
  
  let influenceScore: number | null = null;
  let pathsList: string[] = [];
  if (selectedNode) {
    if (selectedNode.type === 'User') influenceScore = 100;
    else if (selectedNode.type === 'Mood') {
      const match = selectedNode.label.match(/\d+/);
      influenceScore = match ? Math.round(parseFloat(match[0]) * 10) : null;
    } else if (selectedNode.type === 'Productivity') {
      const match = selectedNode.label.match(/\d+/);
      influenceScore = match ? parseInt(match[0]) : null;
    } else if (selectedNode.type === 'BurnoutRisk') {
      const match = selectedNode.label.match(/\d+/);
      influenceScore = match ? parseInt(match[0]) : null;
    } else {
      let sum = 0;
      let count = 0;
      connectedLinks.forEach((link) => {
        const otherId = link.source === selectedNode.id ? link.target : link.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        if (otherNode && (otherNode.type === 'Mood' || otherNode.type === 'Productivity')) {
          const match = otherNode.label.match(/\d+/);
          const val = match ? parseInt(match[0]) : 0;
          if (val > 0) {
            sum += (otherNode.type === 'Mood' ? val * 10 : val);
            count++;
          }
        }
      });
      if (count > 0) influenceScore = Math.round(sum / count);
    }

    pathsList = connectedLinks.map((link) => {
      const s = nodes.find((n) => n.id === link.source);
      const t = nodes.find((n) => n.id === link.target);
      if (s && t) {
        return `(:${s.type} {label: "${s.label}"})-[:${link.label}]->(:${t.type} {label: "${t.label}"})`;
      }
      return '';
    }).filter(Boolean);
  }

  // Slide Anim trigger for side panel
  useEffect(() => {
    if (selectedNodeId) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 320,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedNodeId]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'User': return 'person';
      case 'Mood': return 'happy';
      case 'Sleep': return 'moon';
      case 'Exercise': return 'barbell';
      case 'Study': return 'book';
      case 'Work': return 'briefcase';
      case 'Habit': return 'checkmark-circle';
      case 'Person': return 'people';
      case 'Goal': return 'flag';
      case 'Activity': return 'flash';
      case 'Stress': return 'pulse';
      case 'BurnoutRisk': return 'flame';
      case 'Productivity': return 'trending-up';
      default: return 'help-circle';
    }
  };

  const getNodeEffect = (type: string) => {
    if (type === 'BurnoutRisk' || type === 'Stress') return 'Negative';
    if (type === 'User') return 'Neutral';
    return 'Positive';
  };

  const getNodeExplanation = (node: GraphNode) => {
    switch (node.type) {
      case 'User': return "This represents your central identity. All nodes and behaviors connect back to you.";
      case 'Mood': return "Your logged emotional state. Mood nodes act as key indicators of your overall mental wellness.";
      case 'Sleep': return "Sleep patterns directly dictate cognitive function, mood stability, and daily focus potential.";
      case 'Exercise': return "Physical activity triggers endorphins, boosts productivity, and significantly lowers burnout risk.";
      case 'Study': return "Dedicated learning blocks. Quality study is enhanced by high sleep and positive moods.";
      case 'Work': return "Professional work sessions. High density indicates high productivity, but watch stress levels.";
      case 'Habit': return "Habits build behavioral consistency. Completing routines forms the foundation of wellness.";
      case 'Person': return "Social interaction is a catalyst for emotional health, helping to lower daily stress levels.";
      case 'Goal': return "Goal pursuit provides a sense of direction and accomplishment, driving daily productivity.";
      case 'Activity': return "Hobbies and leisure activities. Essential for mental recovery and preventing focus fatigue.";
      case 'Stress': return "Stress indicators. High stress triggers burnout risks and negatively impacts sleep quality.";
      case 'BurnoutRisk': return "Physical and mental exhaustion. Lowered by completing habits and getting consistent sleep.";
      case 'Productivity': return "Focus output score. Highly correlated with consistency in sleep, work, and exercise.";
      default: return "A behavioral node in your network helping to map wellness correlations.";
    }
  };

  const formatPath = (rawPath: string) => {
    if (!isPresentationMode) return rawPath;
    try {
      const parts = rawPath.match(/label:\s*"([^"]+)"\}\)-\[:([^\]]+)\]->\(:[A-Za-z]+\s*\{label:\s*"([^"]+)"\}/);
      if (parts && parts.length === 3) {
        return `${parts[1]} ➔ ${parts[2].replace(/_/g, ' ')} ➔ ${parts[3]}`;
      }
      const partsAlt = rawPath.match(/label:\s*"([^"]+)"[^{}]*-\[:([^\]]+)\]->[^{}]*label:\s*"([^"]+)"/);
      if (partsAlt && partsAlt.length === 4) {
        return `${partsAlt[1]} ➔ ${partsAlt[2].replace(/_/g, ' ')} ➔ ${partsAlt[3]}`;
      }
    } catch {}
    return rawPath;
  };

  let calculatedInfluence = influenceScore;
  if (selectedNode && selectedNode.type !== 'User' && (influenceScore === null || influenceScore === 0)) {
    const connections = connectedLinks.length;
    calculatedInfluence = Math.min(96, Math.round(30 + (connections / Math.max(1, nodes.length)) * 140));
  }

  const getLegendItems = () => [
    { type: 'User', color: '#7c3aed' },
    { type: 'Mood', color: '#14b8a6' },
    { type: 'Sleep', color: '#3b82f6' },
    { type: 'Productivity', color: '#84cc16' },
    { type: 'Habit', color: '#a855f7' },
    { type: 'Burnout', color: '#ef4444' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Interactive Behavioral Graph</Text>
        <Text style={styles.subText}>Drag nodes, zoom, and tap to filter correlations.</Text>
      </View>

      {/* Legend board */}
      <View style={styles.legendRow}>
        {getLegendItems().map((item) => (
          <View key={item.type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.type}</Text>
          </View>
        ))}
      </View>

      {/* Graph Area */}
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.secondary} size="large" />
            <Text style={styles.loadingText}>Assembling graph relations from Neo4j...</Text>
          </View>
        ) : (entriesCount < 3 || nodes.length <= 1) ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyGraphic}>
              <Ionicons name="git-network-outline" size={48} color={Colors.secondary} />
            </View>
            <Text style={styles.emptyTitle}>Your behavioral graph is waiting to be discovered.</Text>
            <Text style={styles.emptyText}>
              Log at least 3 days of activity to unlock relationship intelligence.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyLogBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/log')}
            >
              <Ionicons name="create-outline" size={16} color="#1a1a2e" style={{ marginRight: 6 }} />
              <Text style={styles.emptyLogBtnText}>Start Logging</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1, position: 'relative' }}>
            <Svg width={WIDTH} height={HEIGHT} style={styles.svg}>
              {/* Viewport transformation group for links */}
              <G transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                {links.map((link) => {
                  const s = nodes.find((n) => n.id === link.source);
                  const t = nodes.find((n) => n.id === link.target);
                  if (!s || !t) return null;

                  const isHighlighted = selectedNodeId === null || highlightedLinkIds.has(link.id);
                  const opacity = isHighlighted ? 0.85 : 0.12;
                  const strokeColor = isHighlighted ? Colors.secondary : '#4b5563';

                  const midX = (s.x + t.x) / 2;
                  const midY = (s.y + t.y) / 2;
                  let angle = Math.atan2(t.y - s.y, t.x - s.x) * (180 / Math.PI);
                  if (angle > 90 || angle < -90) {
                    angle = angle + 180;
                  }

                  return (
                    <G key={link.id}>
                      <Line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={strokeColor}
                        strokeWidth={isHighlighted ? 2.5 : 1}
                        opacity={opacity}
                      />
                      {isHighlighted && selectedNodeId !== null && (
                        <SvgText
                          x={midX}
                          y={midY - 4}
                          fill={Colors.secondary}
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                          opacity={0.9}
                          transform={`rotate(${angle}, ${midX}, ${midY})`}
                        >
                          {link.label}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            </Svg>

            {/* Absolute container for Node views */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: WIDTH,
                height: HEIGHT,
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  transform: [
                    { translateX: panX },
                    { translateY: panY },
                    { scale: zoom }
                  ],
                  position: 'absolute',
                  width: WIDTH,
                  height: HEIGHT,
                }}
              >
                {nodes.map((node) => {
                  const isHighlighted = selectedNodeId === null || highlightedNodeIds.has(node.id);
                  const opacity = isHighlighted ? 1 : 0.22;
                  const isSelected = selectedNodeId === node.id;
                  const size = node.size || 16;

                  return (
                    <View
                      key={node.id}
                      style={[
                        styles.nodeView,
                        {
                          left: node.x - size,
                          top: node.y - size,
                          width: size * 2,
                          height: size * 2,
                          borderRadius: size,
                          backgroundColor: node.color || '#6b7280',
                          opacity: opacity,
                          borderWidth: isSelected ? 2.5 : 1.5,
                          borderColor: isSelected ? '#ffffff' : 'rgba(26, 21, 58, 0.6)',
                          transform: [{ scale: isSelected ? 1.15 : 1 }]
                        }
                      ]}
                    >
                      <Ionicons
                        name={getNodeIcon(node.type) as any}
                        size={Math.max(12, size * 0.95)}
                        color="#1a1a2e"
                      />
                      {/* Floating Text Label */}
                      <View style={[styles.nodeLabelContainer, { top: size * 2 + 3 }]}>
                        <Text style={styles.nodeLabelText} numberOfLines={1}>
                          {node.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Floating Zoom / Reset Tools */}
        <View style={styles.toolsContainer}>
          <Pressable style={styles.toolBtn} onPress={handleZoomIn}>
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={handleZoomOut}>
            <Ionicons name="remove" size={18} color="#fff" />
          </Pressable>
          <Pressable style={[styles.toolBtn, { width: 54 }]} onPress={handleReset}>
            <Text style={styles.toolBtnText}>Reset</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, { width: 54 }]} onPress={fetchGraph}>
            <Ionicons name="refresh" size={16} color="#fff" />
          </Pressable>
        </View>

        {/* Floating Sliding Details Panel */}
        {selectedNode && (
          <Animated.View
            style={[
              styles.slidePanel,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle} numberOfLines={1}>{selectedNode.label}</Text>
              <Pressable onPress={() => setSelectedNodeId(null)} style={styles.panelCloseBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>

            <ScrollView style={styles.panelContent} showsVerticalScrollIndicator={false}>
              <View style={styles.panelField}>
                <Text style={styles.panelFieldLbl}>Node Type</Text>
                <Text style={[styles.panelFieldVal, { color: selectedNode.color, fontWeight: '700' }]}>
                  {selectedNode.type}
                </Text>
              </View>

              <View style={styles.panelField}>
                <Text style={styles.panelFieldLbl}>Influence Score</Text>
                <Text style={styles.panelFieldVal}>
                  {calculatedInfluence !== null ? `${calculatedInfluence}%` : '—%'}
                </Text>
              </View>

              <View style={styles.panelField}>
                <Text style={styles.panelFieldLbl}>Effect / Impact</Text>
                <Text style={[styles.panelFieldVal, { color: getNodeEffect(selectedNode.type) === 'Positive' ? Colors.success : getNodeEffect(selectedNode.type) === 'Negative' ? Colors.danger : Colors.textSecondary }]}>
                  {getNodeEffect(selectedNode.type)}
                </Text>
              </View>

              <View style={styles.panelField}>
                <Text style={styles.panelFieldLbl}>Connected Nodes</Text>
                <View style={styles.connectedNodesRow}>
                  {connectedLinks.length > 0 ? (
                    connectedLinks.map((link, idx) => {
                      const otherId = link.source === selectedNode.id ? link.target : link.source;
                      const otherNode = nodes.find((n) => n.id === otherId);
                      if (!otherNode) return null;
                      return (
                        <View key={idx} style={[styles.connNodeChip, { borderColor: otherNode.color }]}>
                          <Text style={[styles.connNodeChipText, { color: otherNode.color }]}>
                            {otherNode.type}
                          </Text>
                        </View>
                      );
                    }).filter(Boolean)
                  ) : (
                    <Text style={styles.panelDesc}>No connections</Text>
                  )}
                </View>
              </View>

              <View style={styles.panelField}>
                <Text style={styles.panelFieldLbl}>Behavior Explanation</Text>
                <Text style={styles.panelDesc}>
                  {getNodeExplanation(selectedNode)}
                </Text>
              </View>

              <View style={styles.panelField}>
                <Text style={styles.panelFieldLbl}>Active Relationships</Text>
                {pathsList.length > 0 ? (
                  pathsList.map((p, i) => (
                    <View key={i} style={styles.cypherPathBox}>
                      <Ionicons name="link-outline" size={12} color={Colors.secondary} style={{ marginRight: 6 }} />
                      <Text style={styles.cypherPathText} numberOfLines={4}>
                        {formatPath(p)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.panelDesc}>No active relationships.</Text>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        )}
      </View>

      {/* Guide Card at bottom when no node selected */}
      {!selectedNode && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Ionicons name="git-network-outline" size={18} color={Colors.secondary} style={{ marginRight: 6 }} />
            <Text style={styles.detailTitle}>Neo4j Real-Time Mapping</Text>
          </View>
          <Text style={styles.detailDesc}>
            Tap any node bubble in the canvas to slide open the intelligence panel, highlighting its multi-hop wellness links.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  subText: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.three,
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  
  canvasContainer: {
    height: HEIGHT,
    backgroundColor: '#171330',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2a2456',
    position: 'relative',
    overflow: 'hidden',
  },
  svg: { flex: 1 },
  
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
  
  toolsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 90,
  },
  toolBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#1f1a3ad0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3e3870',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  
  detailCard: {
    margin: Spacing.three,
    backgroundColor: '#1f1a3a',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2a2456',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  detailDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  
  // Custom Rebuilt Node styles
  nodeView: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  nodeLabelContainer: {
    position: 'absolute',
    left: -40,
    width: 100,
    alignItems: 'center',
  },
  nodeLabelText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    backgroundColor: 'rgba(26, 21, 58, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#3a346e',
    textAlign: 'center',
  },
  
  // Custom sliding panel
  slidePanel: {
    position: 'absolute',
    top: 16,
    right: 16,
    bottom: 16,
    width: 250,
    backgroundColor: 'rgba(26, 21, 58, 0.95)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(20, 184, 166, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3a346e',
    paddingBottom: 8,
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  panelCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3a346e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelContent: {
    flex: 1,
  },
  panelField: {
    marginBottom: 10,
  },
  panelFieldLbl: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  panelFieldVal: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  panelDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  connectedNodesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  connNodeChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(26, 21, 58, 0.4)',
  },
  connNodeChipText: {
    fontSize: 8,
    fontWeight: '700',
  },
  cypherPathBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#16122d',
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: '#3a346e',
  },
  cypherPathText: {
    fontSize: 9,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    lineHeight: 12,
  },

  // Rebuilt Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#171330',
    padding: 24,
  },
  emptyGraphic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1f1a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#2e265c',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  emptyLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  emptyLogBtnText: {
    color: '#1a1a2e',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
