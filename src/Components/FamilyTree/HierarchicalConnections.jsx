/**
 * User-Centric Radial Connections Component
 * Renders clean direct connections for radial layout
 * Color-coded by relationship type
 */

import React from "react";
import PropTypes from "prop-types";
import { calculateCanvasBounds } from "../../utils/HierarchicalTreeLayout";

const HierarchicalConnections = ({ positions = new Map(), connections = [] } = {}) => {
  // Calculate canvas size
  const canvasSize = React.useMemo(() => {
    if (!positions || positions.size === 0) {
      return { width: 2000, height: 2000 };
    }
    return calculateCanvasBounds(positions);
  }, [positions]);

  // Generate connection paths with family-unit-based T-shaped routing
  const connectionPaths = React.useMemo(() => {
    if (!connections || !positions) return [];

    const allPaths = [];

    // Group connections by type
    const spouseConnections = connections.filter((c) => c.type === "spouse");
    const parentChildConnections = connections.filter(
      (c) => c.type === "parent-child"
    );

    // 1. Draw spouse connections first (simple horizontal line touching card edges)
    spouseConnections.forEach((conn, index) => {
      const fromPos = positions.get(conn.from);
      const toPos = positions.get(conn.to);

      if (fromPos && toPos) {
        // Calculate actual card edge positions
        // Cards are now 160px wide (from Person.jsx)
        // So use 80px (half of 160) to touch actual card edges
        const ACTUAL_CARD_HALF_WIDTH = 70;
        const fromX = fromPos.x + ACTUAL_CARD_HALF_WIDTH; // Right edge of left card
        const toX = toPos.x - ACTUAL_CARD_HALF_WIDTH; // Left edge of right card
        const y = fromPos.y; // Same Y level (middle of cards)

        const path = `M ${fromX} ${y} L ${toX} ${y}`;

        // Add junction dot at center of spouse line (where child connection will start)
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = fromPos.y;

        allPaths.push(
          {
            id: `spouse-${index}`,
            path: path,
            type: "spouse",
            from: conn.from,
            to: conn.to,
            fromPos: fromPos,
            toPos: toPos,
            showMarriageSymbol: false, // Don't show marriage symbol
          },
          {
            id: `spouse-junction-${index}`,
            type: "junction",
            point: { x: midX, y: midY },
            color: "#f59e0b", // Orange to match other connections
            spouseMidpoint: { x: midX, y: midY }, // Store for connecting line
          }
        );
      }
    });

    // 2. Group children by their parent couples (family units)
    const familyUnits = new Map(); // coupleKey -> { parentIds: [], childrenIds: Set }

    parentChildConnections.forEach((conn) => {
      // Check if this parent has a spouse
      const parentSpouseConn = spouseConnections.find(
        (c) => c.from === conn.from || c.to === conn.from
      );

      let coupleKey;
      let parentIds = [conn.from];

      if (parentSpouseConn) {
        // This parent has a spouse - create couple key
        const spouseId =
          parentSpouseConn.from === conn.from
            ? parentSpouseConn.to
            : parentSpouseConn.from;
        const sortedIds = [conn.from, spouseId].sort();
        coupleKey = `couple-${sortedIds[0]}-${sortedIds[1]}`;
        parentIds = sortedIds;
      } else {
        // Single parent
        coupleKey = `single-${conn.from}`;
      }

      if (!familyUnits.has(coupleKey)) {
        familyUnits.set(coupleKey, {
          parentIds: parentIds,
          childrenIds: new Set(), // Use Set to automatically deduplicate
        });
      }

      // Add child to Set (automatically deduplicates)
      familyUnits.get(coupleKey).childrenIds.add(conn.to);
    });

    // 3. Draw parent-child connections for each family unit separately
    familyUnits.forEach((familyUnit, coupleKey) => {
      const { parentIds, childrenIds } = familyUnit;

      // Card dimensions for connection lines
      // Must match the ACTUAL rendered card height from Person.jsx
      // Cards are now 140px tall with 4px border radius (compact display)
      // Lines should stop AT the card edge, not go inside
      const ACTUAL_CARD_HALF_HEIGHT = 73;

      // Calculate connection start point from CENTER of spouse line
      let connectionStartX, connectionStartY;

      if (parentIds.length === 2) {
        // Couple - start from exact midpoint between the two cards
        const parent1Pos = positions.get(parentIds[0]);
        const parent2Pos = positions.get(parentIds[1]);

        if (!parent1Pos || !parent2Pos) return; // Skip if positions not found

        // Calculate exact midpoint X between the two card centers
        connectionStartX = (parent1Pos.x + parent2Pos.x) / 2;
        // Start from spouse line level (where black dot is), not from bottom of cards
        connectionStartY = parent1Pos.y; // Same Y as spouse line and black dot
      } else {
        // Single parent
        const parent1Pos = positions.get(parentIds[0]);
        if (!parent1Pos) return;

        connectionStartX = parent1Pos.x;
        connectionStartY = parent1Pos.y + ACTUAL_CARD_HALF_HEIGHT;
      }

      // Get all children positions (convert Set to Array)
      const children = Array.from(childrenIds)
        .map((childId) => ({ id: childId, pos: positions.get(childId) }))
        .filter((child) => child.pos);

      if (children.length === 0) return;

      // Get first parent position for metadata
      const firstParentPos = positions.get(parentIds[0]);

      if (children.length === 1) {
        // SINGLE CHILD - Check if child has spouse for L-shape connection
        const child = children[0];
        const childTopY = child.pos.y - ACTUAL_CARD_HALF_HEIGHT; // Top edge of child card
        const childX = child.pos.x;

        // Check if child has a spouse (from spouse connections)
        const childHasSpouse = spouseConnections.some(
          (conn) => conn.from === child.id || conn.to === child.id
        );

        if (childHasSpouse) {
          // Child has spouse - use L-shaped connection
          // 1. Vertical line down from parent center
          const midY = (connectionStartY + childTopY) / 2;

          allPaths.push(
            {
              id: `parent-vertical-${coupleKey}`,
              path: `M ${connectionStartX} ${connectionStartY} L ${connectionStartX} ${midY}`,
              type: "parent-child",
              from: parentIds[0],
              to: "mid",
              fromPos: firstParentPos,
              toPos: null,
            },
            {
              id: `parent-horizontal-${coupleKey}`,
              path: `M ${connectionStartX} ${midY} L ${childX} ${midY}`,
              type: "parent-child",
              from: "mid",
              to: child.id,
              fromPos: null,
              toPos: null,
            },
            {
              id: `child-vertical-${child.id}`,
              path: `M ${childX} ${midY} L ${childX} ${childTopY}`,
              type: "parent-child",
              from: "mid",
              to: child.id,
              fromPos: null,
              toPos: child.pos,
            },
            {
              id: `junction-mid-${coupleKey}`,
              type: "junction",
              point: { x: connectionStartX, y: midY },
            },
            {
              id: `junction-child-${child.id}`,
              type: "junction",
              point: { x: childX, y: midY },
            }
          );
        } else {
          // Child is single - if not vertically aligned, use an L-shaped connector (no diagonal)
          if (Math.abs(connectionStartX - childX) > 1) {
            const midY = (connectionStartY + childTopY) / 2;

            allPaths.push(
              {
                id: `parent-vertical-${coupleKey}`,
                path: `M ${connectionStartX} ${connectionStartY} L ${connectionStartX} ${midY}`,
                type: "parent-child",
                from: parentIds[0],
                to: "mid",
                fromPos: firstParentPos,
                toPos: null,
              },
              {
                id: `parent-horizontal-${coupleKey}`,
                path: `M ${connectionStartX} ${midY} L ${childX} ${midY}`,
                type: "parent-child",
                from: "mid",
                to: child.id,
                fromPos: null,
                toPos: null,
              },
              {
                id: `child-vertical-${child.id}`,
                path: `M ${childX} ${midY} L ${childX} ${childTopY}`,
                type: "parent-child",
                from: "mid",
                to: child.id,
                fromPos: null,
                toPos: child.pos,
              },
              {
                id: `junction-mid-${coupleKey}`,
                type: "junction",
                point: { x: connectionStartX, y: midY },
              },
              {
                id: `junction-child-${child.id}`,
                type: "junction",
                point: { x: childX, y: midY },
              },
            );
          } else {
            // Already aligned - direct vertical line
            allPaths.push({
              id: `parent-child-direct-${coupleKey}`,
              path: `M ${connectionStartX} ${connectionStartY} L ${childX} ${childTopY}`,
              type: "parent-child",
              from: parentIds[0],
              to: child.id,
              fromPos: firstParentPos,
              toPos: child.pos,
            });
          }
        }
      } else {
        // MULTIPLE CHILDREN - Use T-shaped connection with horizontal bar
        const childXPositions = children.map((c) => c.pos.x);
        const minChildX = Math.min(...childXPositions);
        const maxChildX = Math.max(...childXPositions);

        const childTopY = children[0].pos.y - ACTUAL_CARD_HALF_HEIGHT;
        const horizontalBarY = (connectionStartY + childTopY) / 2;

        // Horizontal bar spans children with padding
        const barPadding = 10;
        const adjustedMinX = minChildX - barPadding;
        const adjustedMaxX = maxChildX + barPadding;

        const childVerticalPaths = children.map((child) => {
          const childTopY = child.pos.y - ACTUAL_CARD_HALF_HEIGHT;
          return {
            id: `child-vertical-${child.id}`,
            path: `M ${child.pos.x} ${horizontalBarY} L ${child.pos.x} ${childTopY}`,
            type: "parent-child",
            from: parentIds[0],
            to: child.id,
            fromPos: firstParentPos,
            toPos: child.pos,
          };
        });

        const childJunctions = children.map((child) => {
          return {
            id: `junction-child-${child.id}`,
            type: "junction",
            point: { x: child.pos.x, y: horizontalBarY },
          };
        });

        allPaths.push(
          {
            id: `parent-vertical-${coupleKey}`,
            path: `M ${connectionStartX} ${connectionStartY} L ${connectionStartX} ${horizontalBarY}`,
            type: "parent-child",
            from: parentIds[0],
            to: "bar",
            fromPos: firstParentPos,
            toPos: null,
          },
          {
            id: `parent-horizontal-${coupleKey}`,
            path: `M ${adjustedMinX} ${horizontalBarY} L ${adjustedMaxX} ${horizontalBarY}`,
            type: "parent-child",
            from: parentIds[0],
            to: "bar",
            fromPos: firstParentPos,
            toPos: null,
          },
          ...childVerticalPaths,
          {
            id: `junction-center-${coupleKey}`,
            type: "junction",
            point: { x: connectionStartX, y: horizontalBarY },
          },
          ...childJunctions
        );
      }
    });

    return allPaths;
  }, [connections, positions]);

  return (
    <svg
      className="hierarchical-connections"
      width={canvasSize.width}
      height={canvasSize.height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 5, // Below cards (cards are z:10) but visible
        pointerEvents: "none",
      }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* Marriage symbol filter */}
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Render all connections */}
      {connectionPaths.map((conn) => {
        // Handle junction points separately
        if (conn.type === "junction") {
          const junctionColor = conn.color || "#f59e0b"; // Use custom color or default orange
          return (
            <circle
              key={conn.id}
              cx={conn.point.x}
              cy={conn.point.y}
              r="6"
              fill={junctionColor}
              opacity="1"
              stroke="white"
              strokeWidth="2"
            />
          );
        }

        // Determine color and style based on relationship type
        let strokeColor, strokeWidth, showMarriageSymbol;

        switch (conn.type) {
          case "spouse":
            strokeColor = "#f59e0b"; // Orange to match all connections
            strokeWidth = 4;
            showMarriageSymbol = conn.showMarriageSymbol || false;
            break;
          case "parent-child":
            strokeColor = "#f59e0b"; // Orange/amber for parent-child
            strokeWidth = 4;
            showMarriageSymbol = false;
            break;
          case "sibling":
            strokeColor = "#8b5cf6"; // Purple for siblings
            strokeWidth = 3;
            showMarriageSymbol = false;
            break;
          default:
            strokeColor = "#6b7280"; // Gray
            strokeWidth = 3;
            showMarriageSymbol = false;
        }

        return (
          <g key={conn.id}>
            {/* Main line with rounded corners */}
            <path
              d={conn.path}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              opacity="1" // Full opacity for maximum visibility
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Marriage symbol (two interlocking circles) */}
            {showMarriageSymbol && (
              <MarriageSymbol fromPos={conn.fromPos} toPos={conn.toPos} />
            )}
          </g>
        );
      })}
    </svg>
  );
};

// Helper component to render marriage symbol (two interlocking circles)
const MarriageSymbol = ({ fromPos, toPos }) => {
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;
  const radius = 12;
  const offset = 8;

  return (
    <g>
      {/* Left circle */}
      <circle
        cx={midX - offset}
        cy={midY}
        r={radius}
        fill="#fff"
        stroke="#6b7280"
        strokeWidth="2.5"
        filter="url(#shadow)"
      />
      {/* Right circle */}
      <circle
        cx={midX + offset}
        cy={midY}
        r={radius}
        fill="#fff"
        stroke="#6b7280"
        strokeWidth="2.5"
        filter="url(#shadow)"
      />
      {/* Infinity symbol or rings effect */}
      <path
        d={`M ${midX - offset - radius} ${midY} A ${radius} ${radius} 0 1 1 ${
          midX - offset + radius
        } ${midY}`}
        fill="none"
        stroke="#6b7280"
        strokeWidth="2"
        opacity="0.5"
      />
      <path
        d={`M ${midX + offset - radius} ${midY} A ${radius} ${radius} 0 1 1 ${
          midX + offset + radius
        } ${midY}`}
        fill="none"
        stroke="#6b7280"
        strokeWidth="2"
        opacity="0.5"
      />
    </g>
  );
};

HierarchicalConnections.propTypes = {
  positions: PropTypes.shape({
    size: PropTypes.number,
    get: PropTypes.func,
  }),
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      from: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      to: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
};

MarriageSymbol.propTypes = {
  fromPos: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  toPos: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
};

export default HierarchicalConnections;
