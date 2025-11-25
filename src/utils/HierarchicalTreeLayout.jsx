/**
 * Hierarchical Family Tree Layout Algorithm
 * Generation-based layout showing all family members
 * Free & Open Source - No paid license needed
 *
 * Features:
 * - Generation-based vertical layout (top to bottom)
 * - Spouse pairs positioned side-by-side
 * - All family members shown (not just descendants)
 * - Clean T-shaped tree connections
 * - Proper deduplication of children
 * - No overlapping cards or connections
 */

// Card dimensions for layout spacing - responsive to screen size
const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
const CARD_WIDTH = isMobile ? 120 : 200; // Layout spacing width
const CARD_HEIGHT = isMobile ? 80 : 100; // Layout spacing height
const HORIZONTAL_SPACING = isMobile ? 30 : 80; // Space between siblings/family units
const VERTICAL_SPACING = isMobile ? 100 : 150; // Space between generations
const SPOUSE_SPACING = isMobile ? 20 : 40; // Space between spouse pairs

/**
 * Calculate hierarchical tree layout positions
 * @param {FamilyTree} tree - The family tree data structure
 * @returns {Object} Layout data with positions and connections
 */
export function calculateHierarchicalLayout(tree) {
  if (!tree || !tree.people || tree.people.size === 0) {
    return { positions: new Map(), connections: [] };
  }

  const positions = new Map();
  const connections = [];
  const processed = new Set();
  const generations = new Map(); // Map of generation level -> people
  const spousePairs = new Map(); // Map of personId -> spouseId

  // Step 1: Organize people by generation and identify spouse pairs
  tree.people.forEach((person) => {
    const gen = person.generation ?? 0;
    if (!generations.has(gen)) {
      generations.set(gen, []);
    }
    generations.get(gen).push(person);

    // Track spouse pairs
    if (person.spouses && person.spouses.size > 0) {
      const spouseId = Array.from(person.spouses)[0];
      if (!spousePairs.has(person.id) && !spousePairs.has(spouseId)) {
        spousePairs.set(person.id, spouseId);
        spousePairs.set(spouseId, person.id);
      }
    }
  });

  // Step 2: Build parent-child map and find root couples
  const childrenMap = new Map(); // parentId -> [childIds]
  const parentMap = new Map(); // childId -> [parentIds]

  tree.people.forEach((person) => {
    if (person.children && person.children.size > 0) {
      person.children.forEach((childId) => {
        if (!childrenMap.has(person.id)) {
          childrenMap.set(person.id, []);
        }
        if (!childrenMap.get(person.id).includes(childId)) {
          childrenMap.get(person.id).push(childId);
        }

        // Track parents for each child
        if (!parentMap.has(childId)) {
          parentMap.set(childId, []);
        }
        if (!parentMap.get(childId).includes(person.id)) {
          parentMap.get(childId).push(person.id);
        }
      });
    }
  });

  // Step 3: Calculate subtree widths recursively
  const subtreeWidths = new Map(); // personId -> width of their subtree

  function calculateSubtreeWidth(personId) {
    if (subtreeWidths.has(personId)) {
      return subtreeWidths.get(personId);
    }

    const person = tree.people.get(personId);
    if (!person) return CARD_WIDTH * 2 + SPOUSE_SPACING;

    // Get children
    const children = childrenMap.get(personId) || [];

    if (children.length === 0) {
      // Leaf node - width is couple width
      const width = CARD_WIDTH * 2 + SPOUSE_SPACING;
      subtreeWidths.set(personId, width);
      return width;
    }

    // Calculate total width of all children's subtrees
    let childrenTotalWidth = 0;
    children.forEach((childId) => {
      childrenTotalWidth += calculateSubtreeWidth(childId) + HORIZONTAL_SPACING;
    });
    childrenTotalWidth -= HORIZONTAL_SPACING; // Remove last spacing

    // Subtree width is max of couple width or children width
    const coupleWidth = CARD_WIDTH * 2 + SPOUSE_SPACING;
    const width = Math.max(coupleWidth, childrenTotalWidth);
    subtreeWidths.set(personId, width);
    return width;
  }

  // Step 4: Position people recursively, generation by generation
  const sortedGens = Array.from(generations.keys()).sort((a, b) => a - b);

  function positionGeneration(gen, startX, startY) {
    const peopleAtLevel = generations.get(gen) || [];
    const processedAtLevel = new Set();
    let currentX = startX;

    peopleAtLevel.forEach((person) => {
      if (processedAtLevel.has(person.id)) return;

      // Skip if this person has parents (will be positioned under parents)
      const parents = parentMap.get(person.id) || [];
      if (gen > sortedGens[0] && parents.length > 0) return;

      const spouseId = spousePairs.get(person.id);
      const spouse = spouseId ? tree.people.get(spouseId) : null;

      // Calculate subtree width
      const subtreeWidth = calculateSubtreeWidth(person.id);
      const coupleWidth = CARD_WIDTH * 2 + SPOUSE_SPACING;
      const coupleStartX = currentX + (subtreeWidth - coupleWidth) / 2;

      // Position couple
      if (spouse && spouse.generation === gen) {
        positions.set(person.id, {
          x: coupleStartX + CARD_WIDTH / 2,
          y: startY,
          person: person,
        });
        positions.set(spouse.id, {
          x: coupleStartX + CARD_WIDTH + SPOUSE_SPACING + CARD_WIDTH / 2,
          y: startY,
          person: spouse,
        });
        connections.push({
          from: person.id,
          to: spouse.id,
          type: "spouse",
        });
        processedAtLevel.add(spouse.id);
      } else {
        positions.set(person.id, {
          x: coupleStartX + CARD_WIDTH / 2,
          y: startY,
          person: person,
        });
      }
      processedAtLevel.add(person.id);

      // Position children under this couple
      const children = childrenMap.get(person.id) || [];
      if (children.length > 0) {
        positionChildrenUnderParent(
          person.id,
          currentX,
          startY + CARD_HEIGHT + VERTICAL_SPACING
        );
      }

      currentX += subtreeWidth + HORIZONTAL_SPACING;
    });
  }

  function positionChildrenUnderParent(parentId, parentSubtreeStartX, childY) {
    const children = childrenMap.get(parentId) || [];
    if (children.length === 0) return;

    let currentX = parentSubtreeStartX;

    children.forEach((childId) => {
      const child = tree.people.get(childId);
      if (!child || positions.has(childId)) return;

      const spouseId = spousePairs.get(childId);
      const spouse = spouseId ? tree.people.get(spouseId) : null;

      const subtreeWidth =
        subtreeWidths.get(childId) || CARD_WIDTH * 2 + SPOUSE_SPACING;
      const coupleWidth = CARD_WIDTH * 2 + SPOUSE_SPACING;
      const coupleStartX = currentX + (subtreeWidth - coupleWidth) / 2;

      // Position child couple
      if (spouse && spouse.generation === child.generation) {
        positions.set(childId, {
          x: coupleStartX + CARD_WIDTH / 2,
          y: childY,
          person: child,
        });
        positions.set(spouse.id, {
          x: coupleStartX + CARD_WIDTH + SPOUSE_SPACING + CARD_WIDTH / 2,
          y: childY,
          person: spouse,
        });
        connections.push({
          from: childId,
          to: spouse.id,
          type: "spouse",
        });
      } else {
        // Single child - center under parent couple
        if (children.length === 1) {
          const parentPos = positions.get(parentId);
          if (parentPos) {
            // Check if parent has a spouse
            const parentSpouseId = spousePairs.get(parentId);
            let centerX;

            if (parentSpouseId) {
              const parentSpousePos = positions.get(parentSpouseId);
              if (parentSpousePos) {
                // Parent has spouse - center between them
                centerX = (parentPos.x + parentSpousePos.x) / 2;
              } else {
                centerX = parentPos.x;
              }
            } else {
              centerX = parentPos.x;
            }

            // Position single child at center
            positions.set(childId, {
              x: centerX,
              y: childY,
              person: child,
            });
          } else {
            // Fallback
            positions.set(childId, {
              x: coupleStartX + CARD_WIDTH / 2,
              y: childY,
              person: child,
            });
          }
        } else {
          // Multiple children - use calculated position
          positions.set(childId, {
            x: coupleStartX + CARD_WIDTH / 2,
            y: childY,
            person: child,
          });
        }
      }

      // Recursively position grandchildren
      positionChildrenUnderParent(
        childId,
        currentX,
        childY + CARD_HEIGHT + VERTICAL_SPACING
      );

      currentX += subtreeWidth + HORIZONTAL_SPACING;
    });
  }

  // Calculate widths for all people
  tree.people.forEach((person) => {
    calculateSubtreeWidth(person.id);
  });

  // Position starting from first generation
  positionGeneration(sortedGens[0], 0, 100);

  // Step 3: Add parent-child connections
  tree.people.forEach((person) => {
    if (person.children && person.children.size > 0) {
      person.children.forEach((childId) => {
        const child = tree.people.get(childId);
        if (child && positions.has(person.id) && positions.has(childId)) {
          connections.push({
            from: person.id,
            to: childId,
            type: "parent-child",
          });
        }
      });
    }
  });

  // Step 4: Normalize positions (center the tree)
  let minX = Infinity,
    maxX = -Infinity;

  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x - CARD_WIDTH / 2);
    maxX = Math.max(maxX, pos.x + CARD_WIDTH / 2);
  });

  const padding = 100;
  const offsetX = -minX + padding;

  positions.forEach((pos) => {
    pos.x += offsetX;
  });

  return { positions, connections };
}

/**
 * Generate family unit connection paths (GoJS-style hierarchical routing)
 * @param {Object} familyUnit - Family unit connection data
 * @returns {Array} Array of path objects
 */
export function generateFamilyUnitPaths(familyUnit) {
  const round = (n) => Math.round(n);
  const paths = [];

  const parentX = round(familyUnit.parentCenterX);
  const parentY = round(familyUnit.parentBottomY);
  const barY = round(familyUnit.horizontalBarY);
  const barStartX = round(familyUnit.horizontalBarStartX);
  const barEndX = round(familyUnit.horizontalBarEndX);

  // 1. Vertical line from parent down to horizontal bar
  paths.push({
    type: "parent-vertical",
    path: `M ${parentX} ${parentY} L ${parentX} ${barY}`,
  });

  // 2. Horizontal bar connecting all children
  paths.push({
    type: "horizontal-bar",
    path: `M ${barStartX} ${barY} L ${barEndX} ${barY}`,
  });

  // 3. Vertical lines from horizontal bar down to each child
  familyUnit.children.forEach((child) => {
    const childX = round(child.x);
    const childY = round(child.topY);
    paths.push({
      type: "child-vertical",
      path: `M ${childX} ${barY} L ${childX} ${childY}`,
    });
  });

  return paths;
}

/**
 * Generate spouse connection path
 * @param {Object} from - Starting position {x, y} (CENTER coordinates)
 * @param {Object} to - Ending position {x, y} (CENTER coordinates)
 * @returns {string} SVG path data
 */
export function generateSpousePath(from, to) {
  const round = (n) => Math.round(n);
  const y = round(from.y);
  const fromX = round(from.x + CARD_WIDTH / 2);
  const toX = round(to.x - CARD_WIDTH / 2);
  return `M ${fromX} ${y} L ${toX} ${y}`;
}

/**
 * Calculate canvas bounds for the layout
 * @param {Map} positions - Position map from calculateHierarchicalLayout
 * @returns {Object} {width, height}
 */
export function calculateCanvasBounds(positions) {
  let maxX = 0;
  let maxY = 0;

  positions.forEach((pos) => {
    // Positions are centered, so add half card size to get edges
    maxX = Math.max(maxX, pos.x + CARD_WIDTH / 2);
    maxY = Math.max(maxY, pos.y + CARD_HEIGHT / 2);
  });

  const padding = 200; // Increased padding for better visibility
  return {
    width: maxX + padding,
    height: maxY + padding,
  };
}
