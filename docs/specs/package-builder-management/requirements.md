# Requirements: Package Builder Management

## Introduction
This document defines the functional and non-functional requirements for the overhaul of the "Package Builder" system. The goal is to simplify package management, establish a clear ownership model (one course per package), and introduce robust lifecycle controls.

## 1. Functional Requirements

### 1.1 Package Editing & Configuration
* **REQ-01: Full Editability**: Admins must be able to edit all editable fields of an existing package, including Name, Description, Price, and Course Association.
* **REQ-02: Pricing Clarity**: The pricing interface must explicitly handle cents (e.g., using a decimal separator or separate input for subunits) to prevent ambiguity.
* **REQ-03: Removal of Legacy Logic**: All logic related to `cadencia` (frequency/cadence) and the use of `0` as a special placeholder value must be removed from both the UI and Backend.

### 1.2 Ownership & Duplication Workflow
* **REQ-04: One-Course Ownership**: Every package must be strictly associated with exactly one course. A package cannot exist independently of a course context in the new model.
* **RE-05: Duplicate-to-Course Flow**: Users must be able to select an existing package and trigger a "Duplicate to Course" action. This process should:
    * Create a copy of the package configuration.
    * Prompt the user to select a target course.
    * Link the new package instance to the selected course.

### 1.3 Lifecycle Management
* **REQ-06: Package States**: Packages must support the following lifecycle states:
    * `ACTIVE`: Available for purchase/enrollment.
    * `SUSPENDED`: Temporarily disabled; visible in admin panel but not available to end-users.
    * `SCHEDULED`: Set to become active on a specific future date.
* **REQ-07: Suspend/Relaunch**: Admins must be able to toggle the `SUSPENDED` state for any package.
* **REQ-08: Scheduled Launch**: Admins must be able to set a `launch_date`. The system must automatically transition the package from `SCHEDULED` to `ACTIVE` when the date is reached.

### 1.4 UI/UX - Package List
* **REQ-09: Denser List Layout**: The package list view must be refactored into a high-density table or list format that maximizes information per square inch (e.g., showing Course, Price, Status, and Launch Date in a single row).

### 1.5 Deletion/Removal
* **REQ-10: Soft Removal**: Removing a package from the UI should mark it as `DELETED` (soft delete) to preserve historical transaction integrity, but it should no longer appear in the active management list.

## 2. Non-Functional Requirements
* **NFR-01: Data Integrity**: The transition from the old ownership model must ensure that existing packages are correctly migrated/re-associated with their parent courses without loss of data.
* **NFR-02: Performance**: The denser package list must remain performant even when managing hundreds of packages.

## / Scenarios / Acceptance Criteria

### Scenario 1: Editing a Package Price
**Given** an admin is on the "Edit Package" screen for "Advanced React Course"\
**When** they change the price from `$50.00` to `$45.50` and save\
**Then** the package price is updated, and the cents are clearly reflected in both the admin view and the end-user checkout page.

### Scenario 2: Duplicating a Package
**Given** an admin has selected the "Python Pro" package\
**When** they click "Duplicate to Course" and select the "Data Science Bootcamp" course\
**Then** a new package is created, inheriting all settings from "Python Pro", but linked specifically to "Data Science Bootcamp".

### Scenario 3: Suspending a Package
**Given** an active package "Intro to SQL"\
**When** the admin clicks "Suspend"\
**Then** the package status changes to `SUSPENDED`, and it is immediately removed from the public-facing course catalog.

### Scenario 4: Scheduled Launch
**Given** an admin creates a new package for "Next.js Mastery"\
**When** they set a launch date of `2026-05-01`\
**Then** the package remains in `SCHEDULED` state and is not visible to end-users until the system clock reaches the scheduled date.

### Scenario 5: Removing Legacy '0' Logic
**Given** an admin attempts to enter `0` as a price value\
**When** they attempt to save\
**Then** the system should either prevent this (if 0 is invalid) or treat it as a clear `$0.00` without using the old "cadencia" logic, ensuring no ambiguity about whether it's a free package or a placeholder.
