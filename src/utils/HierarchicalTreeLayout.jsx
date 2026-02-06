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

// Card dimensions for layout spacing
// NOTE: We intentionally use a fixed "desktop" virtual canvas here (approx. 13" display)
// for all devices so that the tree structure (card spacing and line lengths)
// is identical on mobile and desktop. Viewport differences are handled by
// zooming/scrolling in the React components, not by changing these numbers.
const CARD_WIDTH = 200;           // Layout spacing width
const CARD_HEIGHT = 100;          // Layout spacing height
const HORIZONTAL_SPACING = 80;    // Space between siblings/family units
const VERTICAL_SPACING = 150;     // Space between generations
const SPOUSE_SPACING = 40;        // Space between spouse pairs

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
    const generations = new Map(); // Map of generation level -> people
    const spousePairs = new Map(); // Map of personId -> spouseId
    const childrenMap = new Map(); // parentId -> [childIds]
    const parentMap = new Map(); // childId -> [parentIds]
    const subtreeWidths = new Map(); // personId -> width of their subtree
    
    // Step 1: Organize people by generation and identify spouse pairs
    tree.people.forEach(person => {
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
    tree.people.forEach(person => {
        if (person.children && person.children.size > 0) {
            person.children.forEach(childId => {
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
        children.forEach(childId => {
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

    function setPersonPosition(person, x, y) {
        positions.set(person.id, {
            x,
            y,
            person
        });
    }

    function getParentCoupleCenterX(parentId) {
        const parentPos = positions.get(parentId);
        if (!parentPos) return null;

        const parentSpouseId = spousePairs.get(parentId);
        if (!parentSpouseId) return parentPos.x;

        const parentSpousePos = positions.get(parentSpouseId);
        return parentSpousePos ? (parentPos.x + parentSpousePos.x) / 2 : parentPos.x;
    }
    
    function positionGeneration(gen, startX, startY) {
        const peopleAtLevel = generations.get(gen) || [];
        const processedAtLevel = new Set();
        let currentX = startX;
        
        peopleAtLevel.forEach(person => {
            if (processedAtLevel.has(person.id)) return;
            // Skip if this person has parents (will be positioned under parents)
            const parents = parentMap.get(person.id) || [];
            if (gen > sortedGens[0] && parents.length > 0) return;
            
            const spouseId = spousePairs.get(person.id);
            const spouse = spouseId ? tree.people.get(spouseId) : null;
            
            const subtreeWidth = calculateSubtreeWidth(person.id);
            const coupleWidth = CARD_WIDTH * 2 + SPOUSE_SPACING;
            const coupleStartX = currentX + (subtreeWidth - coupleWidth) / 2;
            
            // Position couple
            if (spouse && spouse.generation === gen) {
                setPersonPosition(person, coupleStartX + CARD_WIDTH / 2, startY);
                setPersonPosition(spouse, coupleStartX + CARD_WIDTH + SPOUSE_SPACING + CARD_WIDTH / 2, startY);
                connections.push({
                    from: person.id,
                    to: spouse.id,
                    type: 'spouse'
                });
                processedAtLevel.add(spouse.id);
            } else {
                setPersonPosition(person, coupleStartX + CARD_WIDTH / 2, startY);
            }

            processedAtLevel.add(person.id);
            
            // Position children under this couple
            const children = childrenMap.get(person.id) || [];
            if (children.length > 0) {
                positionChildrenUnderParent(person.id, currentX, startY + CARD_HEIGHT + VERTICAL_SPACING);
            }
            
            currentX += subtreeWidth + HORIZONTAL_SPACING;
        });
    }
    
    function positionChildrenUnderParent(parentId, parentSubtreeStartX, childY) {
        const children = childrenMap.get(parentId) || [];
        if (children.length === 0) return;
        
        let currentX = parentSubtreeStartX;
        const isSingleChild = children.length === 1;
        
        children.forEach(childId => {
            const child = tree.people.get(childId);
            if (!child || positions.has(childId)) return;
            
            const spouseId = spousePairs.get(childId);
            const spouse = spouseId ? tree.people.get(spouseId) : null;
            
            const subtreeWidth = subtreeWidths.get(childId) || (CARD_WIDTH * 2 + SPOUSE_SPACING);
            const coupleWidth = CARD_WIDTH * 2 + SPOUSE_SPACING;
            const coupleStartX = currentX + (subtreeWidth - coupleWidth) / 2;
            
            // Position child couple
            if (spouse && spouse.generation === child.generation) {
                setPersonPosition(child, coupleStartX + CARD_WIDTH / 2, childY);
                setPersonPosition(spouse, coupleStartX + CARD_WIDTH + SPOUSE_SPACING + CARD_WIDTH / 2, childY);
                connections.push({
                    from: childId,
                    to: spouse.id,
                    type: 'spouse'
                });
            } else if (isSingleChild) {
                // Single child - center under parent couple
                const parentCenterX = getParentCoupleCenterX(parentId);
                setPersonPosition(child, parentCenterX ?? (coupleStartX + CARD_WIDTH / 2), childY);
            } else {
                // Multiple children - use calculated position
                setPersonPosition(child, coupleStartX + CARD_WIDTH / 2, childY);
            }
            
            // Recursively position grandchildren
            positionChildrenUnderParent(childId, currentX, childY + CARD_HEIGHT + VERTICAL_SPACING);
            
            currentX += subtreeWidth + HORIZONTAL_SPACING;
        });
    }
    
    // Calculate widths for all people
    tree.people.forEach(person => {
        calculateSubtreeWidth(person.id);
    });
    
    // Position starting from first generation
    positionGeneration(sortedGens[0], 0, 100);

    // Step 3: Add parent-child connections
    tree.people.forEach(person => {
        if (person.children && person.children.size > 0) {
            person.children.forEach(childId => {
                const child = tree.people.get(childId);
                if (child && positions.has(person.id) && positions.has(childId)) {
                    connections.push({
                        from: person.id,
                        to: childId,
                        type: 'parent-child'
                    });
                }
            });
        }
    });

    // Step 4: Normalize positions (center the tree)
    let minX = Infinity, maxX = -Infinity;
    
    positions.forEach(pos => {
        minX = Math.min(minX, pos.x - CARD_WIDTH / 2);
        maxX = Math.max(maxX, pos.x + CARD_WIDTH / 2);
    });
    
    const padding = 100;
    const offsetX = -minX + padding;
    
    positions.forEach(pos => {
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
    const childPaths = familyUnit.children.map(child => {
        const childX = round(child.x);
        const childY = round(child.topY);
        return {
            type: 'child-vertical',
            path: `M ${childX} ${barY} L ${childX} ${childY}`
        };
    });

    paths.push(
        {
            type: 'parent-vertical',
            path: `M ${parentX} ${parentY} L ${parentX} ${barY}`
        },
        {
            type: 'horizontal-bar',
            path: `M ${barStartX} ${barY} L ${barEndX} ${barY}`
        },
        ...childPaths
    );
    
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
    
    positions.forEach(pos => {
        // Positions are centered, so add half card size to get edges
        maxX = Math.max(maxX, pos.x + CARD_WIDTH / 2);
        maxY = Math.max(maxY, pos.y + CARD_HEIGHT / 2);
    });
    
    const padding = 200; // Increased padding for better visibility
    return {
        width: maxX + padding,
        height: maxY + padding
    };
}