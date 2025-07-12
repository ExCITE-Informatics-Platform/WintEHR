# Detailed TypeScript Migration Plan with Pre/Post Steps

**Last Updated**: 2025-01-12  
**Branch**: typescript-migration-redesign  
**Critical References**: 
- HL7 FHIR R4: https://www.hl7.org/fhir/R4/
- CDS Hooks: https://cds-hooks.hl7.org/
- HL7 FHIR R5: https://hl7.org/fhir/index.html
- FHIR R6 (Preview): https://build.fhir.org/
- Context7 Documentation: Use `context7` command in Claude Code

## Overview

This document provides a detailed task breakdown for the TypeScript migration, ensuring each major task includes:
1. **Pre-steps**: Documentation review and resource consultation
2. **Main task**: The actual implementation work
3. **Post-steps**: Code review and verification

## Phase 1: Foundation & Setup (Week 1-2)

### 1.1 Documentation Review & Planning

#### Pre-Steps
- [ ] Review all existing documentation in `docs/modules/`
- [ ] Consult HL7 FHIR R4 specification at https://www.hl7.org/fhir/R4/
- [ ] Review CDS Hooks specification at https://cds-hooks.hl7.org/
- [ ] Use Context7 to fetch latest React 18 and TypeScript 5 documentation
- [ ] Review CLAUDE.md best practices in the repository

#### Main Tasks
- [ ] Create comprehensive component relationship diagram
- [ ] Document all FHIR resource dependencies
- [ ] Map clinical workflow integrations
- [ ] Create migration priority matrix
- [ ] Setup migration tracking spreadsheet

#### Post-Steps
- [ ] Review documentation completeness
- [ ] Verify all critical paths are documented
- [ ] Check documentation against FHIR standards
- [ ] Update `migration-tracker.md` with findings

### 1.2 TypeScript & Tooling Setup

#### Pre-Steps
- [ ] Review TypeScript 5.x documentation via Context7
- [ ] Check latest ESLint TypeScript plugin docs
- [ ] Review Vite TypeScript integration guide
- [ ] Consult React TypeScript best practices
- [ ] Check @types/react latest documentation

#### Main Tasks
```bash
# Install TypeScript and essential type definitions
npm install --save-dev typescript @types/react @types/react-dom @types/node
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier
```
- [ ] Create `tsconfig.json` with strict settings
- [ ] Configure ESLint for TypeScript
- [ ] Setup Prettier with TypeScript support
- [ ] Configure path aliases (@components, @services, etc.)
- [ ] Update package.json scripts for type checking

#### Post-Steps
- [ ] Run `tsc --noEmit` to verify configuration
- [ ] Test ESLint on a sample TypeScript file
- [ ] Verify path aliases work correctly
- [ ] Document configuration decisions in `migration-tracker.md`
- [ ] Create `.eslintrc.typescript.js` for TypeScript-specific rules

### 1.3 FHIR Type Definitions

#### Pre-Steps
- [ ] Review FHIR R4 resource definitions at https://www.hl7.org/fhir/R4/resourcelist.html
- [ ] Study FHIR R5 changes at https://hl7.org/fhir/index.html
- [ ] Use Context7 to fetch @ahryman40k/ts-fhir-types documentation
- [ ] Review FHIR validation requirements
- [ ] Check CDS Hooks type requirements

#### Main Tasks
```bash
# Install FHIR type definitions with runtime validation
npm install --save @ahryman40k/ts-fhir-types
npm install --save-dev @types/fhir
```
- [ ] Create `src/types/fhir/` directory structure
- [ ] Define custom FHIR type extensions for MedGenEMR
- [ ] Create type guards for all used FHIR resources
- [ ] Implement FHIR validation utilities
- [ ] Create CDS Hooks type definitions

#### Post-Steps
- [ ] Validate types against FHIR R4 specification
- [ ] Test runtime validation with sample data
- [ ] Verify type guards catch invalid resources
- [ ] Document custom type extensions
- [ ] Cross-reference with existing FHIR validation logic

### 1.4 Claude Code Optimization

#### Pre-Steps
- [ ] Review Claude Code best practices documentation
- [ ] Study successful Claude Code repositories
- [ ] Use Context7 to get latest Claude Code patterns
- [ ] Review existing CLAUDE.md in other projects
- [ ] Check Context7 MCP integration docs

#### Main Tasks
- [ ] Create comprehensive `CLAUDE.md` at project root
- [ ] Setup `.claude/` directory structure:
  ```
  .claude/
  ├── settings.json
  ├── hooks/
  │   ├── pre-task.sh
  │   ├── post-task.sh
  │   └── documentation-tracker.py
  ├── agents/
  └── workflows/
  ```
- [ ] Configure Claude Code hooks for TypeScript
- [ ] Create modular documentation structure
- [ ] Implement Context7 MCP integration
- [ ] Setup automated documentation updates

#### Post-Steps
- [ ] Test Claude Code with new configuration
- [ ] Verify hooks execute properly
- [ ] Check Context7 integration works
- [ ] Document Claude Code setup
- [ ] Update migration tracker

### 1.5 Build System Migration

#### Pre-Steps
- [ ] Review Vite documentation via Context7
- [ ] Study Vite TypeScript configuration
- [ ] Check React + Vite best practices
- [ ] Review current CRA configuration
- [ ] Document all custom webpack configs

#### Main Tasks
```bash
# Install Vite and related dependencies
npm install --save-dev vite @vitejs/plugin-react
npm install --save-dev vite-tsconfig-paths
```
- [ ] Create `vite.config.ts`
- [ ] Migrate proxy configuration
- [ ] Setup environment variables
- [ ] Configure build optimization
- [ ] Update all npm scripts

#### Post-Steps
- [ ] Test development server with Vite
- [ ] Verify proxy works correctly
- [ ] Check build output
- [ ] Compare bundle sizes
- [ ] Document migration decisions

## Phase 2: Core Infrastructure (Week 3-4)

### 2.1 Service Layer Migration

#### Pre-Steps (for each service)
- [ ] Review service documentation in `docs/modules/frontend/services-module.md`
- [ ] Check FHIR R4 API documentation for relevant resources
- [ ] Use Context7 for Axios TypeScript patterns
- [ ] Review existing service integration points
- [ ] Document service dependencies

#### Main Tasks - fhirClient.js → fhirClient.ts
- [ ] Create interfaces for all request/response types
- [ ] Define comprehensive error types
- [ ] Implement generic CRUD methods with proper typing
- [ ] Add FHIR resource validation
- [ ] Create service factory pattern
- [ ] Migrate all methods with strict types

#### Post-Steps
- [ ] Run TypeScript compiler check
- [ ] Test all CRUD operations
- [ ] Verify FHIR compliance
- [ ] Update service documentation
- [ ] Code review against standards
- [ ] Run existing tests

### 2.2 Utility Functions Migration

#### Pre-Steps (for each utility)
- [ ] Review utility documentation
- [ ] Check FHIR formatting requirements
- [ ] Use Context7 for utility typing patterns
- [ ] Review utility usage across codebase
- [ ] Document input/output types

#### Main Tasks (per utility file)
- [ ] Define input/output interfaces
- [ ] Add comprehensive type annotations
- [ ] Implement proper error handling
- [ ] Create unit tests with types
- [ ] Document type usage

#### Post-Steps
- [ ] Verify no type errors
- [ ] Run all utility tests
- [ ] Check type inference works
- [ ] Update documentation
- [ ] Code review

### 2.3 WebSocket & Real-time

#### Pre-Steps
- [ ] Review WebSocket documentation
- [ ] Check real-time event types
- [ ] Use Context7 for WebSocket TypeScript patterns
- [ ] Review CDS Hooks real-time requirements
- [ ] Document event flow

#### Main Tasks
- [ ] Create WebSocket message interfaces
- [ ] Type all event payloads
- [ ] Implement type-safe event emitter
- [ ] Migrate WebSocket service
- [ ] Update WebSocket context

#### Post-Steps
- [ ] Test real-time features
- [ ] Verify message typing
- [ ] Check event propagation
- [ ] Update documentation
- [ ] Performance testing

## Phase 3: State Management (Week 5-6)

### 3.1 Context Migration

#### Pre-Steps (for each context)
- [ ] Review context documentation
- [ ] Check React Context TypeScript patterns via Context7
- [ ] Document context consumers
- [ ] Review state shape
- [ ] Check reducer patterns

#### Main Tasks - FHIRResourceContext
- [ ] Define state interface
- [ ] Type all actions
- [ ] Create typed reducer
- [ ] Implement typed hooks
- [ ] Migrate context provider
- [ ] Update all consumers

#### Post-Steps
- [ ] Verify type safety
- [ ] Test state updates
- [ ] Check consumer compatibility
- [ ] Update documentation
- [ ] Code review

## Phase 4: Component Migration (Week 7-10)

### 4.1 Component Migration Strategy

#### Pre-Steps (for each component group)
- [ ] Review component documentation
- [ ] Check FHIR resource usage
- [ ] Use Context7 for React TypeScript patterns
- [ ] Review Material-UI TypeScript usage
- [ ] Document prop interfaces

#### Main Tasks (per component)
- [ ] Define prop interfaces
- [ ] Type event handlers
- [ ] Migrate component logic
- [ ] Update child components
- [ ] Add proper return types

#### Post-Steps
- [ ] Type check component
- [ ] Test functionality
- [ ] Verify FHIR compliance
- [ ] Update documentation
- [ ] Visual regression testing

## Phase 5: Testing & Quality (Week 11-12)

### 5.1 Test Infrastructure

#### Pre-Steps
- [ ] Review Jest TypeScript configuration
- [ ] Check React Testing Library types
- [ ] Use Context7 for test patterns
- [ ] Review existing test coverage
- [ ] Document test requirements

#### Main Tasks
- [ ] Configure Jest for TypeScript
- [ ] Create typed test utilities
- [ ] Setup coverage reporting
- [ ] Migrate test files
- [ ] Add type coverage metrics

#### Post-Steps
- [ ] Verify all tests pass
- [ ] Check coverage metrics
- [ ] Review type coverage
- [ ] Update documentation
- [ ] CI/CD integration

## Critical Success Factors

### Documentation Requirements
1. **Every task must start with documentation review**
2. **Use Context7 for latest library documentation**
3. **Reference HL7 standards for FHIR compliance**
4. **Update migration tracker after each task**

### Code Review Standards
1. **No `any` types without justification**
2. **All FHIR resources properly typed**
3. **Complete error handling**
4. **Documentation updated**
5. **Tests passing**

### Resource References
- **FHIR R4**: https://www.hl7.org/fhir/R4/ (primary reference)
- **CDS Hooks**: https://cds-hooks.hl7.org/ (for clinical decision support)
- **FHIR R5**: https://hl7.org/fhir/index.html (future compatibility)
- **Context7**: Use in Claude Code for real-time documentation
- **TypeScript**: Use Context7 for latest TypeScript patterns

## Migration Workflow Template

For each file migration:

```markdown
### Pre-Migration Checklist
- [ ] Read relevant documentation
- [ ] Check FHIR specifications if applicable
- [ ] Use Context7 for library docs
- [ ] Review file dependencies
- [ ] Document current functionality

### Migration Steps
- [ ] Create TypeScript file
- [ ] Define interfaces/types
- [ ] Migrate code with types
- [ ] Handle edge cases
- [ ] Add error handling

### Post-Migration Verification
- [ ] Run TypeScript compiler
- [ ] Execute unit tests
- [ ] Verify FHIR compliance
- [ ] Update documentation
- [ ] Code review
- [ ] Update migration tracker
```

## Automation Scripts

### Pre-Task Hook (.claude/hooks/pre-task.sh)
```bash
#!/bin/bash
echo "📚 Pre-task: Checking documentation..."
echo "- Review FHIR specs at https://www.hl7.org/fhir/R4/"
echo "- Check CDS Hooks at https://cds-hooks.hl7.org/"
echo "- Use 'context7' for latest library docs"
```

### Post-Task Hook (.claude/hooks/post-task.sh)
```bash
#!/bin/bash
echo "✅ Post-task: Running verification..."
npm run type-check
npm run lint:ts
npm run test:changed
echo "📝 Update migration-tracker.md"
```

---

## Update Log

### 2025-01-12
- Created detailed migration plan with pre/post steps
- Added critical resource references
- Included Context7 integration points
- Defined comprehensive task structure
- Added automation hooks