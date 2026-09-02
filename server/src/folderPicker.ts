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
    // tree-only "Browse For Folder" dialog. The OpenFileDialog-as-folder-picker trick doesn't
    // work either: with a filter matching no real files, single-clicking a folder never
    // populates the filename box, so the file name stayed "Select Folder" no matter what was
    // clicked - you'd have to double-click *into* the target folder and click Open from
    // inside it. Instead, call the real Windows folder picker (IFileOpenDialog with
    // FOS_PICKFOLDERS) via COM interop - the same modern, single-click-to-select dialog
    // Explorer itself uses.
    const script = `
      Add-Type -Language CSharp -TypeDefinition @'
        using System;
        using System.Runtime.InteropServices;

        namespace WebResourceSync {
          [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
          internal class FileOpenDialogRCW { }

          [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
          internal interface IFileOpenDialog {
            [PreserveSig] int Show(IntPtr parent);
            void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
            void SetFileTypeIndex(uint iFileType);
            void GetFileTypeIndex(out uint piFileType);
            void Advise(IntPtr pfde, out uint pdwCookie);
            void Unadvise(uint dwCookie);
            void SetOptions(uint fos);
            void GetOptions(out uint pfos);
            void SetDefaultFolder(IShellItem psi);
            void SetFolder(IShellItem psi);
            void GetFolder(out IShellItem ppsi);
            void GetCurrentSelection(out IShellItem ppsi);
            void SetFileName(string pszName);
            void GetFileName(out IntPtr pszName);
            void SetTitle(string pszTitle);
            void SetOkButtonLabel(string pszText);
            void SetFileNameLabel(string pszLabel);
            void GetResult(out IShellItem ppsi);
            void AddPlace(IShellItem psi, uint alignment);
            void SetDefaultExtension(string pszDefaultExtension);
            void Close(int hr);
            void SetClientGuid(ref Guid guid);
            void ClearClientData();
            void SetFilter(IntPtr pFilter);
            void GetResults(out IntPtr ppenum);
            void GetSelectedItems(out IntPtr ppsai);
          }

          [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
          internal interface IShellItem {
            void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
            void GetParent(out IShellItem ppsi);
            void GetDisplayName(uint sigdnName, out IntPtr ppszName);
            void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
            void Compare(IShellItem psi, uint hint, out int piOrder);
          }

          public static class FolderPicker {
            private const uint FOS_PICKFOLDERS = 0x00000020;
            private const uint FOS_FORCEFILESYSTEM = 0x00000040;
            private const uint SIGDN_FILESYSPATH = 0x80058000;

            public static string Pick(string title) {
              var dialog = (IFileOpenDialog)new FileOpenDialogRCW();
              try {
                dialog.SetOptions(FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
                dialog.SetTitle(title);
                int hr = dialog.Show(IntPtr.Zero);
                if (hr != 0) return null; // user cancelled
                IShellItem result;
                dialog.GetResult(out result);
                IntPtr pathPtr;
                result.GetDisplayName(SIGDN_FILESYSPATH, out pathPtr);
                string path = Marshal.PtrToStringUni(pathPtr);
                Marshal.FreeCoTaskMem(pathPtr);
                return path;
              } finally {
                Marshal.ReleaseComObject(dialog);
              }
            }
          }
        }
'@
      $path = [WebResourceSync.FolderPicker]::Pick("${PROMPT}")
      if ($path) { Write-Output $path }
    `;
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Sta",
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
