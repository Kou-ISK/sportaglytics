import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-ux-'));
const packagePath = path.join(work, 'Synthetic-review.stpkg');
const profile = path.join(work, 'profile');
await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
await fs.mkdir(path.join(packagePath, 'videos'));
execFileSync(ffmpegPath, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=320x180:rate=24:duration=60',
  '-threads',
  '2',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  '-y',
  path.join(packagePath, 'videos/synthetic.mp4'),
]);
const names = Array.from({ length: 24 }, (_, i) =>
  i === 23
    ? 'Blue / ラインブレイク：長いアクション名で幅と検索を確認する'
    : `Red / ${['Attack', 'Defense', 'Tackle', 'Kick', 'Scrum', 'Lineout'][i % 6]} ${Math.floor(i / 6 + 1)}`,
);
const document = {
  version: 2,
  rows: names.map((name, i) => ({
    id: `row-${i}`,
    name,
    color: i % 2 ? '#2277aa' : '#bb5533',
  })),
  instances: Array.from({ length: 240 }, (_, i) => ({
    id: `instance-${i}`,
    actionName: names[i % 24],
    startTime: (i % 10) * 5 + 1,
    endTime: (i % 10) * 5 + 3,
    memo: i === 239 ? '終盤の幅を使った攻撃。'.repeat(25) : `合成ノート ${i}`,
    labels: [{ group: '結果', name: i % 2 ? '成功' : '継続' }],
    color: i % 2 ? '#2277aa' : '#bb5533',
  })),
};
// Display-only long timecode negative case; this row is never sought in the 60s video.
document.instances[0].startTime = 5412.3;
document.instances[0].endTime = 5448.4;
await fs.writeFile(
  path.join(packagePath, 'timeline.json'),
  JSON.stringify(document),
);
await fs.writeFile(
  path.join(packagePath, '.metadata/config.json'),
  JSON.stringify({
    team1Name: 'Red',
    team2Name: 'Blue',
    primaryAngleId: 'angle-1',
    angles: [
      {
        id: 'angle-1',
        name: 'Synthetic camera',
        sourceKind: 'local',
        relativePath: 'videos/synthetic.mp4',
        clips: [
          {
            id: 'clip-1',
            sourceKind: 'local',
            relativePath: 'videos/synthetic.mp4',
            gapBeforeSeconds: 0,
            timelineStartSeconds: 0,
            durationSeconds: 60,
          },
        ],
      },
    ],
  }),
);
let app;
const stopApp = async () => {
  // Only this harness's isolated process is destroyed; discard its synthetic Playlist.
  await app
    ?.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) window.destroy();
    })
    .catch(() => {});
  await app?.close().catch(() => {});
};
const clickReviewAction = async (page, name) => {
  await page.getByRole('button', { name: '場面の操作', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
};
const screenshot = async (page, name) => {
  if (!process.env.E2E_SCREENSHOT_DIR) return;
  await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
  await settle(page);
  await page.screenshot({
    animations: 'disabled',
    path: path.join(process.env.E2E_SCREENSHOT_DIR, `${name}.png`),
  });
};
const route = async (hash) => {
  for (let n = 0; n < 100; n++) {
    const page = app
      .windows()
      .find((candidate) => new URL(candidate.url()).hash === hash);
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Window missing: ${hash}`);
};
const clickMenu = async (label, page) => {
  const id = await (
    await app.browserWindow(page)
  ).evaluate((window) => window.id);
  await app.evaluate(
    ({ Menu, BrowserWindow }, { label, id }) => {
      const find = (items) => {
        for (const item of items) {
          if (item.label === label) return item;
          const nested = item.submenu && find(item.submenu.items);
          if (nested) return nested;
        }
      };
      const item = find(Menu.getApplicationMenu().items);
      if (!item) throw new Error(`Menu item missing: ${label}`);
      item.click(item, BrowserWindow.fromId(id));
    },
    { label, id },
  );
};
const dockRequired = process.env.UX_DENSITY_REQUIRE_DOCK !== '0';
process.env.E2E_SCREENSHOT_DIR ||= 'output/playwright/ux-density';
const metrics = {
  mode: dockRequired ? 'dock' : 'before',
  windows: [],
  controls: {},
};
const measure = async (page) =>
  page.evaluate(() => {
    const fields = [...document.querySelectorAll('.MuiOutlinedInput-root')].map(
      (node) => {
        const rect = node.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontSize: getComputedStyle(node).fontSize,
        };
      },
    );
    const dialog = document
      .querySelector('[role="dialog"]')
      ?.getBoundingClientRect();
    return {
      fields,
      dialog: dialog && {
        width: Math.round(dialog.width),
        height: Math.round(dialog.height),
      },
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
const settle = async (page) => {
  await page.evaluate(() => {
    for (const animation of document.getAnimations())
      if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) {
        try {
          animation.finish();
        } catch {
          /* Infinite/loading animation is not visual evidence. */
        }
      }
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
};
const assertCompleteTimelineRow = async (page) => {
  const visible = await page
    .getByRole('region', { name: 'タイムライン', exact: true })
    .evaluate((region) => {
      const viewport = region.getBoundingClientRect();
      const ruler = region.querySelector('[data-testid="timeline-ruler"]');
      const rowHeaders = [
        ...region.querySelectorAll('[data-testid^="timeline-row-header-"]'),
      ];
      const fits = (element, minimumHeight) => {
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        return (
          bounds.top >= Math.max(0, viewport.top + region.clientTop) &&
          bounds.bottom <=
            Math.min(
              innerHeight,
              viewport.top + region.clientTop + region.clientHeight,
            ) &&
          bounds.height >= minimumHeight
        );
      };
      return {
        axis: fits(ruler, 28),
        row: rowHeaders.some((header) => fits(header.parentElement, 32)),
        clientHeight: region.clientHeight,
        scrollX,
        scrollY,
        innerHeight,
      };
    });
  assert.equal(
    visible.axis,
    true,
    'The complete ruler must be inside the real client viewport',
  );
  assert.equal(
    visible.row,
    true,
    'One complete 32px Timeline row must be inside the real client viewport, excluding scrollbars',
  );
  return visible;
};
const assertTimeLabelsVisible = async (page) => {
  await page.getByRole('dialog').evaluate((dialog) => {
    dialog.querySelector('.MuiDialogContent-root').scrollTop = 0;
  });
  await settle(page);
  const visible = await page.getByRole('dialog').evaluate((dialog) => {
    const content = dialog.querySelector('.MuiDialogContent-root');
    const bounds = content.getBoundingClientRect();
    return [...content.querySelectorAll('label')]
      .filter((label) => ['開始秒', '終了秒'].includes(label.textContent))
      .map((label) => {
        const rect = label.getBoundingClientRect();
        return {
          text: label.textContent,
          fits:
            rect.top >= Math.max(0, bounds.top + content.clientTop) &&
            rect.bottom <=
              Math.min(
                innerHeight,
                bounds.top + content.clientTop + content.clientHeight,
              ),
        };
      });
  });
  assert.equal(visible.length, 2);
  assert.ok(
    visible.every((label) => label.fits),
    'Both complete floating time labels must be visible inside DialogContent',
  );
};
try {
  app = await electron.launch({
    ...getElectronLaunchOptions(profile),
    timeout: 60_000,
  });
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await main
    .getByRole('button', { name: '新しいパッケージを作成', exact: true })
    .click();
  const wizard = main.getByRole('dialog');
  await wizard
    .getByRole('textbox', { name: 'パッケージ', exact: true })
    .waitFor();
  await settle(main);
  console.log('Density wizard loaded');
  metrics.controls.wizard = await measure(main);
  await screenshot(main, 'density-wizard');
  await main.keyboard.press('Escape');
  await wizard.waitFor({ state: 'hidden' });
  await app.evaluate(
    ({ app: nativeApp }, file) =>
      nativeApp.emit('open-file', { preventDefault() {} }, file),
    packagePath,
  );
  const timeline = await route('#/timeline');
  const region = timeline.getByRole('region', {
    name: 'タイムライン',
    exact: true,
  });
  await region.waitFor();
  await main.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  for (const [width, height] of [
    [1280, 700],
    [1000, 460],
    [720, 380],
    [720, dockRequired ? 300 : 260],
    ...(dockRequired
      ? [
          [599, 300],
          [600, 300],
          [601, 300],
        ]
      : []),
  ]) {
    await (
      await app.browserWindow(timeline)
    ).evaluate(
      (window, size) => {
        window.setMinimumSize(480, size[1] >= 300 ? 300 : 260);
        window.setSize(...size);
      },
      [width, height],
    );
    await settle(timeline);
    console.log('Density window', width, height);
    const clientSize = await timeline.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
    const closed = await region.boundingBox();
    const outerScroll = await timeline.evaluate(() => ({
      x: scrollX,
      y: scrollY,
    }));
    await timeline.keyboard.press(`${primaryModifier}+f`);
    const search = timeline.getByRole('textbox', {
      name: '行名・ラベル・ノートを検索',
    });
    await search.waitFor();
    await search.fill('終盤');
    await timeline.keyboard.press('Enter');
    await settle(timeline);
    const opened = (await region.isVisible())
      ? await region.boundingBox()
      : null;
    const beforeTyping = (await region.isVisible())
      ? await region.boundingBox()
      : null;
    await search.fill('存在しない長い検索語'.repeat(5));
    await settle(timeline);
    const afterTyping = (await region.isVisible())
      ? await region.boundingBox()
      : null;
    if (dockRequired) {
      await assertCompleteTimelineRow(timeline);
      assert.ok(
        opened && opened.height >= 60,
        'Timeline must retain its axis and one complete row (60px minimum)',
      );
      assert.equal(
        Math.round(opened.width),
        Math.round(closed.width),
        'Search must preserve time axis width',
      );
      assert.deepEqual(
        afterTyping,
        beforeTyping,
        'Typing must not shift the timeline',
      );
      assert.equal(
        await timeline.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    if (dockRequired) {
      await search.fill('');
      const first = timeline
        .getByRole('list', { name: '場面検索の結果' })
        .getByRole('button')
        .first();
      const firstBounds = await first.boundingBox();
      assert.ok(firstBounds.height >= 32);
      const firstVisible = await first.evaluate((el) => {
        const row = el.getBoundingClientRect();
        const viewport = el.closest('ul').parentElement;
        const bounds = viewport.getBoundingClientRect();
        return (
          row.top >= Math.max(0, bounds.top + viewport.clientTop) &&
          row.bottom <=
            Math.min(
              innerHeight,
              bounds.top + viewport.clientTop + viewport.clientHeight,
            )
        );
      });
      assert.equal(
        firstVisible,
        true,
        'The complete result row must fit the actual scrolling client viewport',
      );
      const listBounds = await timeline
        .getByRole('list', { name: '場面検索の結果' })
        .evaluate((el) => el.parentElement.getBoundingClientRect().height);
      assert.ok(
        listBounds >= 32,
        'Minimum dock must contain a complete result row with all six pages',
      );
      for (let p = 0; p < 5; p++)
        await timeline
          .getByRole('button', { name: '次の40件', exact: true })
          .click();
      const timecode = timeline
        .getByRole('list', { name: '場面検索の結果' })
        .getByText('90:12.3–90:48.4', { exact: true });
      await timecode.scrollIntoViewIfNeeded();
      await assertCompleteTimelineRow(timeline);
      assert.deepEqual(
        await timeline.evaluate(() => ({ x: scrollX, y: scrollY })),
        outerScroll,
        'Paging and timecode scrolling must not move the outer window',
      );
      assert.equal(
        await timecode.evaluate((el) => el.scrollWidth <= el.clientWidth),
        true,
        'Long timecode must fit',
      );
    }
    await search.fill('終盤');
    await timeline.keyboard.press('Enter');
    await screenshot(timeline, `density-search-${width}x${height}`);
    if (dockRequired) {
      await assertCompleteTimelineRow(timeline);
      assert.deepEqual(
        await timeline.evaluate(() => ({ x: scrollX, y: scrollY })),
        outerScroll,
        'Selection and screenshots must retain outer scroll position',
      );
    }
    const pane = await timeline
      .getByRole('complementary', { name: '場面を検索', exact: true })
      .boundingBox();
    const controls = await measure(timeline);
    metrics.windows.push({
      width,
      height,
      clientSize,
      closed,
      opened,
      pane,
      controls,
      typingStable:
        JSON.stringify(beforeTyping) === JSON.stringify(afterTyping),
    });
    await timeline.getByRole('button', { name: '場面検索を閉じる' }).click();
    await settle(timeline);
    assert.deepEqual(
      await region.boundingBox(),
      closed,
      'Close must restore timeline bounds',
    );
  }
  if (dockRequired) {
    const clamped = await (
      await app.browserWindow(timeline)
    ).evaluate((window) => {
      window.setMinimumSize(720, 300);
      window.setSize(720, 260);
      return window.getSize();
    });
    assert.ok(
      clamped[1] >= 300,
      'Old 260px outer-height request must clamp to the supported native minimum',
    );
    await settle(timeline);
    metrics.minimum = {
      requested: [720, 260],
      actual: clamped,
      client: await timeline.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
      })),
    };
    await assertCompleteTimelineRow(timeline);
    await screenshot(timeline, 'density-minimum-clamped');
  }
  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.setSize(1000, 700));
  await timeline.keyboard.press(`${primaryModifier}+f`);
  await timeline
    .getByRole('textbox', { name: '行名・ラベル・ノートを検索' })
    .fill('終盤');
  await timeline.keyboard.press('Enter');
  const detail = timeline.getByRole('region', { name: '選択した場面の詳細' });
  await clickReviewAction(timeline, '編集');
  await timeline.getByRole('dialog').waitFor();
  await assertTimeLabelsVisible(timeline);
  metrics.controls.timelineEdit = await measure(timeline);
  await screenshot(timeline, 'density-timeline-edit');
  const note = timeline
    .getByRole('dialog')
    .getByRole('textbox', { name: 'ノート', exact: true });
  const noteBounds = await note.boundingBox();
  await note.fill('合成の長いノート。'.repeat(60));
  assert.deepEqual(
    await note.boundingBox(),
    noteBounds,
    'Typing a long note keeps the control size stable',
  );
  await timeline
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();
  if (dockRequired) {
    await (
      await app.browserWindow(timeline)
    ).evaluate((window) => window.setSize(720, 300));
    await clickReviewAction(timeline, '編集');
    const smallDialog = timeline.getByRole('dialog');
    await smallDialog
      .getByRole('spinbutton', { name: '開始秒', exact: true })
      .fill('50');
    await smallDialog
      .getByRole('spinbutton', { name: '終了秒', exact: true })
      .fill('1');
    await assertTimeLabelsVisible(timeline);
    assert.equal(
      await smallDialog
        .getByRole('button', { name: '保存', exact: true })
        .isDisabled(),
      true,
    );
    const cancel = smallDialog.getByRole('button', {
      name: 'キャンセル',
      exact: true,
    });
    const rect = await cancel.boundingBox();
    assert.ok(
      rect.y >= 0 &&
        rect.y + rect.height <= (await timeline.evaluate(() => innerHeight)),
    );
    await screenshot(timeline, 'density-edit-720x260-invalid');
    await cancel.click();
    await (
      await app.browserWindow(timeline)
    ).evaluate((window) => window.setSize(1000, 700));
  }
  await clickReviewAction(timeline, 'Playlistに追加');
  const playlist = await route('#/playlist');
  await playlist
    .getByTestId(/^organizer-clip-/)
    .first()
    .click();
  await playlist.getByRole('textbox', { name: 'クリップのノート' }).waitFor();
  metrics.controls.playlist = await measure(playlist);
  await screenshot(playlist, 'density-playlist');
  await playlist.getByRole('button', { name: '保存', exact: true }).click();
  await playlist.getByRole('dialog').waitFor();
  metrics.controls.playlistSave = await measure(playlist);
  await screenshot(playlist, 'density-playlist-save');
  await playlist
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();
  await clickMenu('設定…', main);
  const settings = await route('#/settings');
  await settings.getByRole('tab', { name: 'ホットキー' }).click();
  await settings.getByRole('textbox').first().waitFor();
  metrics.controls.hotkeys = await measure(settings);
  await screenshot(settings, 'density-hotkeys');
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    ),
    document,
    'Visual review and cancellation preserve all data',
  );
  await fs.writeFile(
    path.join(process.env.E2E_SCREENSHOT_DIR, 'measurements.json'),
    JSON.stringify(metrics, null, 2),
  );
  console.log('Density review passed:', JSON.stringify(metrics));
} finally {
  await stopApp();
  await fs.rm(work, { recursive: true, force: true });
}
