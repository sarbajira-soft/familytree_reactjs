// Removed Tamil translations import - backend provides labels

/**
 * Universal Family Relationship Calculator
 * 
 * This refactored version uses only a universal code generator approach.
 * All relationships are calculated by finding the shortest path between two people
 * and converting that path into a standardized relationship code.
 * 
 * Relationship Code Format:
 * - F = Father, M = Mother
 * - S = Son, D = Daughter  
 * - B = Brother, Z = Sister
 * - H = Husband, W = Wife
 * - + = Elder, - = Younger
 * 
 * Examples:
 * - F = Father
 * - MB+ = Mother's elder brother (maternal uncle)
 * - FZS = Father's sister's son (paternal cousin)
 * - HB- = Husband's younger brother (brother-in-law)
 */

export default class RelationshipCalculator {
  constructor(tree) {
    this.tree = tree;
    this.people = tree.people;
  }

  normalizeGender(gender) {
    if (!gender) return '';
    const g = String(gender).toLowerCase().trim();
    if (g === 'male' || g === 'm' || g === 'man') return 'male';
    if (g === 'female' || g === 'f' || g === 'woman') return 'female';
    return '';
  }

  /**
   * Calculate relationship between two people using universal path-based approach
   * @param {string} person1Id - ID of the first person
   * @param {string} person2Id - ID of the second person
   * @returns {Object} Relationship object with type, description, and code
   */
  calculateRelationship(person1Id, person2Id) {
    // Handle self-relationship
    if (person1Id === person2Id) {
      return { 
        type: 'self', 
        description: 'self', 
        relationshipCode: 'SELF',
        generationDiff: 0
      };
    }

    const person1 = this.people.get(person1Id);
    const person2 = this.people.get(person2Id);

    if (!person1 || !person2) {
      return {
        type: 'unknown', 
        description: 'unknown', 
        relationshipCode: 'UNKNOWN',
        generationDiff: 0
      };
  }

    // Find the shortest path between the two people
    const path = this.findShortestPath(person1Id, person2Id);
    
    if (!path || path.length === 0) {
        return {
        type: 'unknown', 
        description: 'no connection found', 
        relationshipCode: 'UNRELATED',
        generationDiff: 0
        };
    }
    
    // Convert path to relationship code
    const relationshipCode = this.generateRelationshipCode(path, person1, person2);
    
    // Calculate generation difference
    const generationDiff = this.calculateGenerationDiff(path);
    
    // Get human-readable description
    const description = this.getRelationshipDescription(relationshipCode);
    
      return {
      type: this.getRelationshipType(relationshipCode),
      description: description,
      relationshipCode: relationshipCode,
      generationDiff: generationDiff,
      path: path // Include path for debugging
      };
    }

  /**
   * Find the shortest path between two people using breadth-first search
   * @param {string} startId - Starting person ID
   * @param {string} endId - Target person ID
   * @returns {Array} Array of path steps or null if no path exists
   */
  findShortestPath(startId, endId) {
    const visited = new Set();
    const queue = [{ personId: startId, path: [] }];
    
    while (queue.length > 0) {
      const { personId: currentId, path } = queue.shift();
      
      // Found the target
      if (currentId === endId) {
        return path;
    }

      // Skip if already visited
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const person = this.people.get(currentId);
      if (!person) continue;
      
      // Explore all possible connections
      this.addConnectionsToQueue(person, currentId, path, queue, visited);
    }

    return null; // No path found
  }

  /**
   * Add all possible connections from current person to the search queue
   * @param {Object} person - Current person object
   * @param {string} currentId - Current person ID
   * @param {Array} currentPath - Current path taken
   * @param {Array} queue - Search queue
   * @param {Set} visited - Set of visited person IDs
   */
  addConnectionsToQueue(person, currentId, currentPath, queue, visited) {
    // Add parents
    for (const parentId of person.parents) {
      if (!visited.has(parentId)) {
        queue.push({
          personId: parentId,
          path: [...currentPath, { 
            type: 'parent', 
            from: currentId, 
            to: parentId 
          }]
        });
      }
    }

    // Add children
    for (const childId of person.children) {
      if (!visited.has(childId)) {
        queue.push({
          personId: childId,
          path: [...currentPath, { 
            type: 'child', 
            from: currentId, 
            to: childId 
          }]
        });
          }
    }

    // Add spouses
    for (const spouseId of person.spouses) {
      if (!visited.has(spouseId)) {
        queue.push({
          personId: spouseId,
          path: [...currentPath, { 
            type: 'spouse', 
            from: currentId, 
            to: spouseId 
          }]
        });
      }
    }

    // Add siblings
    for (const siblingId of person.siblings) {
      if (!visited.has(siblingId)) {
        queue.push({
          personId: siblingId,
          path: [...currentPath, { 
            type: 'sibling', 
            from: currentId, 
            to: siblingId 
          }]
        });
      }
    }
  }

  /**
   * Generate relationship code from path
   * @param {Array} path - Array of path steps
   * @param {Object} person1 - First person object
   * @param {Object} person2 - Second person object
   * @returns {string} Relationship code
   */
  generateRelationshipCode(path, person1, person2) {
    if (!path || path.length === 0) return '';
    
    let code = '';
    
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const targetPerson = this.people.get(step.to);
      if (!targetPerson) continue;

      const targetGender = this.normalizeGender(targetPerson.gender);
      const fromPerson = this.people.get(step.from);
      const fromGender = fromPerson ? this.normalizeGender(fromPerson.gender) : '';
      
      switch (step.type) {
        case 'parent':
          code += targetGender === 'male' ? 'F' : 'M';
          break;
          
        case 'child':
          code += targetGender === 'male' ? 'S' : 'D';
          break;
          
        case 'spouse':
          if (fromGender === 'male') {
            code += 'W';
          } else if (fromGender === 'female') {
            code += 'H';
          } else {
            code += targetGender === 'male' ? 'H' : 'W';
          }
          break;
          
        case 'sibling':
          const elderYounger = this.determineElderYoungerForSiblings(fromPerson, targetPerson, path, i);
          if (targetGender === 'male') {
            code += elderYounger === 'elder' ? 'B+' : 'B-';
          } else {
            code += elderYounger === 'elder' ? 'Z+' : 'Z-';
          }
          break;
      }
    }

    // Add + or - for cousin codes based on age comparison between cousins
    const cousinCodes = ['FB-D', 'FB-S', 'MZ-D', 'MZ-S','FB+S','FB+D', 'MZ+S','MZ+D'];
    if (cousinCodes.includes(code)) {
      if (person1.age && person2.age) {
        if (person2.age > person1.age) return code + '+';
        if (person2.age < person1.age) return code + '-';
      }
    }
    
    return code;
  }

  /**
   * Determine if person2 is elder or younger than person1
   * @param {Object} person1 - First person
   * @param {Object} person2 - Second person
   * @returns {string} 'elder', 'younger', or 'same'
   */
  determineElderYounger(person1, person2) {
    // First priority: Age comparison (higher age = elder)
    if (person1.age && person2.age) {
      if (person2.age > person1.age) return 'elder';
      if (person2.age < person1.age) return 'younger';
      // If ages are equal, continue to next check
    }

    // Second priority: Birth order if available (lower birth order = elder)
    if (person1.birthOrder && person2.birthOrder) {
      return person2.birthOrder < person1.birthOrder ? 'elder' : 'younger';
    }
    
    // Third priority: Generation as fallback
    if (person1.generation && person2.generation) {
      return person2.generation < person1.generation ? 'elder' : 'younger';
    }
    
    // Default to younger if no information available (safer assumption)
    return 'younger';
  }

  /**
   * Determine elder/younger relationship for siblings with context awareness
   * This method handles uncle/aunt relationships correctly by comparing the right people
   * @param {Object} fromPerson - The person we're coming from in the path
   * @param {Object} targetPerson - The sibling we're going to
   * @param {Array} path - The full relationship path
   * @param {number} stepIndex - Current step index in the path
   * @returns {string} 'elder', 'younger', or 'same'
   */
  determineElderYoungerForSiblings(fromPerson, targetPerson, path, stepIndex) {
    // For uncle/aunt relationships (when we came from a parent), 
    // we need to compare the parent with their sibling, not the child with uncle/aunt
    
    // Check if this sibling step is creating an uncle/aunt relationship
    // This happens when the previous step was going to a parent
    if (stepIndex > 0 && path[stepIndex - 1].type === 'parent') {
      // We're dealing with uncle/aunt relationship
      // fromPerson is the parent, targetPerson is the uncle/aunt
      // Compare the parent's age with their sibling (uncle/aunt)
      return this.determineElderYounger(fromPerson, targetPerson);
    }
    
    // For direct sibling relationships, use normal comparison
    return this.determineElderYounger(fromPerson, targetPerson);
  }

  /**
   * Calculate generation difference from path
   * @param {Array} path - Array of path steps
   * @returns {number} Generation difference (positive = younger, negative = older)
   */
  calculateGenerationDiff(path) {
    let diff = 0;
    
    for (const step of path) {
      switch (step.type) {
        case 'parent':
          diff -= 1;
          break;
        case 'child':
          diff += 1;
          break;
        case 'spouse':
        case 'sibling':
          // Same generation
          break;
      }
    }

    return diff;
  }

  /**
   * Get relationship type from code
   * @param {string} code - Relationship code
   * @returns {string} Relationship type
   */
  getRelationshipType(code) {
    // Basic direct relationships
    const directTypes = {
      'F': 'father',
      'M': 'mother',
      'S': 'son',
      'D': 'daughter',
      'H': 'husband',
      'W': 'wife',
      'B+': 'elderBrother',
      'B-': 'youngerBrother',
      'Z+': 'elderSister',
      'Z-': 'youngerSister'
    };
    
    if (directTypes[code]) {
      return directTypes[code];
    }
    
    // Complex relationships
    if (code.includes('F') || code.includes('M')) {
      if (code.length > 1) {
        return 'extended';
      }
    }
    
    return 'complex';
  }

  /**
   * Get human-readable description from relationship code
   * @param {string} code - Relationship code
   * @param {string} language - Language for description (default: 'tamil')
   * @returns {string} Human-readable description
   */
  getRelationshipDescription(code, language = 'tamil') {
    // Backend provides Tamil labels via API, so return the code
    // Frontend will get proper Tamil labels from backend API
    return code;
  }

  /**
   * Get all relationships for a person
   * @param {string} personId - Person ID
   * @returns {Array} Array of relationship objects
   */
  getAllRelationships(personId) {
    const relationships = [];
    const person = this.people.get(personId);
    
    if (!person) return relationships;

    this.people.forEach((otherPerson, otherId) => {
      if (otherId !== personId) {
        const relationship = this.calculateRelationship(personId, otherId);
        if (relationship.type !== 'unknown') {
          relationships.push({
            personId: otherId,
            personName: otherPerson.name,
            personGender: otherPerson.gender,
            relationship: relationship
          });
        }
      }
    });

    // Sort by generation difference, then by relationship type
    return relationships.sort((a, b) => {
      const genDiffA = a.relationship.generationDiff || 0;
      const genDiffB = b.relationship.generationDiff || 0;
      if (genDiffA !== genDiffB) return genDiffA - genDiffB;
      return a.relationship.type.localeCompare(b.relationship.type);
    });
  }
}
