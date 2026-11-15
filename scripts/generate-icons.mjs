import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const result = spawnSync(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'icon', 'src-tauri/icons/icon.svg'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.status !== 0) process.exit(result.status || 1);
const android = resolve(root, 'src-tauri/icons/android');
mkdirSync(resolve(android, 'drawable'), { recursive: true });
// Adaptive launchers crop the foreground to its central region. Keep the mark
// inside that region instead of enlarging the entire legacy icon into it.
writeFileSync(resolve(android, 'drawable/resell_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="128" android:viewportHeight="128">
  <group android:pivotX="64" android:pivotY="64" android:scaleX="0.67" android:scaleY="0.67">
    <path android:pathData="M49,86V42h18c23,0 23,24 0,24H49m16,0 17,20" android:fillColor="@android:color/transparent" android:strokeColor="#F1F1F3" android:strokeWidth="5.5" android:strokeLineCap="round" android:strokeLineJoin="round"/>
  </group>
</vector>
`);
writeFileSync(resolve(android, 'mipmap-anydpi-v26/ic_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/resell_launcher_foreground"/>
</adaptive-icon>
`);
writeFileSync(resolve(android, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#19191C</color></resources>\n');
copyFileSync(resolve(root, 'src-tauri/icons/icon.svg'), resolve(root, 'web/public/resell.svg'));
copyFileSync(resolve(root, 'src-tauri/icons/128x128.png'), resolve(root, 'web/public/icons/resell.png'));
