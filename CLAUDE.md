# CLAUDE.md - MedGenEMR Developer Guide

**Production-Ready FHIR-Native EMR**  
**Version**: 2025-01-12  
**Stack**: React 18 + FastAPI + PostgreSQL + Docker  
**Standards**: FHIR R4, CDS Hooks 1.0, DICOM  
**Branch**: typescript-migration-redesign

> **⚠️ CRITICAL**: Every task MUST start with research using `context7` and web searches to ensure alignment with current standards. See Task Management Protocol section.

## 🚀 Quick Start

```bash
# Start system with validation
./start.sh

# Fresh deployment with sample data
./fresh-deploy.sh

# Validate deployment
python scripts/validate_deployment.py --verbose

# View logs
docker-compose logs backend -f

# Common fixes
docker-compose down -v          # Full reset
cd frontend && npm install      # Fix dependencies
```

### Authentication Modes
```bash
export JWT_ENABLED=false  # Training mode (default users: demo/nurse/pharmacist/admin, password: password)
export JWT_ENABLED=true   # Production JWT mode (requires registration)
```

## 📋 CRITICAL: Task Management Protocol

**⚠️ EVERY task MUST follow this structure - NO EXCEPTIONS**

### 1️⃣ Research First (MANDATORY)
- Research affected modules in `docs/modules/`
- Review all related documentation
- Use `context7` for latest patterns/standards
- Web search current best practices
- Update any outdated docs BEFORE coding

### 2️⃣ Implementation 
- Break into logical subtasks
- Follow established patterns
- Test with real Synthea data

### 3️⃣ Final Review (MANDATORY)
- Two-pass code review
- Git commit and push
- Update ALL affected documentation

**See "Task Management Protocol" section for detailed breakdown**

## 🎯 System Overview

### What This System Is
A **complete, production-ready EMR** featuring:
- ✅ Full FHIR R4 implementation (38 resource types)
- ✅ Complete clinical workflows (order-to-result, prescribe-to-dispense)
- ✅ Real-time WebSocket updates with event-driven architecture
- ✅ Sophisticated caching and progressive loading
- ✅ DICOM imaging with multi-slice viewer
- ✅ CDS Hooks with 10+ clinical rules
- ✅ 20,115+ Synthea test resources

### Clinical Modules
| Module | Features | Integration |
|--------|----------|-------------|
| **Chart Review** | Problems, medications, allergies, immunizations | CRUD + Export |
| **Results** | Lab trends, reference ranges, abnormal alerts | Real-time updates |
| **Orders** | Multi-category CPOE, status tracking | Workflow events |
| **Pharmacy** | Queue management, dispensing, lot tracking | MedicationDispense |
| **Imaging** | DICOM viewer, multi-slice navigation | Study generation |
| **Encounters** | Summary views, clinical documentation | Timeline view |

## ⚠️ Critical Development Rules

### 0. Task Structure (ABSOLUTE REQUIREMENT)
**EVERY task MUST**:
- ✅ Start with research phase (modules, docs, context7, web search)
- ✅ Be broken into clear subtasks
- ✅ End with two-pass review + git commit + doc updates
- ✅ See "Task Management Protocol" section for mandatory structure

### 1. Data Standards
**ALWAYS**:
- ✅ Use ONLY Synthea-generated FHIR data
- ✅ Test with multiple real patients from database
- ✅ Handle missing/null data gracefully
- ✅ Use `fhirService.js` for all FHIR operations

**NEVER**:
- ❌ Create mock patients (John Doe, Jane Smith)
- ❌ Hardcode resource IDs
- ❌ Use array indexes for data access
- ❌ Skip validation or error handling

### 2. Implementation Standards
**ALWAYS**:
- ✅ Complete ALL features end-to-end
- ✅ Implement loading states and error handling
- ✅ Use Context + Reducer pattern for complex state
- ✅ Follow event-driven architecture

**NEVER**:
- ❌ Leave console.log() statements
- ❌ Create partial implementations
- ❌ Skip cross-module integration
- ❌ Bypass the caching layer

### 3. Component Communication
**ALWAYS**:
- ✅ Use `ClinicalWorkflowContext` for cross-tab events
- ✅ Implement pub/sub for workflow orchestration
- ✅ Follow progressive loading patterns

**NEVER**:
- ❌ Direct component coupling
- ❌ Create redundant data fetching

## 🔄 TypeScript Migration (Active)

**Branch**: `typescript-migration-redesign`  
**Method**: Phased approach, critical files first  
**Types**: @ahryman40k/ts-fhir-types for FHIR R4

### Key Resources
- Migration Plan: `docs/typescript-migration/detailed-migration-plan.md`
- Migration Tracker: `docs/typescript-migration/migration-tracker.md`
- FHIR Types: https://www.hl7.org/fhir/R4/

### Migration Checklist
1. Review module docs in `docs/modules/`
2. Consult FHIR R4 and CDS Hooks specs
3. Implement with strict types
4. Update documentation

## 🏗️ Architecture Patterns

**⚠️ IMPORTANT**: Always verify patterns with context7 and current React/TypeScript best practices before implementing.

### Frontend: Context + Events + Progressive Loading
```javascript
// State Management
const { resources, loading } = useFHIRResource();

// Cross-Module Events
const { publish, subscribe } = useClinicalWorkflow();
await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);

// Progressive Loading
await fetchPatientBundle(patientId, false, 'critical');
```

### Backend: Repository + Service + DI
```python
# Repository Pattern
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict)

# Service Layer
class PharmacyService:
    async def dispense_medication(self, data: dict)

# Dependency Injection
async def endpoint(storage: FHIRStorageEngine = Depends(get_storage)):
```

### Caching Strategy
```javascript
// TTL Configuration
resources: 10min | searches: 5min | bundles: 15min | computed: 30min

// Loading Priority
critical: ['Condition', 'MedicationRequest', 'AllergyIntolerance']
important: ['Observation', 'Procedure', 'DiagnosticReport']
optional: ['CarePlan', 'CareTeam', 'DocumentReference']
```

## 💻 Common Implementation Patterns

### Adding New Clinical Feature
```javascript
// 1. Create component
src/components/clinical/workspace/tabs/NewFeatureTab.js

// 2. Use FHIR hooks
const { resources, loading } = usePatientResources(patient?.id, 'ResourceType');

// 3. Integrate workflows
const { publish, subscribe } = useClinicalWorkflow();
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.RELEVANT_EVENT, handleEvent);
  return unsubscribe;
}, []);

// 4. Implement CRUD
await fhirService.createResource('ResourceType', resourceData);
await refreshPatientResources(patient.id);
```

### FHIR Reference Handling
```javascript
// Handle both reference formats
const patientRef = reference.startsWith('urn:uuid:') 
  ? reference.replace('urn:uuid:', '') 
  : reference.split('/')[1];

// Safe navigation
const medicationDisplay = medication?.code?.text || 
                         medication?.code?.coding?.[0]?.display || 
                         'Unknown medication';
```

### Cross-Module Workflow
```javascript
// Publisher (Orders Tab)
await publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  type: 'laboratory',
  patient: patient.id
});

// Subscriber (Results Tab)
subscribe(CLINICAL_EVENTS.ORDER_PLACED, async (data) => {
  if (data.type === 'laboratory') {
    await createPendingResultPlaceholder(data);
  }
});
```

### WebSocket Integration
```javascript
import { useWebSocket } from '../contexts/WebSocketContext';

const { subscribe, unsubscribe, lastMessage } = useWebSocket();

useEffect(() => {
  subscribe('patient-updates', ['Observation', 'Condition'], [patientId]);
  return () => unsubscribe('patient-updates');
}, [patientId]);
```

## 🤖 Agent System

### Integration with Task Protocol
The agent system supports the mandatory task structure:
1. **Research Phase**: Use `feature-analyzer.py` to identify docs and modules
2. **Implementation**: Use `feature-scaffold.py` for boilerplate
3. **Review Phase**: Use `qa-agent.py` and `integration-validator.py`

### Master Feature Workflow
```bash
# Complete feature development
python .claude/agents/feature-workflow.py "Add medication allergy checking"

# Quick analysis only
python .claude/agents/feature-workflow.py "New lab viewer" --check-only
```

### Individual Agents

| Agent | Purpose | Usage |
|-------|---------|-------|
| **feature-scaffold.py** | Generate boilerplate | `python .claude/agents/feature-scaffold.py "Feature name"` |
| **fhir-integration-checker.py** | Validate FHIR compliance | `python .claude/agents/fhir-integration-checker.py` |
| **integration-validator.py** | Check cross-module patterns | `python .claude/agents/integration-validator.py --suggest` |
| **qa-agent.py** | Code quality & cleanup | `python .claude/agents/qa-agent.py --fix` |
| **feature-analyzer.py** | Analyze & create todos | `python .claude/agents/feature-analyzer.py "Feature" --output todo` |

### Quality Gates
- ❌ No console.log statements (auto-fixed)
- ✅ FHIR compliance validated
- ✅ Cross-module integration verified
- ✅ Error handling implemented
- ✅ Documentation updated

## 📚 Documentation System

### Documentation Workflow
**BEFORE** any code change:
1. Use TodoWrite to include "Update documentation for [module]"
2. Search for related docs:
   ```bash
   Glob: **/*ComponentName*.md
   Glob: docs/modules/**/*feature*.md
   Grep: "feature" in docs/
   ```
3. Read identified documentation

**AFTER** implementation:
1. Update ALL affected documentation
2. Add "Recent Updates" section with date
3. Update cross-references
4. Verify code examples work

### Key Documentation Locations
- **System Architecture**: `docs/architecture/overview.md`
- **Module Docs**: `docs/modules/[frontend|backend|standalone]/`
- **API Reference**: `docs/API_ENDPOINTS.md`
- **Integration Guide**: `docs/modules/integration/cross-module-integration.md`

## 📊 Data Management

### Synthea Integration
```bash
cd backend
python scripts/synthea_master.py full --count 10      # Complete workflow
python scripts/synthea_master.py generate --count 20  # Generate only
python scripts/synthea_master.py import               # Import to database
python scripts/synthea_master.py validate             # Validate data
```

### DICOM Generation
```bash
python scripts/generate_dicom_for_studies.py  # Multi-slice CT/MR studies
```

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Export 'X' not found | Import from `@mui/icons-material` not `@mui/material` |
| Objects not valid as React child | Use `obj?.text \|\| obj?.coding?.[0]?.display` |
| Medications show "Unknown" | Use `useMedicationResolver` hook |
| Missing patient data | Check `resources` not `result.entry` |
| CORS errors | Ensure backend running: `docker-compose ps` |
| WebSocket fails | Check auth token, ensure JWT_ENABLED matches |
| Export fails (large data) | Implement pagination or chunking |
| CDS hook validation | Check hook ID uniqueness |

## 📁 Critical Files Reference

### Frontend Core
```
src/services/fhirService.js              # FHIR CRUD operations
src/contexts/FHIRResourceContext.js      # Resource state management
src/contexts/ClinicalWorkflowContext.js  # Cross-module events
src/hooks/useFHIRResources.js           # Data fetching hooks
src/hooks/useMedicationResolver.js      # Medication display logic
```

### Backend Core
```
backend/core/fhir/storage.py            # FHIR storage engine
backend/api/fhir/fhir_router.py         # FHIR R4 endpoints
backend/core/fhir/search.py             # Search implementation
backend/api/auth_enhanced.py            # Dual-mode auth
backend/scripts/synthea_master.py       # Data management
```

## 🔄 Clinical Workflows

### Order-to-Result Flow
1. **Order**: Create ServiceRequest → Publish ORDER_PLACED
2. **Lab**: Create Observation → Link to order
3. **Results**: Check ranges → Publish RESULT_RECEIVED
4. **Alerts**: Detect abnormals → Create alerts
5. **Response**: Suggest follow-up → Update care plan

### Prescription-to-Dispense Flow
1. **Prescribe**: Create MedicationRequest → Notify pharmacy
2. **Queue**: Load pending → Verify prescription
3. **Dispense**: Create MedicationDispense → Update status
4. **Notify**: Publish MEDICATION_DISPENSED → Update chart

## 🧪 Testing

```bash
# Backend tests
docker exec emr-backend pytest tests/ -v

# Frontend tests
cd frontend && npm test
cd frontend && npm run test:coverage
```

## 📋 Task Management Protocol

### MANDATORY: Task Breakdown Structure

**Every task MUST be broken into subtasks using TodoWrite following this pattern:**

#### Starting a Task
```javascript
// Use TodoWrite to create task structure
TodoWrite([
  { content: "Research Phase: Review module documentation", status: "pending" },
  { content: "Research Phase: Check context7 for latest patterns", status: "pending" },
  { content: "Research Phase: Update outdated documentation", status: "pending" },
  { content: "Implementation: [specific subtask]", status: "pending" },
  { content: "Review: First pass - check completeness", status: "pending" },
  { content: "Review: Second pass - verify integration", status: "pending" },
  { content: "Finalize: Git commit and push", status: "pending" },
  { content: "Finalize: Update all documentation", status: "pending" }
]);
```

#### 1. Research Phase (ALWAYS FIRST)
```bash
# For EVERY task, create these research subtasks:
- [ ] Research affected modules in docs/modules/
- [ ] Review related documentation files
- [ ] Use context7 to check latest library patterns/standards
- [ ] Web search for current best practices if needed
- [ ] Document any discrepancies found
- [ ] Update outdated documentation BEFORE coding
```

#### 2. Implementation Phase
```bash
# Break feature into logical subtasks:
- [ ] Core functionality implementation
- [ ] Integration with existing modules
- [ ] Error handling and edge cases
- [ ] Loading states and UI feedback
- [ ] Event publishing/subscribing
- [ ] Testing with multiple patients
```

#### 3. Review & Finalization (MANDATORY LAST SUBTASK)
```bash
# EVERY task MUST end with:
- [ ] First code review pass:
    - Check for incompletions (no TODOs)
    - Verify module integrations
    - Ensure consistent patterns
    - Remove all console.log statements
- [ ] Second code review pass:
    - Validate FHIR compliance
    - Check event handling
    - Verify error handling
    - Ensure code is clean and simple
    - Refactor complex code for clarity
    - Remove unnecessary abstractions
- [ ] Git commit with descriptive message
- [ ] Git push to repository
- [ ] Update documentation:
    - Current module docs
    - Related/dependent module docs
    - Add "Recent Updates" with date
    - Update integration guides if needed
```

### Code Quality Standards
**Clean and Simple Code**:
- Prefer clarity over cleverness
- Use descriptive variable names
- Keep functions focused and small
- Avoid premature optimization
- Remove commented-out code
- Consolidate duplicate logic

**Review Focus Areas**:
- ✅ No incomplete features (search for TODO, FIXME, XXX)
- ✅ All edge cases handled
- ✅ Consistent error messages
- ✅ Proper loading and error states
- ✅ Cross-browser compatibility
- ✅ Mobile responsiveness considered
- ✅ Accessibility requirements met

### Git Commit Standards
```bash
# Use conventional commit format:
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactor code
test: Add tests
chore: Update dependencies

# Examples:
git commit -m "feat: Add medication interaction checking with CDS integration"
git commit -m "fix: Handle null medication references in resolver"
git commit -m "docs: Update pharmacy module with interaction patterns"
```

### Example Task Breakdown

**Task: "Add medication interaction checking"**

```markdown
## Task: Add medication interaction checking

### 1. Research Phase
- [ ] Research docs/modules/frontend/clinical-workspace-module.md
- [ ] Review docs/modules/backend/clinical-services-module.md
- [ ] Check pharmacy module integration points
- [ ] Use context7 for drug interaction API standards
- [ ] Web search "FHIR medication interaction best practices 2025"
- [ ] Update pharmacy module docs with interaction patterns

### 2. Implementation Subtasks
- [ ] Create MedicationInteractionService.js
- [ ] Add interaction checking to MedicationRequest workflow
- [ ] Integrate with CDS Hooks for alerts
- [ ] Create InteractionWarningDialog component
- [ ] Add event: MEDICATION_INTERACTION_DETECTED
- [ ] Connect to pharmacy dispensing workflow

### 3. Review & Finalization
- [ ] First review: Check all features complete
- [ ] Second review: Verify FHIR compliance
- [ ] Git commit: "feat: Add medication interaction checking with CDS integration"
- [ ] Git push origin typescript-migration-redesign
- [ ] Update clinical-workspace-module.md
- [ ] Update pharmacy-module.md
- [ ] Update cross-module-integration.md
```

### Quick Task Template
```markdown
## Task: [Task Description]

### 1. Research Phase
- [ ] Research modules: _______________
- [ ] Review docs: _______________
- [ ] Context7 check: _______________
- [ ] Web search: _______________
- [ ] Update outdated docs

### 2. Implementation
- [ ] [Subtask 1]
- [ ] [Subtask 2]
- [ ] [Subtask 3]

### 3. Review & Finalization
- [ ] First review pass
- [ ] Second review pass
- [ ] Git commit: "type: description"
- [ ] Git push
- [ ] Update module docs
- [ ] Update related docs
```

## 🔍 Research Standards

### Use Context7 For:
- Latest React patterns and hooks
- TypeScript best practices
- FHIR R4 implementation details
- Library-specific documentation
- Performance optimization techniques

### Web Search For:
- Current healthcare IT standards
- FHIR community best practices
- Security recommendations
- Accessibility guidelines
- Browser compatibility issues

### Documentation Verification:
```bash
# Before coding, ALWAYS:
1. Check if docs match current implementation
2. Note any discrepancies in TodoWrite
3. Update docs BEFORE implementing
4. Reference updated docs during coding
5. If docs are missing, create them first
```

**IMPORTANT**: Never code based on outdated documentation. Always update docs first to establish the correct implementation pattern.

## 📋 Session Checklist

**Pre-Session**:
- [ ] System running: `docker-compose ps`
- [ ] Auth mode correct: `curl http://localhost:8000/api/auth/config`
- [ ] Data loaded: Check Patient count in UI
- [ ] No console errors

**During Development**:
- [ ] EVERY task broken into subtasks
- [ ] Research phase completed first
- [ ] Using context7/web search for standards
- [ ] Documentation updated continuously
- [ ] Following event patterns
- [ ] Testing with multiple patients

**Post-Implementation**:
- [ ] Two-pass code review completed
- [ ] Git commit and push done
- [ ] All documentation updated
- [ ] No console.log() statements
- [ ] Integration points verified

## 🎯 Known Gaps & Priorities

**Critical**: Frontend E2E tests, Load testing  
**Medium**: Analytics dashboard, Mobile support  
**Future**: SMART on FHIR, AI integration

---

**Remember**: This is a production EMR. Patient safety and data integrity are paramount.

## 📅 Recent Updates

### 2025-01-12
- Added mandatory Task Management Protocol requiring research phase for all tasks
- Required use of context7 and web searches for current standards alignment
- Implemented TodoWrite integration for task structure
- Mandated two-pass code review process with focus on clean, simple code
- Required git commit/push with conventional commit messages
- Enhanced documentation update requirements for all tasks
- Added code quality standards emphasizing clarity and simplicity
- Consolidated and reorganized developer guide
- Improved documentation structure and flow

### 2025-01-08
- Implemented comprehensive agent system
- Added automated quality gates
- Removed all console.log/print statements
- Enhanced security and testing infrastructure
- Improved error handling with ErrorBoundary