#[tauri::command]
fn disk_space(path: String) -> Result<(u64, u64), String> {
  let available = fs2::available_space(&path).map_err(|e| e.to_string())?;
  let total = fs2::total_space(&path).map_err(|e| e.to_string())?;
  Ok((available, total))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![disk_space])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
