use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Ready for the photobooth.", name)
}

fn app_data_file(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let safe_name = file_name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        .collect::<String>();
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join(if safe_name.is_empty() { "photobooth.json" } else { &safe_name }))
}

#[tauri::command]
fn save_app_data(app: AppHandle, file_name: String, contents: String) -> Result<String, String> {
    let path = app_data_file(&app, &file_name)?;
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(format!("Saved {}", path.display()))
}

#[tauri::command]
fn load_app_data(app: AppHandle, file_name: String) -> Result<String, String> {
    let path = app_data_file(&app, &file_name)?;
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|error| error.to_string())
}

#[tauri::command]
fn silent_print_image(image_data_url: String, profile: serde_json::Value) -> Result<String, String> {
    // Production implementation point:
    // 1. Decode image_data_url to a temporary PNG.
    // 2. Send it to the Windows print spooler or a vendor printer SDK.
    // 3. Apply printer name, copies and paper size from profile.
    // This stub intentionally returns a clear message instead of pretending the hardware is configured.
    let printer_name = profile
        .get("printerName")
        .and_then(|value| value.as_str())
        .unwrap_or("default printer");
    let _ = image_data_url;
    Ok(format!("Silent print adapter is ready to wire for {}. Configure a Windows print adapter/SDK before production use.", printer_name))
}

#[tauri::command]
fn connect_dslr(settings: serde_json::Value) -> Result<String, String> {
    let provider = settings
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("none");
    Ok(format!("DSLR adapter '{}' is configured. Add the vendor SDK/gPhoto2 bridge on this command for real capture.", provider))
}

#[tauri::command]
fn trigger_dslr_capture(settings: serde_json::Value) -> Result<String, String> {
    let provider = settings
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("none");
    Err(format!("DSLR capture for '{}' needs the vendor SDK bridge implementation.", provider))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            save_app_data,
            load_app_data,
            silent_print_image,
            connect_dslr,
            trigger_dslr_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
