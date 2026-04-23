use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if !cfg!(debug_assertions) {
                let sidecar_command = app
                    .shell()
                    .sidecar("coredns-admin-backend")
                    .expect("failed to create sidecar command")
                    .env("PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION", "python");

                let (mut _rx, _child) = sidecar_command
                    .spawn()
                    .expect("failed to spawn sidecar");

                log::info!("Backend sidecar started successfully");
            } else {
                log::info!("Dev mode: skipping sidecar, use manual backend");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
