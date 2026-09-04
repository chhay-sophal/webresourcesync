use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct SidecarProcess(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(SidecarProcess(Mutex::new(None)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let (mut rx, child) = app.shell().sidecar("server")?.spawn()?;
      app.state::<SidecarProcess>().0.lock().unwrap().replace(child);

      tauri::async_runtime::spawn(async move {
          while let Some(event) = rx.recv().await {
              match event {
                  CommandEvent::Stdout(line) => {
                      log::info!("[server] {}", String::from_utf8_lossy(&line))
                  }
                  CommandEvent::Stderr(line) => {
                      log::error!("[server] {}", String::from_utf8_lossy(&line))
                  }
                  CommandEvent::Error(err) => log::error!("[server] error: {err}"),
                  CommandEvent::Terminated(payload) => {
                      log::warn!("[server] exited: {payload:?}")
                  }
                  _ => {}
              }
          }
      });
      
      Ok(())
    })
    .on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            if let Some(state) = window.app_handle().try_state::<SidecarProcess>() {
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
