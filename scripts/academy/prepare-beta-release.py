"""Prepare a portable Beta artifact without modifying either source worktree."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess

# Published main commit the artifact is layered on. Bump this whenever the
# published site advances so the Beta build never rolls production back.
BASE_COMMIT = 'f48fd3a'

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--base', default=BASE_COMMIT, help='Commit of the published app to layer the Beta build on')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
target = Path(args.output).resolve()
if target.exists():
    raise SystemExit('Output must be a new directory')
target.mkdir(parents=True)
archive = subprocess.Popen(['git', '-C', str(root), 'archive', args.base], stdout=subprocess.PIPE)
subprocess.run(['tar', '-x', '-C', str(target)], stdin=archive.stdout, check=True)
archive.stdout.close()
if archive.wait() != 0:
    raise SystemExit('Checkpoint export failed')

# Copy only the academy dependency closure, under its own alias namespace.
seen = set()
# '@/' specifiers copied under beta-source; relative imports mirror with their file.
copied = set()
imports = re.compile(r'''(?:from\s*|import\s*|import\s*\()\s*['"]([^'"]+)['"]''')

# Modules the published archive already provides. The sandbox consumes the live
# implementation (and must share its React contexts with the page it renders),
# so these are referenced in place rather than copied into beta-source.
PUBLISHED = {
    'app/dashboard/contacts/page',
    'components/contacts/ContactPrototypeContext',
}
published_files = {specifier: next((target / f'{specifier}{suffix}' for suffix in ['.tsx', '.ts', '/index.tsx', '/index.ts'] if (target / f'{specifier}{suffix}').is_file()), None) for specifier in PUBLISHED}
missing = [specifier for specifier, path in published_files.items() if path is None]
if missing:
    raise SystemExit(f'Published modules missing from base: {sorted(missing)}')

def copy_source(path):
    path = path.resolve()
    if path in seen:
        return
    seen.add(path)
    relative = path.relative_to(root)
    destination = target / 'beta-source' / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix not in ['.ts', '.tsx', '.css', '.json']:
        shutil.copy2(path, destination)
        return
    text = path.read_text()
    for specifier in imports.findall(text):
        if not specifier.startswith(('@/', '.')):
            continue
        if specifier.startswith('@/') and specifier[2:] in PUBLISHED:
            continue
        dependency = root / specifier[2:] if specifier.startswith('@/') else path.parent / specifier
        candidates = [dependency, *[Path(str(dependency) + suffix) for suffix in ['.ts', '.tsx', '.css', '.json', '/index.ts', '/index.tsx']]]
        resolved = next((candidate for candidate in candidates if candidate.is_file()), None)
        if resolved is None:
            raise RuntimeError(f'Missing dependency {specifier} in {relative}')
        copy_source(resolved)
        if specifier.startswith('@/'):
            copied.add(specifier)
    destination.write_text(text)

for entry in ['app/odeon-demo/DemoWorkspace.tsx']:
    copy_source(root / entry)

# Rewrite only the specifiers that actually moved, so published imports stay live.
for copied_file in (target / 'beta-source').rglob('*'):
    if copied_file.suffix not in ['.ts', '.tsx']:
        continue
    body = copied_file.read_text()
    for specifier in copied:
        body = body.replace(f"'{specifier}'", f"'@/beta-source/{specifier[2:]}'").replace(f'"{specifier}"', f'"@/beta-source/{specifier[2:]}"')
    copied_file.write_text(body)

# Sandbox views are real modules now, so no route-module renaming is needed.
for view in ['app/dashboard/contacts/ContactsView.tsx', 'app/dashboard/staff/StaffView.tsx', 'app/dashboard/DashboardShell.tsx']:
    if not (root / view).is_file():
        raise SystemExit(f'Missing sandbox view {view}')

for route in ['page.tsx', 'school-setup/page.tsx']:
    destination = target / 'app/odeon-demo' / route
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text((root / 'app/odeon-demo' / route).read_text().replace("'./DemoWorkspace'", "'@/beta-source/app/odeon-demo/DemoWorkspace'").replace("'../DemoWorkspace'", "'@/beta-source/app/odeon-demo/DemoWorkspace'"))

# Preserve published dashboard code; add one role-gated Beta entry at the end of the nav.
layout = target / 'app/dashboard/layout.tsx'
text = layout.read_text()
if 'canAccessBeta' not in text:
    beta_gate = (
        "  const [canAccessBeta, setCanAccessBeta] = useState(false)\n"
        "  useEffect(() => {\n"
        "    const controller = new AbortController()\n"
        "    fetch(`/api/account/me?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store', signal: controller.signal })\n"
        "      .then(async response => { if (response.ok) { const data = await response.json(); setCanAccessBeta(['owner', 'admin'].includes(data.roleKey)) } }).catch(() => {})\n"
        "    return () => controller.abort()\n"
        "  }, [])\n"
    )
    # Anchor on the sidebar's own state block so unrelated layout changes cannot break the patch.
    gate_anchor = "  const [conversationCount, setConversationCount] = useState(0)\n"
    if gate_anchor not in text:
        raise SystemExit('Beta role gate anchor missing')
    text = text.replace(gate_anchor, beta_gate + gate_anchor, 1)
text = text.replace('href={href}', "href={href.startsWith('/odeon-demo') ? `${href}${href.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(getActiveTenantId())}` : href}")
beta_entry = """        {canAccessBeta && (
          <div style={{ padding: '0 4px', marginBottom: spacing.sm }}>
            <Link
              href={`/odeon-demo?tenant=${encodeURIComponent(getActiveTenantId())}`}
              onClick={onNavigate}
              aria-label="BETA academy preview"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.sm,
                padding: '9px 12px',
                borderRadius: radius.lg,
                background: colors.yellow,
                color: colors.espresso,
                textDecoration: 'none',
                fontSize: typography.sizeXs,
                fontWeight: typography.weightBold,
                letterSpacing: '0.08em',
              }}
            >
              <span>BETA</span>
              <span style={{ letterSpacing: 0, fontWeight: typography.weightMedium, color: 'rgba(26,19,15,0.7)' }}>Academy preview</span>
            </Link>
          </div>
        )}
"""
footer_start = "      <div style={{ padding: '12px 8px 12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>\n"
if "BETA academy preview" not in text:
    if footer_start not in text:
        raise SystemExit('Beta navigation anchor missing')
    text = text.replace(footer_start, footer_start + beta_entry, 1)
text = text.replace("position: 'fixed', top: 0, left: 0, height: '100vh' }}", "position: 'fixed', top: 0, left: 0, height: '100vh', overflow: 'hidden' }}")
text = text.replace("<nav style={{ flex: 1, padding: '12px 8px' }}>", "<nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 8px' }}>")
if "BETA academy preview" not in text or "const [canAccessBeta" not in text or "{NAV_GROUPS.filter" in text:
    raise SystemExit('Beta navigation patch failed')
layout.write_text(text)

# The published middleware may already carry the gate; add it only when missing.
middleware = target / 'middleware.ts'
text = middleware.read_text()
if 'isBetaPath' not in text:
    text = text.replace("  const pathname = request.nextUrl.pathname", "  const pathname = request.nextUrl.pathname\n  const isBetaPath = pathname === '/odeon-demo' || pathname.startsWith('/odeon-demo/') || pathname === '/beta' || pathname.startsWith('/beta/')")
    text = text.replace("if (pathname === '/dashboard/design'", "if (isBetaPath || pathname === '/dashboard/design'")
if "loginUrl.searchParams.set('next', pathname)" in text:
    text = text.replace("loginUrl.searchParams.set('next', pathname)", "loginUrl.searchParams.set('next', pathname + request.nextUrl.search)")
if 'X-Robots-Tag' not in text:
    text = text.replace('  return supabaseResponse\n}', "  if (isBetaPath) {\n    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow')\n    supabaseResponse.headers.set('Cache-Control', 'private, no-store')\n  }\n  return supabaseResponse\n}")
if 'isBetaPath' not in text or 'X-Robots-Tag' not in text:
    raise SystemExit('Beta middleware patch failed')
middleware.write_text(text)

# Only academy-owned static images are overlaid; no environment files are copied.
for folder in ['images/services']:
    source = root / 'public' / folder
    if source.exists():
        shutil.copytree(source, target / 'public' / folder, dirs_exist_ok=True)

manifest = {'base': args.base, 'academyFiles': sorted(str(path.relative_to(root)) for path in seen), 'liveChanges': ['app/dashboard/layout.tsx', 'middleware.ts'], 'excluded': ['unrelated dirty files', 'preview host', 'environment files', 'migrations']}
(target / 'beta-release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Prepared {target}: {len(seen)} isolated academy dependencies')