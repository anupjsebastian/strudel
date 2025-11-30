# Strudel Fork - Project Goals

## Vision
Transform Strudel into a **local-first, code-based DAW** that combines the power of live coding with professional music production workflows. Keep the collaborative spirit of web-based live coding while enabling serious, offline music production.

## Core Philosophy
- **Local-first**: Work entirely offline if needed
- **Code-organized**: Treat music projects like software projects
- **GitHub-integrated**: Optional collaboration and sharing via GitHub
- **Open ecosystem**: Share packages, samples, and patterns as code

---

## Key Features

### 1. Local File System Integration
- **Local sample loading**: `samples('./my-samples/')` from workspace folders
- **Direct file access**: `sound('./kicks/kick808.wav')` for individual files
- **GitHub fallback**: Keep existing `samples('github:user/repo')` support
- **Hybrid approach**: Mix local and remote resources seamlessly

### 2. Multi-File Project Structure
Enable proper project organization like a programming language:

```
my-album/
  ├── main.str              # Main composition
  ├── samples/              # Local sample library
  │   ├── drums/
  │   ├── synths/
  │   └── vocals/
  ├── patterns/             # Reusable pattern modules
  │   ├── bass.str
  │   ├── drums.str
  │   └── melody.str
  ├── presets/              # Sound presets as code
  │   └── synth-presets.str
  ├── lib/                  # Utility functions
  │   └── helpers.str
  └── package.json          # Optional: metadata, dependencies
```

### 3. Module System (ES6 Imports)
Already implemented in fork via `transpileWithImports`:
- Import patterns from other `.str` files
- Support relative paths: `import { bassline } from './patterns/bass.str'`
- Support subfolder organization: `import { kit } from '../drums/kit.str'`
- Export/share reusable components: `export const myPattern = ...`

### 4. Package/Library System
- **Local packages**: Organize complex projects into modules
- **GitHub packages**: Share and reuse via GitHub links
- **Version control friendly**: Everything is code and text files
- **Collaboration ready**: Clone, fork, contribute like software projects

### 5. Workspace Integration (VS Code Extension)
- Enhanced file loading with workspace awareness
- Multi-file project support
- Sample library management
- Hot-reload for samples and imports
- Project-aware path resolution

---

## Technical Implementation

### What We Have
✅ ES6 import/export via `transpileWithImports` (in transpiler)  
✅ Pattern evaluation engine (`@strudel/core`)  
✅ Audio output (Web Audio API)  
✅ VS Code extension with webview  
✅ GitHub sample loading  
✅ Synthesizers and effects  

### What We Need
🔧 Local file sample loading via VS Code webview URIs  
🔧 Enhanced `fileLoader` for workspace-relative paths  
🔧 Package resolution system (Node.js-style module resolution)  
🔧 Webview asset serving for local audio files  
🔧 Better multi-file workspace support  

### What We Can Remove (Optional)
- Heavy web-only features if not needed
- Redundant remote dependencies
- Browser-specific limitations

---

## Use Cases

### Scenario 1: Solo Music Production
- Work entirely offline on laptop
- Organize samples in local folders
- Use imports to structure complex compositions
- Push to personal GitHub for backup
- No internet required for music making

### Scenario 2: Collaborative Album
- Team clones shared repo
- Each contributor works on separate `.str` files
- Share common sample library
- Import each other's patterns
- Merge contributions via Git
- Deploy final mix from `main.str`

### Scenario 3: Live Coding Performance
- Local project with all samples and patterns
- Import helper functions from libraries
- Quick iterations without network dependency
- Optional: stream code to GitHub for audience viewing
- Reliable offline performance

### Scenario 4: Open Source Sound Packs
- Publish sample libraries as GitHub repos
- Include `.str` demo patterns
- Users import via `samples('github:user/sound-pack')`
- Community contributes improvements
- Versioned releases

---

## Comparison with Current Strudel

| Feature | Web REPL | This Fork |
|---------|----------|-----------|
| **Storage** | Browser/URL only | File system + Git |
| **Organization** | Single file | Multi-file projects |
| **Samples** | Remote URLs only | Local + Remote |
| **Imports** | Not supported | ES6 modules |
| **Offline** | Limited | Fully supported |
| **Collaboration** | Share URLs | Git workflows |
| **Packages** | Not available | GitHub-based |
| **Project Size** | Small patterns | Full albums/projects |

---

## Development Roadmap

### Phase 1: Core File System Support
- [ ] Local sample loading via webview URIs
- [ ] Enhanced path resolution for imports
- [ ] Workspace-aware file operations

### Phase 2: Project Structure
- [ ] Package.json support for projects
- [ ] Module resolution system
- [ ] Sample library management

### Phase 3: Developer Experience
- [ ] Hot-reload for samples
- [ ] Better error messages for imports
- [ ] Project templates/scaffolding

### Phase 4: Ecosystem
- [ ] Package registry (GitHub-based)
- [ ] Example projects and templates
- [ ] Documentation and guides

---

## Target Audience

- **Electronic musicians** wanting code-based workflows
- **Live coders** needing reliable offline performance
- **Developers** building music with version control
- **Educators** teaching algorithmic composition
- **Sound designers** managing complex sample libraries
- **Open source enthusiasts** sharing musical creations

---

## Success Criteria

1. Can produce a complete album entirely offline
2. Can organize project with 100+ files naturally
3. Can share and clone projects like software repos
4. Can collaborate on music like code (PRs, issues, forks)
5. Can publish reusable packages for community
6. Works reliably without internet connection

---

## Contributing

This is an experimental fork exploring Strudel as a local-first DAW. Contributions welcome for:
- Local file system integration
- Module/package system improvements
- VS Code extension enhancements
- Example projects and templates
- Documentation

---

## License

Inherits AGPL-3.0 from upstream Strudel project.
