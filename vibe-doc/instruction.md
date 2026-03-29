# Story File Instructions

## Overview

This document defines the format and guidelines for writing story files in the `vibe-doc/stories/` directory. Story files are structured narratives that guide AI assistants through complex development tasks, ensuring consistent, high-quality implementations.

## What Are Stories?

Stories are structured development narratives that:
- Describe a feature, bug fix, or enhancement from a user's perspective
- Provide context, requirements, and acceptance criteria
- Guide AI through implementation with clear steps
- Serve as living documentation for development decisions

## Story File Format

### File Naming Convention

Story files should follow this naming pattern:
```
story-[sequence]-[descriptive-name].md
```

**Examples:**
- `story-001-resource-production-system.md`
- `story-002-building-upgrade-mechanics.md`
- `story-003-unit-training-queue.md`
- `story-004-territory-conquest-flow.md`

### File Structure

Each story file must include the following sections:

```markdown
# Story: [Title]

## Metadata
- **Story ID**: [Unique identifier, e.g., STORY-001]
- **Priority**: [High/Medium/Low]
- **Status**: [Draft/In Progress/Completed/Blocked]
- **Created**: [ISO 8601 date]
- **Updated**: [ISO 8601 date]
- **Author**: [Name or AI identifier]
- **Related**: [Links to related stories, docs, or issues]

## User Story
As a [type of user], I want [an action] so that [a benefit/value].

## Context
[Background information explaining why this story exists, what problem it solves, and how it fits into the larger project.]

## Requirements

### Functional Requirements
- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Non-Functional Requirements
- [ ] [Performance requirement]
- [ ] [Security requirement]
- [ ] [Usability requirement]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Specifications

### Architecture Impact
[Describe which components are affected and how they interact.]

### Data Structures
[Define any new or modified data structures.]

### API Changes
[Document any new functions, reducers, or state changes.]

## Implementation Plan

### Step 1: [Step Title]
**Objective**: [What this step accomplishes]

**Tasks**:
- [ ] [Task 1]
- [ ] [Task 2]

**Validation**:
- [ ] [How to verify this step is complete]

### Step 2: [Step Title]
**Objective**: [What this step accomplishes]

**Tasks**:
- [ ] [Task 1]
- [ ] [Task 2]

**Validation**:
- [ ] [How to verify this step is complete]

## Testing Strategy

### Unit Tests
- [ ] [Test case 1]
- [ ] [Test case 2]

### Integration Tests
- [ ] [Integration test 1]
- [ ] [Integration test 2]

### Manual Testing
- [ ] [Manual test scenario 1]
- [ ] [Manual test scenario 2]

## Dependencies

### Prerequisites
- [ ] [Dependency 1]
- [ ] [Dependency 2]

### Blocked By
- [Story or task that must be completed first]

### Blocks
- [Stories or tasks that depend on this one]

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Risk 1] | High/Medium/Low | High/Medium/Low | [Mitigation strategy] |
| [Risk 2] | High/Medium/Low | High/Medium/Low | [Mitigation strategy] |

## Design Decisions

### Decision 1: [Title]
- **Context**: [Why this decision was needed]
- **Options Considered**:
  1. [Option 1]
  2. [Option 2]
- **Decision**: [Chosen option]
- **Rationale**: [Why this option was selected]

## Examples

### Code Examples
```javascript
// Example of how the feature should be implemented
export function exampleReducer(state, action) {
  switch (action.type) {
    case 'EXAMPLE_ACTION':
      return { ...state, example: action.payload };
    default:
      return state;
  }
}
```

### Usage Examples
```javascript
// Example of how the feature will be used
dispatch({ type: 'EXAMPLE_ACTION', payload: newValue });
```

## Documentation Updates

- [ ] Update `docs/architecture.md` if architecture changes
- [ ] Update `docs/game-mechanics.md` if gameplay changes
- [ ] Update `README.md` if user-facing features change
- [ ] Update `QWEN.md` if development conventions change
- [ ] Create or update relevant work-log entries

## Completion Checklist

- [ ] All functional requirements implemented
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Code reviewed (if applicable)
- [ ] Work-log entry created

## Notes

[Any additional notes, observations, or lessons learned during implementation.]

## References

- [Link to relevant documentation]
- [Link to related code]
- [Link to external resources]
```

## Best Practices for Writing Stories

### 1. Be Specific and Actionable

**Good Example:**
```markdown
## User Story
As a player, I want to upgrade my Farm from Level 1 to Level 2 so that I can increase my food production from 3 to 6 food per minute.
```

**Bad Example:**
```markdown
## User Story
I want better farms.
```

### 2. Include Clear Acceptance Criteria

**Good Example:**
```markdown
## Acceptance Criteria
- [ ] Farm upgrade button is visible when Farm is at Level 1
- [ ] Upgrade button shows required resources (80 timber, 40 stone)
- [ ] Upgrade button is disabled if resources are insufficient
- [ ] Clicking upgrade deducts resources and increases Farm level
- [ ] Food production increases from 3 to 6 food per minute after upgrade
- [ ] Toast notification confirms successful upgrade
```

**Bad Example:**
```markdown
## Acceptance Criteria
- Farm can be upgraded
```

### 3. Break Down Implementation Steps

**Good Example:**
```markdown
## Implementation Plan

### Step 1: Update Building Definitions
**Objective**: Add Level 2 upgrade data to building-definitions.json

**Tasks**:
- [ ] Add Level 2 cost data to Farm definition
- [ ] Add Level 2 production data to Farm definition
- [ ] Verify JSON syntax is valid

**Validation**:
- [ ] building-definitions.json is valid JSON
- [ ] Farm Level 2 data matches specifications
```

**Bad Example:**
```markdown
## Implementation Plan
- Implement farm upgrades
```

### 4. Document Technical Decisions

**Good Example:**
```markdown
## Design Decisions

### Decision 1: Upgrade Cost Scaling
- **Context**: Need to determine how upgrade costs scale with levels
- **Options Considered**:
  1. Linear scaling (2x cost per level)
  2. Exponential scaling (2^level cost)
  3. Custom scaling per building
- **Decision**: Linear scaling (2x cost per level)
- **Rationale**: Provides predictable progression while maintaining challenge
```

### 5. Include Testing Strategy

**Good Example:**
```markdown
## Testing Strategy

### Unit Tests
- [ ] Test upgrade action deducts correct resources
- [ ] Test upgrade action increases building level
- [ ] Test upgrade fails with insufficient resources
- [ ] Test upgrade fails if dependencies not met

### Integration Tests
- [ ] Test full upgrade flow from UI click to state update
- [ ] Test upgrade with resource production running
- [ ] Test upgrade notification displays correctly

### Manual Testing
- [ ] Verify upgrade button appears at correct level
- [ ] Verify upgrade cost displays correctly
- [ ] Verify production increases after upgrade
- [ ] Verify toast notification appears
```

### 6. Link Related Items

**Good Example:**
```markdown
## Metadata
- **Related**: 
  - STORY-002 (Building Construction System)
  - STORY-003 (Resource Production)
  - docs/buildings-and-units.md
  - data/building-definitions.json
```

### 7. Update Status Regularly

Keep the status field current:
- **Draft**: Story is being written or refined
- **In Progress**: Implementation has started
- **Completed**: All acceptance criteria met
- **Blocked**: Waiting on dependencies or external factors

## Story Workflow

### 1. Creation
1. Create new file with sequential number: `001-feature-name.md`
2. Fill in all required sections
3. Set status to "Draft"
4. Review for completeness

### 2. Review
1. Verify all sections are complete
2. Check acceptance criteria are measurable
3. Ensure implementation steps are clear
4. Validate technical specifications

### 3. Implementation
1. Update status to "In Progress"
2. Follow implementation plan step by step
3. Check off tasks as completed
4. Update status to "Completed" when done

### 4. Maintenance
1. Keep metadata updated
2. Document lessons learned
3. Update related documentation
4. Create work-log entries

## Example Story

Here's a complete example story for reference:

```markdown
# Story: Farm Upgrade System

## Metadata
- **Story ID**: STORY-001
- **Priority**: High
- **Status**: Draft
- **Created**: 2026-03-29T08:00:00Z
- **Updated**: 2026-03-29T08:00:00Z
- **Author**: AI Assistant
- **Related**: 
  - STORY-002 (Building Construction System)
  - docs/buildings-and-units.md
  - data/building-definitions.json

## User Story
As a player, I want to upgrade my Farm from Level 1 to Level 2 so that I can increase my food production from 3 to 6 food per minute.

## Context
Farms are the primary source of food production in the game. Currently, players can only build Level 1 Farms. This story implements the upgrade system, allowing players to improve their existing buildings for better resource production.

## Requirements

### Functional Requirements
- [ ] Players can upgrade Farms from Level 1 to Level 2
- [ ] Upgrade requires 80 timber and 40 stone
- [ ] Upgrade increases food production from 3 to 6 per minute
- [ ] Upgrade button is disabled if resources are insufficient
- [ ] Upgrade button is hidden if Farm is already Level 2 or higher

### Non-Functional Requirements
- [ ] Upgrade action completes instantly (no build time)
- [ ] State update is atomic (resources deducted and level increased together)
- [ ] UI updates immediately after upgrade

## Acceptance Criteria
- [ ] Farm upgrade button is visible when Farm is at Level 1
- [ ] Upgrade button shows required resources (80 timber, 40 stone)
- [ ] Upgrade button is disabled if resources are insufficient
- [ ] Clicking upgrade deducts resources and increases Farm level
- [ ] Food production increases from 3 to 6 food per minute after upgrade
- [ ] Toast notification confirms successful upgrade
- [ ] Upgrade button is hidden if Farm is already Level 2 or higher

## Technical Specifications

### Architecture Impact
- **Reducers**: `buildings.js` - Add UPGRADE_BUILDING action
- **Data**: `building-definitions.json` - Add Level 2 upgrade data
- **UI**: `App.jsx` - Add upgrade button to Farm card

### Data Structures

**Building Definition Update:**
```json
{
  "Farm": {
    "levels": {
      "1": {
        "cost": { "timber": 40, "stone": 20 },
        "production": { "food": 3 }
      },
      "2": {
        "cost": { "timber": 80, "stone": 40 },
        "production": { "food": 6 }
      }
    }
  }
}
```

### API Changes

**New Action Type:**
```javascript
{
  type: 'UPGRADE_BUILDING',
  payload: {
    buildingName: 'Farm',
    targetLevel: 2
  }
}
```

## Implementation Plan

### Step 1: Update Building Definitions
**Objective**: Add Level 2 upgrade data to building-definitions.json

**Tasks**:
- [ ] Add Level 2 cost data to Farm definition
- [ ] Add Level 2 production data to Farm definition
- [ ] Verify JSON syntax is valid

**Validation**:
- [ ] building-definitions.json is valid JSON
- [ ] Farm Level 2 data matches specifications

### Step 2: Implement Upgrade Reducer
**Objective**: Add UPGRADE_BUILDING action to buildings reducer

**Tasks**:
- [ ] Add UPGRADE_BUILDING case to buildings reducer
- [ ] Implement resource validation
- [ ] Implement level update logic
- [ ] Add error handling for invalid upgrades

**Validation**:
- [ ] Reducer handles UPGRADE_BUILDING action correctly
- [ ] Resources are deducted properly
- [ ] Building level is updated
- [ ] Errors are handled gracefully

### Step 3: Add Upgrade UI
**Objective**: Add upgrade button to Farm building card

**Tasks**:
- [ ] Add upgrade button component
- [ ] Implement button visibility logic
- [ ] Implement button disabled state
- [ ] Add click handler to dispatch upgrade action

**Validation**:
- [ ] Upgrade button appears for Level 1 Farms
- [ ] Button shows correct resource cost
- [ ] Button is disabled when resources insufficient
- [ ] Clicking button triggers upgrade action

### Step 4: Add Toast Notification
**Objective**: Show confirmation notification after upgrade

**Tasks**:
- [ ] Add success notification for upgrade
- [ ] Include building name and new level in message
- [ ] Test notification appears correctly

**Validation**:
- [ ] Toast notification appears after upgrade
- [ ] Notification message is clear and informative

## Testing Strategy

### Unit Tests
- [ ] Test UPGRADE_BUILDING action deducts correct resources
- [ ] Test UPGRADE_BUILDING action increases building level
- [ ] Test UPGRADE_BUILDING fails with insufficient resources
- [ ] Test UPGRADE_BUILDING fails if building not at upgradeable level
- [ ] Test UPGRADE_BUILDING fails if building doesn't exist

### Integration Tests
- [ ] Test full upgrade flow from UI click to state update
- [ ] Test upgrade with resource production running
- [ ] Test upgrade notification displays correctly
- [ ] Test upgrade button state updates with resource changes

### Manual Testing
- [ ] Verify upgrade button appears for Level 1 Farm
- [ ] Verify upgrade cost displays correctly
- [ ] Verify production increases after upgrade
- [ ] Verify toast notification appears
- [ ] Verify button disappears after upgrade

## Dependencies

### Prerequisites
- [x] Building construction system (STORY-000)
- [x] Resource production system (STORY-000)

### Blocked By
- None

### Blocks
- STORY-003 (Multi-level building upgrades)
- STORY-004 (Building dependency system)

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Resource deduction race condition | High | Low | Use atomic state updates in reducer |
| UI not updating after upgrade | Medium | Medium | Ensure proper state immutability |
| Upgrade cost miscalculation | Medium | Low | Validate against building-definitions.json |

## Design Decisions

### Decision 1: Instant Upgrades
- **Context**: Should upgrades take time to complete?
- **Options Considered**:
  1. Instant upgrades (no build time)
  2. Timed upgrades (like unit training)
  3. Hybrid (some instant, some timed)
- **Decision**: Instant upgrades
- **Rationale**: Keeps early game fast-paced; can add build times later if needed

### Decision 2: Linear Cost Scaling
- **Context**: How should upgrade costs scale?
- **Options Considered**:
  1. Linear scaling (2x cost per level)
  2. Exponential scaling (2^level cost)
  3. Custom scaling per building
- **Decision**: Linear scaling (2x cost per level)
- **Rationale**: Provides predictable progression while maintaining challenge

## Examples

### Code Examples

**Reducer Implementation:**
```javascript
case 'UPGRADE_BUILDING': {
  const { buildingName, targetLevel } = action.payload;
  const currentLevel = state[buildingName] || 0;
  
  // Validate upgrade
  if (targetLevel !== currentLevel + 1) {
    console.log(`Cannot upgrade ${buildingName} to level ${targetLevel}`);
    return state;
  }
  
  // Get upgrade cost from building definitions
  const buildingDef = buildingDefinitions[buildingName];
  const upgradeCost = buildingDef.levels[targetLevel].cost;
  
  // Check resources (handled in main reducer)
  // This reducer only handles the level update
  return {
    ...state,
    [buildingName]: targetLevel
  };
}
```

**UI Implementation:**
```javascript
function BuildingCard({ buildingName, level, onUpgrade }) {
  const buildingDef = buildingDefinitions[buildingName];
  const nextLevel = level + 1;
  const canUpgrade = buildingDef.levels[nextLevel];
  
  if (!canUpgrade) return null;
  
  const upgradeCost = buildingDef.levels[nextLevel].cost;
  
  return (
    <div className="building-card">
      <h3>{buildingName} (Level {level})</h3>
      <button 
        onClick={() => onUpgrade(buildingName, nextLevel)}
        disabled={!hasResources(upgradeCost)}
      >
        Upgrade to Level {nextLevel}
        <span className="cost">{formatCost(upgradeCost)}</span>
      </button>
    </div>
  );
}
```

## Documentation Updates

- [ ] Update `docs/buildings-and-units.md` with upgrade information
- [ ] Update `docs/game-mechanics.md` with upgrade mechanics
- [ ] Update `data/building-definitions.json` with Level 2 data
- [ ] Create work-log entry documenting implementation

## Completion Checklist

- [ ] All functional requirements implemented
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Work-log entry created

## Notes

- Consider adding upgrade animations in future iteration
- May want to add upgrade sound effects
- Could add upgrade progress bar for timed upgrades later

## References

- [Building Definitions](../../data/building-definitions.json)
- [Buildings and Units Documentation](../buildings-and-units.md)
- [Architecture Overview](../architecture.md)
```

## Quick Reference

### Creating a New Story

1. **Determine sequence number**: Check existing stories for next number
2. **Create file**: `vibe-doc/stories/001-feature-name.md`
3. **Copy template**: Use the format structure above
4. **Fill in sections**: Complete all required sections
5. **Review**: Ensure clarity and completeness
6. **Commit**: Add to version control

### Story Status Values

- **Draft**: Story is being written or refined
- **In Progress**: Implementation has started
- **Completed**: All acceptance criteria met
- **Blocked**: Waiting on dependencies or external factors
- **Cancelled**: Story will not be implemented

### Priority Levels

- **High**: Critical for current milestone; blocks other work
- **Medium**: Important but not blocking; should be done soon
- **Low**: Nice to have; can be deferred

## Tips for AI Assistants

When working with story files:

1. **Read the entire story** before starting implementation
2. **Follow the implementation plan** step by step
3. **Check off tasks** as you complete them
4. **Update status** to reflect current state
5. **Document decisions** in the Design Decisions section
6. **Add notes** about any deviations or lessons learned
7. **Update related documentation** as specified
8. **Create work-log entries** to track progress

## Conclusion

Well-written stories ensure:
- Clear understanding of requirements
- Consistent implementation approach
- Comprehensive testing coverage
- Proper documentation
- Traceable development history

Follow this format to create effective stories that guide AI assistants through successful implementations.
