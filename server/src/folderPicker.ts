import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROMPT = "Select the folder containing your web resource files";

/** Opens a native OS folder-picker dialog on the machine running this server (the same
 * machine as the browser, for this local tool) and returns the chosen path, or null if
 * the user cancelled. */
export async function pickFolderNative(): Promise<string | null> {
  if (process.platform === "win32") {
    // FolderBrowserDialog's modern-look auto-upgrade is unreliable when hosted from an
    // ad-hoc PowerShell script (no real WinForms app/manifest), and falls back to the old
    // tree-only "Browse For Folder" dialog. OpenFileDialog is always the modern
    // Explorer-style common dialog, so this well-known trick configures it to pick a
    // folder instead of a file: a fake filename placeholder that survives navigation, a
    // filter matching no real files (folders are never filtered out), and validation
    // relaxed since "Select Folder" isn't an actual file.
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $dialog = New-Object System.Windows.Forms.OpenFileDialog
      $dialog.Title = "${PROMPT}"
      $dialog.ValidateNames = $false
      $dialog.CheckFileExists = $false
      $dialog.CheckPathExists = $true
      $dialog.FileName = "Select Folder"
      $dialog.Filter = "Folders|\`n"
      if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output ([System.IO.Path]::GetDirectoryName($dialog.FileName))
      }
    `;
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    return stdout.trim() || null;
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        `POSIX path of (choose folder with prompt "${PROMPT}")`,
      ]);
      return stdout.trim() || null;
    } catch {
      return null; // osascript throws when the user clicks Cancel.
    }
  }

  try {
    const { stdout } = await execFileAsync("zenity", [
      "--file-selection",
      "--directory",
      `--title=${PROMPT}`,
    ]);
    return stdout.trim() || null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "No native folder picker is available on this platform (needs zenity on Linux). Paste the path manually instead."
      );
    }
    return null; // zenity exits non-zero when the user cancels.
  }
}
