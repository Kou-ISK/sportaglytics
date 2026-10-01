const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');

const targets = [
  'src/features/videoPlayer/components/Timeline/VisualTimeline/review/TimelineReviewView.tsx',
  'src/features/videoPlayer/components/Timeline/VisualTimeline/review/TimelineWorkspaceView.tsx',
  'src/features/videoPlayer/components/Timeline/VisualTimeline/TimelineAxis.tsx',
  'src/features/videoPlayer/components/Timeline/VisualTimeline/TimelinePlayhead.tsx',
  'src/features/playlist/components/PlaylistReviewView.tsx',
  'src/features/playlist/studio/StudioCanvasView.tsx',
  'src/features/playlist/studio/StudioClipsView.tsx',
  'src/features/playlist/studio/StudioSidebarView.tsx',
  'src/features/playlist/studio/StudioToolsView.tsx',
  'src/features/playlist/studio/StudioPropertiesView.tsx',
  'src/features/playlist/studio/StudioTransportView.tsx',
  'src/features/videoPlayer/components/Setup/VideoPathSelectorView.tsx',
  'src/features/videoPlayer/components/Setup/VideoPathSelector/RecentPackageCard.tsx',
  'src/features/videoPlayer/components/Setup/VideoPathSelector/components/RecentPackagesSection.tsx',
  'src/features/videoPlayer/components/Setup/VideoPathSelector/components/StartStatusView.tsx',
  'src/features/videoPlayer/components/Setup/VideoPathSelector/components/ActionButtonsRow.tsx',
  'src/features/videoPlayer/components/Setup/VideoPathSelector/components/WelcomeHeader.tsx',
  'src/features/videoPlayer/components/Controls/VideoController/VideoControllerToolbar.tsx',
  'src/features/videoPlayer/components/Controls/VideoController/toolbar/SpeedSelector.tsx',
  'src/features/videoPlayer/components/Timeline/VisualTimeline/TimelineLaneView.tsx',
  'src/features/videoPlayer/components/Timeline/VisualTimeline/TimelineLaneItem.tsx',
  'src/features/videoPlayer/components/Timeline/VisualTimeline/TimelineFooter.tsx',
  'src/features/playlist/components/PlaylistHeaderToolbar.tsx',
  'src/features/playlist/components/PlaylistClipInspector.tsx',
  'src/components/OnboardingTutorialView.tsx',
  'src/features/playlist/components/AnnotationToolbar.tsx',
];
const forbidden = [
  { expression: /#[0-9a-f]{3,8}\b/i, name: 'hex color' },
  { expression: /rgba?\(/i, name: 'rgb color' },
  { expression: /boxShadow:\s*\d+/, name: 'numeric box shadow' },
  { expression: /zIndex:\s*\d+/, name: 'numeric z-index' },
];

const run = async () => {
  const violations = [];
  for (const target of targets) {
    const content = await readFile(resolve(target), 'utf8');
    for (const rule of forbidden) {
      if (rule.expression.test(content))
        violations.push(`${target}: ${rule.name}`);
    }
  }
  if (violations.length > 0) {
    console.error('Design system check failed:\n' + violations.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Design system check passed');
};

void run();
