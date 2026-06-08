#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init());

    // Notification plugin crashes on Android < 13 (POST_NOTIFICATIONS permission doesn't exist on API < 33)
    #[cfg(not(target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_notification::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
