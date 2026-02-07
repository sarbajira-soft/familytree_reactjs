import dagre from 'dagre';
import { getTreeCardDimensions } from './treeCardDimensions';

// Helpers function to find all descendants of a person
function getAllDescendants(tree, personId, visited = new Set()) {
    if (visited.has(personId)) return [];
    visited.add(personId);

    const person = tree.people.get(personId);
    if (!person) return [];

    let descendants = [personId];
    person.children.forEach(childId => {
        descendants = [...descendants, ...getAllDescendants(tree, childId, visited)];
    });
    return descendants;
}

function getSpacingConfig(memberCount) {
    // Keep spacing stable by tree size, but match the actual card size
    // so connectors touch card edges in the UI.
    let nodesep, ranksep, marginx, marginy, coupleSpacing;

    if (memberCount > 100) {
        nodesep = 250;
        ranksep = 220;
        coupleSpacing = 80;
    } else if (memberCount > 50) {
        nodesep = 220;
        ranksep = 200;
        coupleSpacing = 70;
    } else {
        nodesep = 200;
        ranksep = 180;
        coupleSpacing = 60;
    }
    marginx = 50;
    marginy = 50;

    const { width: nodeWidth, height: nodeHeight } = getTreeCardDimensions(memberCount, undefined, true);

    return { nodesep, ranksep, marginx, marginy, coupleSpacing, nodeWidth, nodeHeight };
}

function applyGenerationSubgraphs(tree, g, memberCount) {
    // For large trees, apply additional organization
    if (memberCount > 20) {
        // Group by generations for better organization
        const generationGroups = new Map();
        tree.people.forEach(person => {
            const gen = person.generation || 0;
            if (!generationGroups.has(gen)) {
                generationGroups.set(gen, []);
            }
            generationGroups.get(gen).push(person.id);
        });

        // Create subgraphs for each generation
        generationGroups.forEach((personIds, generation) => {
            if (personIds.length > 5) {
                const subgraphId = `gen-${generation}`;
                g.setNode(subgraphId, {
                    cluster: true,
                    label: `Generation ${generation}`,
                    style: 'fill: #f8f9fa',
                    margin: 30,
                    rank: 'same',
                    rankdir: 'LR'
                });

                personIds.forEach(pid => {
                    if (!g.parent(pid.toString())) {  // Only if not already in a family cluster
                        g.setParent(pid.toString(), subgraphId);
                    }
                });
            }
        });
    }
}

function enforceSpousePairsSameRow(tree, g, nodeWidth, coupleSpacing) {
    // Post-process: HARD ENFORCE spouses on the same row, side-by-side
    // This corrects cases where Dagre still ends up placing spouses with slight Y offsets.
    const adjustedSpousePairs = new Set();
    tree.people.forEach(person => {
        person.spouses.forEach(spouseId => {
            const key = [person.id, spouseId].sort().join('-');
            if (adjustedSpousePairs.has(key)) return;
            adjustedSpousePairs.add(key);

            const n1 = g.node(person.id.toString());
            const n2 = g.node(spouseId.toString());
            if (!n1 || !n2) return;

            // Force same Y (row)
            const targetY = Math.round((n1.y + n2.y) / 2);
            n1.y = targetY;
            n2.y = targetY;

            // Ensure a minimum horizontal gap between spouses
            const minGap = (nodeWidth || 160) + (coupleSpacing || 40);
            const dx = Math.abs(n1.x - n2.x);
            if (dx < minGap) {
                const centerX = (n1.x + n2.x) / 2;
                n1.x = centerX - minGap / 2;
                n2.x = centerX + minGap / 2;
            }
        });
    });
}

function calculateGraphOffsets(g, padding) {
    // Calculate offsets with better bounds checking and padding
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    g.nodes().forEach(v => {
        const node = g.node(v);
        if (node) {
            // For clusters, use their bounds if available
            if (node.cluster) {
                if (node.x !== undefined && node.y !== undefined) {
                    minX = Math.min(minX, node.x - (node.width || 0) / 2);
                    minY = Math.min(minY, node.y - (node.height || 0) / 2);
                    maxX = Math.max(maxX, node.x + (node.width || 0) / 2);
                    maxY = Math.max(maxY, node.y + (node.height || 0) / 2);
                }
            } else {
                minX = Math.min(minX, node.x - (node.width || 0) / 2);
                minY = Math.min(minY, node.y - (node.height || 0) / 2);
                maxX = Math.max(maxX, node.x + (node.width || 0) / 2);
                maxY = Math.max(maxY, node.y + (node.height || 0) / 2);
            }
        }
    });

    // Ensure minimum bounds with padding
    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;
    if (maxX === -Infinity) maxX = 100;
    if (maxY === -Infinity) maxY = 100;

    // Add padding
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const dagreLayoutOffsetX = -minX + padding;
    const dagreLayoutOffsetY = -minY + padding;

    return { dagreLayoutOffsetX, dagreLayoutOffsetY };
}

function updatePeoplePositions(tree, g, dagreLayoutOffsetX, dagreLayoutOffsetY) {
    // Update person positions
    g.nodes().forEach(v => {
        const personId = Number.parseInt(v, 10);
        if (!Number.isNaN(personId) && tree.people.has(personId)) {
            const node = g.node(v);
            const person = tree.people.get(personId);
            person.x = node.x + dagreLayoutOffsetX;
            person.y = node.y + dagreLayoutOffsetY;
        }
    });
}

export function autoArrange(tree) {
    const g = new dagre.graphlib.Graph({ compound: true });

    const memberCount = tree.people.size;
    const { isMobile, nodesep, ranksep, marginx, marginy, coupleSpacing, nodeWidth, nodeHeight } = getSpacingConfig(memberCount);

    g.setGraph({
        rankdir: 'TB',
        nodesep: nodesep,
        ranksep: ranksep,
        marginx: marginx,
        marginy: marginy,
        // Add clustering for better organization
        compound: true,
        // Use network-simplex for more stable layout
        ranker: 'network-simplex',
        // Force same rank for spouses
        align: 'UL',
        // Edge constraints for better spacing
        edgesep: 80,
        // Allow edges to be very short
        minlen: 1,
        // Disable complex acyclicer to prevent errors
        acyclicer: undefined,
        // Optimize for large graphs
        orderRestarts: memberCount > 50 ? 20 : 10,
        nestingRoot: memberCount > 50 ? 'root' : undefined,
    });
    g.setDefaultEdgeLabel(() => ({}));

    const familyNodeSize = 10;
    const familyUnits = new Map();

    // Add all people as nodes with proper dimensions
    tree.people.forEach(p => {
        g.setNode(p.id.toString(), {
            label: p.name,
            width: nodeWidth,  // Use actual card width
            height: nodeHeight, // Use actual card height
            // Add generation info for better clustering
            generation: p.generation || 0
        });
    });

    // First pass: Create family units and parent-child relationships
    const familyGroups = new Map();

    // Create family groups (parents + their children)
    tree.people.forEach(person => {
        if (person.children.size > 0) {
            const parentIds = [person.id];
            // Include spouses who are also parents of the same children
            person.spouses.forEach(spouseId => {
                const spouse = tree.people.get(spouseId);
                if (!spouse) return;
                const isCoParent = [...person.children].some(childId =>
                    spouse.children && spouse.children.has(childId));
                if (isCoParent) parentIds.push(spouseId);
            });

            const parentKey = parentIds.sort().join('-');
            if (!familyUnits.has(parentKey)) {
                const familyId = `family-${parentKey}`;
                familyUnits.set(parentKey, familyId);
                g.setNode(familyId, {
                    width: familyNodeSize,
                    height: familyNodeSize,
                    clusterLabelPos: 'top',
                    style: 'fill: #f0f0f0',
                    rx: 5,
                    ry: 5
                });

                // Connect parents to family node with higher weight
                parentIds.forEach(pid => {
                    g.setEdge(pid.toString(), familyId, {
                        weight: 25,  // Higher weight to keep parents close to family node
                        minlen: 1
                    });
                });

                // Connect family node to children
                const children = [...person.children];
                children.forEach((childId, index) => {
                    g.setEdge(familyId, childId.toString(), {
                        weight: 15,  // Slightly lower weight than parent connections
                        minlen: 1,
                        // Add some spacing between siblings
                        ...(index > 0 && { weight: 15 - (index * 0.1) })
                    });
                });

                // Store family group for clustering
                const familyGroup = {
                    id: familyId,
                    parents: [...parentIds],
                    children: children,
                    allMembers: [...parentIds, ...children]
                };
                familyGroups.set(familyId, familyGroup);
            }
        }
    });

    // Second pass: Create clusters for each family unit
    familyGroups.forEach((family, familyId) => {
        // Create a cluster for this family
        const clusterId = `cluster-${familyId}`;

        // Add all family members to this cluster
        family.allMembers.forEach(memberId => {
            g.setParent(memberId.toString(), clusterId);
        });

        // Style the cluster
        g.setNode(clusterId, {
            cluster: true,
            label: '',
            style: 'fill: none',
            clusterLabelPos: 'top',
            margin: 20
        });
    });

    // Create spouse connections with higher weight to keep them together
    tree.people.forEach(person => {
        person.spouses.forEach(spouseId => {
            if (person.id < spouseId) {
                const spouse = tree.people.get(spouseId);
                if (!spouse) return;

                // Check if they have common children
                const commonChildren = [...person.children].filter(c =>
                    spouse.children && spouse.children.has(c));

                // Connect spouses with a very high-weight edge to keep them close
                g.setEdge(person.id.toString(), spouseId.toString(), {
                    weight: 1000,  // Very high weight to keep spouses together
                    minlen: 1.5,   // Increased minimal length to prevent overlap
                    style: 'stroke: #ff69b4, stroke-width: 2',
                    curve: 'line', // Use straight line for spouse connections
                    labelpos: 'c',
                    labeloffset: 0,
                    edgeLabel: '',
                    edgeLabelStyle: 'opacity:0',
                    // Add constraints to keep them on same rank
                    constraint: true,
                    // Add more padding to prevent overlap
                    padding: 15,
                    // Force horizontal alignment
                    rank: 'same',
                    // Add fixed size for consistent spacing
                    width: 150,
                    height: 80,
                    // Add margin to prevent overlap with other nodes
                    marginx: 20,
                    marginy: 10,
                    // Mark as spouse relationship for renderers
                    relationship: 'spouse'
                });

                // If they have no common children, create a special cluster
                if (commonChildren.length === 0) {
                    const clusterId = `spouse-cluster-${person.id}-${spouseId}`;
                    g.setNode(clusterId, {
                        cluster: true,
                        label: '',
                        style: 'fill: #fff5f7',
                        margin: 10
                    });
                    g.setParent(person.id.toString(), clusterId);
                    g.setParent(spouseId.toString(), clusterId);
                }
            }
        });
    });

    // Create a map to track couples and their positions
    const processedPairs = new Set();
    const coupleNodes = [];

    // First pass: identify all couples
    tree.people.forEach(person => {
        person.spouses.forEach(spouseId => {
            const pairKey = [person.id, spouseId].sort().join('-');
            if (!processedPairs.has(pairKey)) {
                coupleNodes.push([person.id, spouseId]);
                processedPairs.add(pairKey);
            }
        });
    });

    // Process each couple to position them side by side
    coupleNodes.forEach(([id1, id2]) => {
        // Create a subgraph for the couple to keep them side by side
        const coupleCluster = `couple_${id1}_${id2}`;
        g.setParent(id1.toString(), coupleCluster);
        g.setParent(id2.toString(), coupleCluster);

        // Configure the couple cluster
        g.setNode(coupleCluster, {
            cluster: true,
            label: '',
            style: 'fill: none',
            rank: 'same',
            rankdir: 'LR',  // Left to right for side-by-side
            margin: 30
        });

        // Configure the edge between spouses
        g.setEdge(id1.toString(), id2.toString(), {
            weight: 1000,  // High weight to keep them together
            minlen: 1,     // Keep them close
            style: 'stroke: #ff69b4; stroke-width: 2px;',
            arrowhead: 'none',
            rank: 'same',
            constraint: true,
            // Mark as spouse relationship for renderers
            relationship: 'spouse'
        });

        // Set node options for both spouses with increased spacing
        const nodeOptions = {
            width: nodeWidth,  // Use the dynamic width based on tree size
            height: nodeHeight,  // Use the dynamic height based on tree size
            rank: 'same',
            constraint: true,
            marginx: 50,  // Increased horizontal margin
            marginy: 30,  // Increased vertical margin
            padding: 30,  // Increased padding around nodes
            fixed: false,
            // Add minimum spacing
            minlen: 2,  // Reduced for better spacing control
            // Ensure nodes don't overlap
            overlap: 'false',
            // Add more spacing around nodes
            margin: 30,
            // Fixed size constraints
            fixedsize: true,
            // More space for labels
            labeloffset: 20,
            // Force node dimensions
            nodeDimensionsIncludeLabels: true
        };

        // Apply to both nodes
        g.setNode(id1.toString(), {
            ...g.node(id1.toString()),
            ...nodeOptions
        });

        g.setNode(id2.toString(), {
            ...g.node(id2.toString()),
            ...nodeOptions
        });
    });

    applyGenerationSubgraphs(tree, g, memberCount);

    // Apply layout with better configuration
    const layoutConfig = {
        rankdir: 'TB',
        nodesep: nodesep, // base node separation (we already scale elsewhere)
        ranksep: memberCount > 50 ? ranksep * 2 : ranksep * 1.5,
        marginx: 100,
        marginy: 100,
        acyclicer: 'greedy',
        ranker: 'network-simplex',
        align: 'UL',
        edgesep: 80,
        maxiter: 7000,
        compound: true,
        nodeRankFactor: 2.5,
        tolerance: 0.00001,
        overlap: 'false',
        overlap_shrink: true,
        overlap_scaling: 10,
        splines: 'polyline',
        acyclic: true,
        nodeDimensionsIncludeLabels: true,
        edgeWeight: 2,
        labeloffset: 10
    };

    // Apply the layout
    dagre.layout(g, layoutConfig);

    enforceSpousePairsSameRow(tree, g, nodeWidth, coupleSpacing);

    const padding = 100;
    const { dagreLayoutOffsetX, dagreLayoutOffsetY } = calculateGraphOffsets(g, padding);
    updatePeoplePositions(tree, g, dagreLayoutOffsetX, dagreLayoutOffsetY);

    return { g, dagreLayoutOffsetX, dagreLayoutOffsetY };
} 
