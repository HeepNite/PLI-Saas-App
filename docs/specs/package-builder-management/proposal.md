# Proposal: package-builder-management

## Intent
The goal of this change is to overhaul the "Package Builder" functionality to make it more intuitive, less ambiguous, and easier to manage. We want to move away from complex or confusing configurations (like `0` values and `cadencia`) towards a streamlined ownership model where packages are tied to courses, while providing robust lifecycle controls for administrators.

## Scope

### 1. Package Editing & UI
- **Editable Packages**: Enable full editing capabilities for existing packages.
- **Denser Package List**: Refactor the package list view to provide more information in less space, improving scannability for admins.
- **Pricing UX Overhaul**: Redesign the pricing interface to eliminate ambiguity. Remove confusing concepts like `0` (as a placeholder or value) and `cadencia` (frequency/cadence) if they contribute to user error.

### 2. Ownership & Flow
- **One-Course Package Ownership**: Transition to a model where a package is fundamentally tied to a single course.
- **Duplicate-to-Course Flow**: Implement a workflow where users can easily create new packages by duplicating existing ones and re-associating them with a target course.

### 3. Lifecycle Management
- **Lifecycle Controls**: Introduce explicit states for packages:
    - **Suspend**: Temporarily disable a package without deleting it.
    /   - **Relaunch**: Re-activate a suspended package.
    - **Scheduled Launch Date**: Allow admins to set a future date when a package becomes active.
- **Removal of "Management" Complexity**: Simplify the management layer by removing redundant or overlapping administrative controls that no longer serve a purpose under the new ownership model.

## Approach
- **Data Model Refactoring**: Update the database schema to support the new one-course ownership and lifecycle states (suspend, relaunch, scheduled date).
- **UI/UX Redesign**: 
    - Implement a new, denser list component for packages.
    - Create a simplified pricing configuration form.
    - Develop the "Duplicate to Course" wizard/flow.
- **Logic Cleanup**: Identify and remove all references to `cadencia` and the ambiguous `0` logic in both frontend and backend.

## Out of Scope
- Changes to the core course creation engine.
- Integration with external payment gateways (unless specifically required for the pricing UX redesign).
- Modification of existing user permission structures, unless necessary for the new lifecycle controls.

## Risks
- **Data Migration**: Transitioning from the old ownership model to "one-course ownership" may require careful migration of existing package associations.
- **Breaking Changes**: Removing `cadencia` and `0` logic might break existing integrations or automated processes if not identified during analysis.
/   - **UI Regression**: The denser list view must remain accessible and usable for all admin roles.
